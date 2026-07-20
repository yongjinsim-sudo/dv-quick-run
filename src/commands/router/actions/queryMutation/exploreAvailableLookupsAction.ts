import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { loadFields, loadNavigationProperties } from "../shared/metadataAccess.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";
import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import { buildLookupUnderstandings } from "../../../../core/metadata/lookupUnderstanding.js";
import { canApplyActionableInsight } from "../../../../product/capabilities/capabilityResolver.js";
import { previewMutationResult } from "../../../../refinement/queryPreview.js";
import {
  buildAvailableLookupMutationPreview,
  buildAvailableLookupPreviewFlowOptions,
  type AvailableLookup,
  type AvailableLookupTarget,
  type LookupAction
} from "./availableLookupMutationPreview.js";

export {
  buildAvailableLookupMutationPreview,
  buildAvailableLookupPreviewFlowOptions,
  type AvailableLookup,
  type AvailableLookupTarget,
  type LookupAction
} from "./availableLookupMutationPreview.js";

type NavigationRow = {
  navigationPropertyName?: string;
  referencingAttribute?: string;
  referencedEntity?: string;
  referencingEntity?: string;
};

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

export function buildAvailableLookups(
  sourceLogicalName: string,
  fields: FieldDef[],
  navigationRows: NavigationRow[],
  targetDisplayNames: ReadonlyMap<string, string>,
  primaryIdAttribute?: string
): AvailableLookup[] {
  const entityDefinitions = [...targetDisplayNames.entries()].map(([logicalName, displayName]) => ({
    logicalName,
    entitySetName: logicalName,
    displayName
  }));
  return buildLookupUnderstandings({
    sourceLogicalName,
    fields,
    relationships: navigationRows,
    entityDefinitions,
    primaryIdAttribute
  }).map((lookup) => ({
    logicalName: lookup.attributeLogicalName,
    displayName: lookup.displayName ?? lookup.attributeLogicalName,
    attributeType: lookup.attributeType ?? "Lookup",
    selectToken: lookup.lookupValueProperty,
    targets: lookup.targetEntities.flatMap((target) =>
      target.navigationProperties.map((navigation) => ({
        logicalName: target.entityLogicalName,
        displayName: target.displayName,
        navigationPropertyName: navigation.name
      }))
    ),
    isPolymorphic: lookup.targetEntities.length > 1
  }));
}

function targetLabel(target: AvailableLookupTarget): string {
  return target.displayName && normalize(target.displayName) !== normalize(target.logicalName)
    ? `${target.displayName} (${target.logicalName})`
    : target.logicalName;
}

async function pickLookup(entitySetName: string, lookups: AvailableLookup[]): Promise<AvailableLookup | undefined> {
  if (!lookups.length) {
    void vscode.window.showInformationMessage(`DV Quick Run: No lookup attributes found for ${entitySetName}.`);
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    lookups.map((lookup) => ({
      label: lookup.displayName,
      description: `${lookup.logicalName} • ${lookup.isPolymorphic ? "Polymorphic" : "Standard"}`,
      detail: lookup.targets.length
        ? `Targets: ${lookup.targets.map(targetLabel).join(", ")} • Select: ${lookup.selectToken}`
        : `Select: ${lookup.selectToken}`,
      lookup
    })),
    {
      title: `DV Quick Run: Available Lookups — ${entitySetName}`,
      placeHolder: "Search by display name, logical name, target table, or lookup type",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  return picked?.lookup;
}

async function pickTarget(lookup: AvailableLookup): Promise<AvailableLookupTarget | undefined> {
  const expandable = lookup.targets.filter((target) => !!target.navigationPropertyName);
  if (!expandable.length) {
    return undefined;
  }
  if (expandable.length === 1) {
    return expandable[0];
  }

  const picked = await vscode.window.showQuickPick(
    expandable.map((target) => ({
      label: targetLabel(target),
      description: target.navigationPropertyName,
      detail: `Expand: $expand=${target.navigationPropertyName}`,
      target
    })),
    {
      title: `DV Quick Run: ${lookup.displayName} — Choose target`,
      placeHolder: "Choose the target-specific navigation property",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );
  return picked?.target;
}

async function pickAction(lookup: AvailableLookup): Promise<LookupAction | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Preview value property", description: lookup.selectToken, action: "insertValue" as const },
      { label: "Preview target-specific expand", description: "Preview a $expand update", action: "insertExpand" as const },
      { label: "Preview value + expand", description: "Preview $select and $expand updates", action: "insertBoth" as const },
      { label: "Copy lookup reference", description: "Clipboard only — do not modify the editor", action: "copyReference" as const }
    ],
    {
      title: `DV Quick Run: ${lookup.displayName} (${lookup.logicalName})`,
      placeHolder: lookup.isPolymorphic ? "Polymorphic lookup" : "Standard lookup",
      ignoreFocusOut: true
    }
  );
  return picked?.action;
}

function buildReference(lookup: AvailableLookup): string {
  const lines = [
    `${lookup.displayName} (${lookup.logicalName})`,
    `Type: ${lookup.isPolymorphic ? "Polymorphic lookup" : "Standard lookup"}`,
    `Value property: ${lookup.selectToken}`,
    "Targets:"
  ];
  for (const target of lookup.targets) {
    lines.push(`- ${targetLabel(target)}`);
    if (target.navigationPropertyName) {
      lines.push(`  Navigation: ${target.navigationPropertyName}`);
      lines.push(`  Expand: $expand=${target.navigationPropertyName}`);
    }
  }
  lines.push(`Runtime target: ${lookup.selectToken}@Microsoft.Dynamics.CRM.lookuplogicalname`);
  lines.push(`Formatted value: ${lookup.selectToken}@OData.Community.Display.V1.FormattedValue`);
  return lines.join("\n");
}

export async function runExploreAvailableLookupsAction(ctx: CommandContext): Promise<void> {
  await runQueryMutationAction(
    ctx,
    "Explore Available Lookups",
    "DV Quick Run: Lookup preview applied to the query.",
    async ({ target, parsed, token, client, defs, entityDef }) => {
      const [fields, navigationRows] = await Promise.all([
        loadFields(ctx, client, token, entityDef.logicalName),
        loadNavigationProperties(ctx, client, token, entityDef.logicalName)
      ]);
      const targetDisplayNames = new Map(
        defs.map((def) => [normalize(def.logicalName), String(def.displayName ?? def.logicalName)])
      );
      const lookups = buildAvailableLookups(
        entityDef.logicalName,
        fields,
        navigationRows,
        targetDisplayNames,
        entityDef.primaryIdAttribute
      );
      const lookup = await pickLookup(entityDef.entitySetName, lookups);
      if (!lookup) {
        return false;
      }

      const action = await pickAction(lookup);
      if (!action) {
        return false;
      }

      if (action === "copyReference") {
        await vscode.env.clipboard.writeText(buildReference(lookup));
        void vscode.window.showInformationMessage(`DV Quick Run: Copied lookup reference for ${lookup.displayName}.`);
        return false;
      }

      const lookupTarget = action === "insertValue" ? undefined : await pickTarget(lookup);
      if (action !== "insertValue" && !lookupTarget?.navigationPropertyName) {
        void vscode.window.showInformationMessage(`DV Quick Run: No target-specific navigation property is available for ${lookup.displayName}.`);
        return false;
      }

      const preview = buildAvailableLookupMutationPreview(
        target.text,
        parsed,
        lookup,
        action,
        lookupTarget
      );
      if (!preview || preview.result.updatedQuery === preview.result.originalQuery) {
        void vscode.window.showInformationMessage("DV Quick Run: The selected lookup syntax is already present in the query.");
        return false;
      }

      await previewMutationResult(
        target,
        preview.result,
        preview.details,
        buildAvailableLookupPreviewFlowOptions(canApplyActionableInsight())
      );

      // The preview surface owns any explicit apply. Returning false prevents the
      // legacy mutation runner from applying the same query immediately.
      return false;
    }
  );
}
