import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { loadEntityDefs, loadFields } from "./shared/metadataAccess.js";
import { getSelectableFields } from "./shared/selectableFields.js";
import { getEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";
import {
  parseEditorQuery,
  buildEditorQuery,
  getEntitySetNameFromEditorQuery
} from "./shared/queryMutation/parsedEditorQuery.js";
import { setQueryOption } from "./shared/queryMutation/queryOptionMutator.js";
import { applyEditorQueryUpdate } from "./shared/queryMutation/applyEditorQueryUpdate.js";

type NavOption = {
  navigationPropertyName: string;
  referencingAttribute?: string;
  referencedEntity: string;
  schemaName?: string;
};

function pickEntity(defs: EntityDef[], entitySetName: string): EntityDef | undefined {
  return defs.find((d) => d.entitySetName.toLowerCase() === entitySetName.toLowerCase());
}

async function loadManyToOneNavOptions(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavOption[]> {
  const path =
    `/EntityDefinitions(LogicalName='${logicalName}')/ManyToOneRelationships` +
    `?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntityNavigationPropertyName`;

  ctx.output.appendLine(`Loading navigation properties: ${path}`);

  const json = await client.get(path, token);

  const rows: any[] = Array.isArray(json?.value) ? json.value : [];
  
  const options: NavOption[] = rows
    .map((x: any): NavOption => ({
      navigationPropertyName: String(x?.ReferencingEntityNavigationPropertyName ?? "").trim(),
      referencingAttribute: x?.ReferencingAttribute ? String(x.ReferencingAttribute) : undefined,
      referencedEntity: String(x?.ReferencedEntity ?? "").trim(),
      schemaName: x?.SchemaName ? String(x.SchemaName) : undefined
    }))
    .filter((x: NavOption) => !!x.navigationPropertyName && !!x.referencedEntity);

  const dedup = new Map<string, NavOption>();
  for (const o of options) {
    dedup.set(o.navigationPropertyName.toLowerCase(), o);
  }

  const result = Array.from(dedup.values()).sort((a, b) =>
    a.navigationPropertyName.localeCompare(b.navigationPropertyName)
  );

  ctx.output.appendLine(`Navigation properties found for ${logicalName}: ${result.length}`);
  return result;
}

async function pickNavigationProperty(
  entitySetName: string,
  options: NavOption[]
): Promise<NavOption | undefined> {
  if (!options.length) {
    vscode.window.showInformationMessage(`DV Quick Run: No expandable navigation properties found for ${entitySetName}.`);
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    options.map((o) => ({
      label: o.navigationPropertyName,
      description: o.referencedEntity,
      detail: o.referencingAttribute
        ? `Lookup: ${o.referencingAttribute}${o.schemaName ? ` • ${o.schemaName}` : ""}`
        : o.schemaName,
      option: o
    })),
    {
      title: `DV Quick Run: Add Expand ($expand) — ${entitySetName}`,
      placeHolder: "Pick a navigation property to expand",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.option;
}

async function pickExpandFields(
  targetEntitySetName: string,
  selectable: ReturnType<typeof getSelectableFields>
): Promise<string[] | undefined> {
  const picked = await vscode.window.showQuickPick(
    selectable.map((f) => ({
      label: f.logicalName,
      description: f.attributeType || "",
      detail: `$select token: ${f.selectToken}`,
      token: f.selectToken as string
    })),
    {
      title: `DV Quick Run: Expand fields (${targetEntitySetName})`,
      placeHolder: "Pick fields for the expanded record",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {
    return undefined;
  }

  return picked.map((p) => p.token);
}

function buildExpandClause(navigationPropertyName: string, selectTokens: string[]): string {
  const tokens = selectTokens.map((x) => x.trim()).filter(Boolean);
  if (!tokens.length) {
    return navigationPropertyName;
  }

  return `${navigationPropertyName}($select=${tokens.join(",")})`;
}

async function pickExistingExpandStrategy(existingExpand: string): Promise<"replace" | "append" | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Replace existing $expand", value: "replace" as const, description: existingExpand },
      { label: "Append to existing $expand", value: "append" as const, description: existingExpand }
    ],
    {
      title: "DV Quick Run: Existing $expand found",
      placeHolder: "Choose how to combine the new expand",
      ignoreFocusOut: true
    }
  );

  return picked?.value;
}

function mergeExpand(existingExpand: string | null, newClause: string, strategy: "replace" | "append"): string {
  if (!existingExpand || strategy === "replace") {
    return newClause;
  }

  return `${existingExpand},${newClause}`;
}

export async function runAddExpandAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const target = getEditorQueryTarget();
    const parsed = parseEditorQuery(target.text);

    const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
    if (!entitySetName) {
      throw new Error(`Could not detect entity set name from: ${target.text}`);
    }

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    ctx.output.appendLine(`BaseUrl: ${baseUrl}`);
    ctx.output.appendLine(`Scope: ${scope}`);
    ctx.output.appendLine(`Getting token via Azure CLI...`);

    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient(baseUrl);

    const defs = await loadEntityDefs(ctx, client, token);
    const sourceDef = await pickEntity(defs, entitySetName);
    if (!sourceDef) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const navOptions = await loadManyToOneNavOptions(ctx, client, token, sourceDef.logicalName);
    const pickedNav = await pickNavigationProperty(sourceDef.entitySetName, navOptions);
    if (!pickedNav) {return;}

    const targetDef = defs.find((d) => d.logicalName.toLowerCase() === pickedNav.referencedEntity.toLowerCase());
    if (!targetDef) {
      throw new Error(`Could not find target entity metadata for: ${pickedNav.referencedEntity}`);
    }

    const targetFields = await loadFields(ctx, client, token, targetDef.logicalName);
    const selectable = getSelectableFields(targetFields);
    const pickedTokens = await pickExpandFields(targetDef.entitySetName, selectable);
    if (!pickedTokens?.length) {return;}

    const newClause = buildExpandClause(pickedNav.navigationPropertyName, pickedTokens);

    const existingExpand = parsed.queryOptions.get("$expand");
    let strategy: "replace" | "append" = "replace";

    if (existingExpand) {
      const pickedStrategy = await pickExistingExpandStrategy(existingExpand);
      if (!pickedStrategy) {return;}
      strategy = pickedStrategy;
    }

    const mergedExpand = mergeExpand(existingExpand, newClause, strategy);
    setQueryOption(parsed, "$expand", mergedExpand);

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    ctx.output.appendLine(`Add Expand ($expand): ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage("DV Quick Run: Added expand to $expand.");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Add Expand ($expand) failed. Check Output.");
  }
}