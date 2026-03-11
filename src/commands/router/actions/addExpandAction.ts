import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { logDebug, logError, logInfo } from "../../../utils/logger.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import {
  loadEntityDefs,
  loadFields,
  loadNavigationProperties,
  findEntityByEntitySetName,
  findEntityByLogicalName
} from "./shared/metadataAccess.js";
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
  relationshipType: string;
  targetLogicalName: string;
  referencingAttribute?: string;
  schemaName?: string;
};

async function loadNavigationOptions(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavOption[]> {
  const rows = await loadNavigationProperties(ctx, client, token, logicalName);

  const options: NavOption[] = rows
    .map((row): NavOption | undefined => {
      const navigationPropertyName = String(row?.navigationPropertyName ?? "").trim();
      if (!navigationPropertyName) {
        return undefined;
      }

      const candidateTargets = [row?.referencedEntity, row?.referencingEntity]
        .map((value) => String(value ?? "").trim())
        .filter((value) => !!value);

      const targetLogicalName = candidateTargets.find(
        (value) => value.toLowerCase() !== logicalName.toLowerCase()
      );

      if (!targetLogicalName) {
        return undefined;
      }

      return {
        navigationPropertyName,
        relationshipType: String(row?.relationshipType ?? ""),
        targetLogicalName,
        referencingAttribute: row?.referencingAttribute
          ? String(row.referencingAttribute)
          : undefined,
        schemaName: row?.schemaName ? String(row.schemaName) : undefined
      };
    })
    .filter((row): row is NavOption => !!row);

  const dedup = new Map<string, NavOption>();
  for (const option of options) {
    dedup.set(option.navigationPropertyName.toLowerCase(), option);
  }

  const result = Array.from(dedup.values()).sort((a, b) =>
    a.navigationPropertyName.localeCompare(b.navigationPropertyName)
  );

  logDebug(ctx.output,`Navigation properties found for ${logicalName}: ${result.length}`);
  return result;
}

async function pickNavigationProperty(
  sourceEntitySetName: string,
  defs: EntityDef[],
  options: NavOption[]
): Promise<NavOption | undefined> {
  if (!options.length) {
    vscode.window.showInformationMessage(`DV Quick Run: No expandable navigation properties found for ${sourceEntitySetName}.`);
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    options.map((option) => {
      const targetDef = findEntityByLogicalName(defs, option.targetLogicalName);
      const targetLabel = targetDef?.entitySetName ?? option.targetLogicalName;
      const detailParts: string[] = [option.relationshipType];
      if (option.referencingAttribute) {
        detailParts.push(`Lookup: ${option.referencingAttribute}`);
      }
      if (option.schemaName) {
        detailParts.push(option.schemaName);
      }

      return {
        label: option.navigationPropertyName,
        description: targetLabel,
        detail: detailParts.join(" • "),
        option
      };
    }),
    {
      title: `DV Quick Run: Add Expand ($expand) — ${sourceEntitySetName}`,
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
    selectable.map((field) => ({
      label: field.logicalName,
      description: field.attributeType || "",
      detail: `$select token: ${field.selectToken}`,
      token: field.selectToken as string
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

  return picked.map((item) => item.token);
}

function buildExpandClause(navigationPropertyName: string, selectTokens: string[]): string {
  const tokens = selectTokens.map((token) => token.trim()).filter(Boolean);
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

    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient(baseUrl);

    const defs = await loadEntityDefs(ctx, client, token);
    const sourceDef = findEntityByEntitySetName(defs, entitySetName);
    if (!sourceDef) {
      throw new Error(`Could not find metadata for entity set: ${entitySetName}`);
    }

    const navOptions = await loadNavigationOptions(ctx, client, token, sourceDef.logicalName);
    const pickedNav = await pickNavigationProperty(sourceDef.entitySetName, defs, navOptions);
    if (!pickedNav) {return;}

    const targetDef = findEntityByLogicalName(defs, pickedNav.targetLogicalName);
    if (!targetDef) {
      throw new Error(`Could not find target entity metadata for: ${pickedNav.targetLogicalName}`);
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

    const finalExpand = existingExpand && strategy === "append" ? mergeExpandClause(existingExpand, newClause): newClause;

    setQueryOption(parsed, "$expand", finalExpand);

    const updated = buildEditorQuery(parsed);
    await applyEditorQueryUpdate(target, updated);

    logInfo(ctx.output,`Add Expand ($expand): ${target.text} -> ${updated}`);
    vscode.window.showInformationMessage("DV Quick Run: Added expand to $expand.");
  } catch (error: any) {
    const msg = error?.message ?? String(error);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: Add Expand ($expand) failed. Check Output.");
  }
}

function splitTopLevelExpandItems(expand: string): string[] {
  const items: string[] = [];
  let current = "";
  let depth = 0;

  for (const ch of expand) {
    if (ch === "(") {
      depth++;
    } else if (ch === ")") {
      depth = Math.max(0, depth - 1);
    }

    if (ch === "," && depth === 0) {
      if (current.trim()) {
        items.push(current.trim());
      }
      current = "";
      continue;
    }

    current += ch;
  }

  if (current.trim()) {
    items.push(current.trim());
  }

  return items;
}

function getExpandNavName(item: string): string {
  const trimmed = item.trim();
  const idx = trimmed.indexOf("(");
  return idx >= 0 ? trimmed.slice(0, idx).trim() : trimmed;
}

function getNestedSelectFields(item: string): string[] {
  const match = item.match(/\$select=([^)]+)/i);
  if (!match?.[1]) {
    return [];
  }

  return match[1]
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function buildExpandItem(navName: string, selectFields: string[]): string {
  const distinct = Array.from(new Set(selectFields.map((x) => x.trim()).filter(Boolean)));

  if (!distinct.length) {
    return navName;
  }

  return `${navName}($select=${distinct.join(",")})`;
}

function mergeExpandItem(existingItem: string, incomingItem: string): string {
  const navName = getExpandNavName(existingItem);

  const existingFields = getNestedSelectFields(existingItem);
  const incomingFields = getNestedSelectFields(incomingItem);

  if (!existingFields.length && !incomingFields.length) {
    return navName;
  }

  const mergedFields = Array.from(new Set([...existingFields, ...incomingFields]));
  return buildExpandItem(navName, mergedFields);
}

function mergeExpandClause(existingExpand: string | undefined, incomingItem: string): string {
  if (!existingExpand?.trim()) {
    return incomingItem;
  }

  const incomingNav = getExpandNavName(incomingItem);

  const items = splitTopLevelExpandItems(existingExpand);

  let found = false;

  const merged = items.map((item) => {
    if (getExpandNavName(item).toLowerCase() === incomingNav.toLowerCase()) {
      found = true;
      return mergeExpandItem(item, incomingItem);
    }

    return item;
  });

  if (!found) {
    merged.push(incomingItem);
  }

  return merged.join(",");
}