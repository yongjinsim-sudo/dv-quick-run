import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";
import { logDebug } from "../../../../utils/logger.js";
import { EntityDef } from "../../../../utils/entitySetCache.js";
import { loadFields, loadNavigationProperties, findEntityByLogicalName } from "../shared/metadataAccess.js";
import { getSelectableFields } from "../shared/selectableFields.js";
import { setQueryOption } from "../shared/queryMutation/queryOptionMutator.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";
import { applyExpand } from "../shared/expand/expandComposer.js";

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
  await runQueryMutationAction(
    ctx,
    "Add Expand ($expand)",
    "DV Quick Run: Added expand to $expand.",
    async ({ parsed, token, client, defs, entityDef }) => {
      const navOptions = await loadNavigationOptions(ctx, client, token, entityDef.logicalName);
      const pickedNav = await pickNavigationProperty(entityDef.entitySetName, defs, navOptions);
      if (!pickedNav) {
        return false;
      }

      const targetDef = findEntityByLogicalName(defs, pickedNav.targetLogicalName);
      if (!targetDef) {
        throw new Error(`Could not find target entity metadata for: ${pickedNav.targetLogicalName}`);
      }

      const targetFields = await loadFields(ctx, client, token, targetDef.logicalName);
      const selectable = getSelectableFields(targetFields);
      const pickedTokens = await pickExpandFields(targetDef.entitySetName, selectable);
      if (!pickedTokens?.length) {
        return false;
      }

      const existingExpand = parsed.queryOptions.get("$expand");
      let strategy: "replace" | "append" = "replace";

      if (existingExpand) {
        const pickedStrategy = await pickExistingExpandStrategy(existingExpand);
        if (!pickedStrategy) {
          return false;
        }
        strategy = pickedStrategy;
      }

      const finalExpand = strategy === "append"
        ? applyExpand(existingExpand ?? undefined, {
            relationship: pickedNav.navigationPropertyName,
            select: pickedTokens
          })
        : applyExpand(undefined, {
            relationship: pickedNav.navigationPropertyName,
            select: pickedTokens
          });

      setQueryOption(parsed, "$expand", finalExpand);
      return true;
    }
  );
}

