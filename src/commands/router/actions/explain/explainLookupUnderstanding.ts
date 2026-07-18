import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import type { EntityRelationshipExplorerResult } from "../../../../services/entityRelationshipExplorerService.js";
import { buildLookupSelectToken, isLookupLikeAttributeType } from "../../../../metadata/metadataModel.js";

export type ExplainLookupTarget = {
  logicalName: string;
  navigationProperty: string;
};

export type ExplainLookupUnderstanding = {
  selectedProperty: string;
  attributeLogicalName: string;
  displayName?: string;
  attributeType?: string;
  kind: "standard" | "polymorphic";
  targets: ExplainLookupTarget[];
  logicalNameAnnotation: string;
  formattedValueAnnotation: string;
};

function normalize(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildExplainLookupUnderstanding(
  selectedFields: string[],
  fields: FieldDef[],
  relationships: EntityRelationshipExplorerResult | undefined
): ExplainLookupUnderstanding[] {
  if (!selectedFields.length || !fields.length || !relationships) {
    return [];
  }

  const selected = new Set(selectedFields.map(normalize));
  const results: ExplainLookupUnderstanding[] = [];

  for (const field of fields) {
    if (!isLookupLikeAttributeType(field.attributeType)) {
      continue;
    }

    const selectToken = buildLookupSelectToken(field.logicalName, field.attributeType);
    if (!selectToken || !selected.has(normalize(selectToken))) {
      continue;
    }

    const relationshipMatches = relationships.manyToOne
      .filter((relationship) => normalize(relationship.referencingAttribute) === normalize(field.logicalName))
      .map((relationship) => ({
        logicalName: relationship.referencedEntity?.trim() ?? "",
        navigationProperty: relationship.navigationPropertyName.trim()
      }))
      .filter((target) => !!target.logicalName && !!target.navigationProperty);

    const targetMap = new Map<string, ExplainLookupTarget>();
    for (const target of relationshipMatches) {
      targetMap.set(`${normalize(target.logicalName)}|${normalize(target.navigationProperty)}`, target);
    }

    // Field targets are useful as a fallback, but relationship metadata remains authoritative
    // for navigation-property names required by OData $expand.
    const targets = [...targetMap.values()].sort((a, b) =>
      a.logicalName.localeCompare(b.logicalName, undefined, { sensitivity: "base" })
    );

    if (!targets.length) {
      continue;
    }

    results.push({
      selectedProperty: selectToken,
      attributeLogicalName: field.logicalName,
      displayName: field.displayName,
      attributeType: field.attributeType,
      kind: targets.length > 1 ? "polymorphic" : "standard",
      targets,
      logicalNameAnnotation: `${selectToken}@Microsoft.Dynamics.CRM.lookuplogicalname`,
      formattedValueAnnotation: `${selectToken}@OData.Community.Display.V1.FormattedValue`
    });
  }

  return results.sort((a, b) => a.selectedProperty.localeCompare(b.selectedProperty));
}

export function buildLookupUnderstandingLines(items: ExplainLookupUnderstanding[]): string[] {
  const lines: string[] = [];

  for (const item of items) {
    const title = item.displayName?.trim()
      ? `${item.displayName.trim()} (${item.attributeLogicalName})`
      : item.attributeLogicalName;

    lines.push(`### ${title}`);
    lines.push(`- Selected Web API property: \`${item.selectedProperty}\``);
    lines.push(`- Type: **${item.kind === "polymorphic" ? "Polymorphic lookup" : "Standard lookup"}**`);
    lines.push(`- Dataverse attribute type: \`${item.attributeType ?? "Lookup"}\``);
    lines.push("- Supported targets:");

    for (const target of item.targets) {
      lines.push(`  - \`${target.logicalName}\``);
      lines.push(`    - Navigation property: \`${target.navigationProperty}\``);
      lines.push(`    - Expand example: \`$expand=${target.navigationProperty}\``);
    }

    lines.push(`- Runtime target annotation: \`${item.logicalNameAnnotation}\``);
    lines.push(`- Formatted value annotation: \`${item.formattedValueAnnotation}\``);

    if (item.kind === "polymorphic") {
      lines.push("- Practical reading: one lookup value property can reference different table types; use the runtime target annotation to identify which target is active for each row.");
    } else {
      lines.push("- Practical reading: this lookup resolves to one target table and uses the navigation property above for $expand.");
    }
  }

  return lines;
}
