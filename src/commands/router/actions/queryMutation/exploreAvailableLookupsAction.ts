import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { isLookupLikeAttributeType, buildLookupSelectToken } from "../../../../metadata/metadataModel.js";
import { loadFields, loadNavigationProperties } from "../shared/metadataAccess.js";
import { runQueryMutationAction } from "../shared/queryMutation/runQueryMutationAction.js";
import { upsertCsvQueryOption, setQueryOption } from "../shared/queryMutation/queryOptionMutator.js";
import { applyExpand } from "../shared/expand/expandComposer.js";
import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";

export type AvailableLookupTarget = {
  logicalName: string;
  displayName?: string;
  navigationPropertyName?: string;
};

export type AvailableLookup = {
  logicalName: string;
  displayName: string;
  attributeType: string;
  selectToken: string;
  targets: AvailableLookupTarget[];
  isPolymorphic: boolean;
};

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
  return fields
    .filter((field) => isLookupLikeAttributeType(field.attributeType))
    .filter((field) => normalize(field.logicalName) !== normalize(primaryIdAttribute))
    .map((field): AvailableLookup | undefined => {
      const logicalName = String(field.logicalName ?? "").trim();
      const selectToken = buildLookupSelectToken(logicalName, field.attributeType);
      if (!logicalName || !selectToken) {
        return undefined;
      }

      const relationshipTargets = navigationRows
        // A lookup attribute belongs to the table on the referencing side of a many-to-one
        // relationship. Navigation metadata can also include incoming one-to-many relationships
        // whose referencing attribute happens to share the same logical name. Those rows must not
        // be grouped into this lookup family (for example a portal table's parentcustomerid that
        // references contact).
        .filter((row) =>
          normalize(row.referencingEntity) === normalize(sourceLogicalName)
          && normalize(row.referencingAttribute) === normalize(logicalName)
        )
        .map((row): AvailableLookupTarget | undefined => {
          const targetLogicalName = String(row.referencedEntity ?? "").trim();
          if (!targetLogicalName) {
            return undefined;
          }

          return {
            logicalName: targetLogicalName,
            displayName: targetDisplayNames.get(normalize(targetLogicalName)),
            navigationPropertyName: String(row.navigationPropertyName ?? "").trim() || undefined
          };
        })
        .filter((target): target is AvailableLookupTarget => !!target);

      const metadataTargets: AvailableLookupTarget[] = (field.lookupTargets ?? []).map((target) => ({
        logicalName: target,
        displayName: targetDisplayNames.get(normalize(target))
      }));

      const merged = new Map<string, AvailableLookupTarget>();
      for (const target of [...metadataTargets, ...relationshipTargets]) {
        const key = normalize(target.logicalName);
        const previous = merged.get(key);
        merged.set(key, {
          logicalName: target.logicalName,
          displayName: target.displayName ?? previous?.displayName,
          navigationPropertyName: target.navigationPropertyName ?? previous?.navigationPropertyName
        });
      }

      const targets = Array.from(merged.values()).sort((a, b) => a.logicalName.localeCompare(b.logicalName));

      // Discovery is intentionally relationship-backed. A field that merely looks like a
      // lookup in attribute metadata (for example a primary key misreported by a provider)
      // must not be offered unless Dataverse exposes a usable navigation property for it.
      if (!targets.some((target) => !!target.navigationPropertyName)) {
        return undefined;
      }

      return {
        logicalName,
        displayName: String(field.displayName ?? logicalName).trim() || logicalName,
        attributeType: String(field.attributeType ?? "Lookup"),
        selectToken,
        targets,
        isPolymorphic: targets.length > 1
      };
    })
    .filter((lookup): lookup is AvailableLookup => !!lookup)
    .sort((a, b) => a.displayName.localeCompare(b.displayName));
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

type LookupAction = "insertValue" | "insertExpand" | "insertBoth" | "copyReference";

async function pickAction(lookup: AvailableLookup): Promise<LookupAction | undefined> {
  const picked = await vscode.window.showQuickPick(
    [
      { label: "Insert value property", description: lookup.selectToken, action: "insertValue" as const },
      { label: "Insert target-specific expand", description: "Update $expand only", action: "insertExpand" as const },
      { label: "Insert value + expand", description: "Update both $select and $expand", action: "insertBoth" as const },
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
    "DV Quick Run: Lookup syntax added to the query.",
    async ({ parsed, token, client, defs, entityDef }) => {
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

      if (action === "insertValue") {
        upsertCsvQueryOption(parsed, "$select", [lookup.selectToken], "appendCsv");
        return true;
      }

      const target = await pickTarget(lookup);
      if (!target?.navigationPropertyName) {
        void vscode.window.showInformationMessage(`DV Quick Run: No target-specific navigation property is available for ${lookup.displayName}.`);
        return false;
      }

      if (action === "insertBoth") {
        upsertCsvQueryOption(parsed, "$select", [lookup.selectToken], "appendCsv");
      }

      const existingExpand = parsed.queryOptions.get("$expand");
      const expanded = applyExpand(existingExpand ?? undefined, { relationship: target.navigationPropertyName });
      setQueryOption(parsed, "$expand", expanded);
      return true;
    }
  );
}
