import type { FieldDef } from "../../../../services/entityFieldMetadataService.js";
import type { EntityRelationshipExplorerResult } from "../../../../services/entityRelationshipExplorerService.js";
import {
  buildLookupUnderstandings,
  isMultiTargetLookup,
  type LookupUnderstanding,
  type QueryMetadataContext
} from "../../../../core/metadata/lookupUnderstanding.js";

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
  metadataState?: "Resolved" | "Partial" | "Unavailable";
  limitations?: string[];
  evidenceRefs?: string[];
  environmentLabel?: string;
  capturedAtIso?: string;
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
  const understandings = buildLookupUnderstandings({
    sourceLogicalName: relationships.logicalName,
    fields,
    relationships: relationships.manyToOne.map((relationship) => ({
      ...relationship,
      referencingEntity: relationship.referencingEntity ?? relationships.logicalName,
      relationshipType: "ManyToOne"
    })),
    entityDefinitions: relationships.manyToOne
      .map((relationship) => relationship.referencedEntity)
      .filter((logicalName): logicalName is string => !!logicalName)
      .map((logicalName) => ({ logicalName, entitySetName: logicalName }))
  });
  return understandings
    .filter((lookup) => selected.has(normalize(lookup.lookupValueProperty)))
    .map(toExplainLookupUnderstanding)
    .sort((a, b) => a.selectedProperty.localeCompare(b.selectedProperty));
}

function toExplainLookupUnderstanding(lookup: LookupUnderstanding): ExplainLookupUnderstanding {
  return {
    selectedProperty: lookup.lookupValueProperty,
    attributeLogicalName: lookup.attributeLogicalName,
    displayName: lookup.displayName,
    attributeType: lookup.attributeType,
    kind: isMultiTargetLookup(lookup) ? "polymorphic" : "standard",
    targets: lookup.targetEntities.flatMap((target) =>
      target.navigationProperties.map((navigation) => ({
        logicalName: target.entityLogicalName,
        navigationProperty: navigation.name
      }))
    ),
    logicalNameAnnotation: `${lookup.lookupValueProperty}@Microsoft.Dynamics.CRM.lookuplogicalname`,
    formattedValueAnnotation: `${lookup.lookupValueProperty}@OData.Community.Display.V1.FormattedValue`,
    metadataState: lookup.metadataState,
    limitations: [...lookup.limitations],
    evidenceRefs: [...lookup.evidenceRefs]
  };
}

export function buildExplainLookupUnderstandingFromContext(context: QueryMetadataContext): ExplainLookupUnderstanding[] {
  return context.referencedLookups.map((lookup) => ({
    ...toExplainLookupUnderstanding(lookup),
    environmentLabel: context.environmentLabel,
    capturedAtIso: context.capturedAtIso
  }));
}

export function buildLookupUnderstandingLines(items: ExplainLookupUnderstanding[]): string[] {
  const lines: string[] = [];

  for (const item of items) {
    const title = item.displayName?.trim()
      ? `${item.displayName.trim()} (${item.attributeLogicalName})`
      : item.attributeLogicalName;

    lines.push(`#### ${title}`);
    lines.push(`- Selected Web API property: \`${item.selectedProperty}\``);
    lines.push(`- Type: **${item.kind === "polymorphic" ? "Polymorphic lookup" : "Standard lookup"}**`);
    lines.push(`- Dataverse attribute type: \`${item.attributeType ?? "Lookup"}\``);
    if (item.metadataState) {
      lines.push(`- Metadata confidence: **${item.metadataState}**`);
    }
    if (item.environmentLabel) {
      lines.push(`- Metadata environment: **${item.environmentLabel}**`);
    }
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
      lines.push("- Runtime boundary: a supported target is not proof that the current row references that target; a valid target-specific expansion can therefore return null.");
    } else {
      lines.push("- Practical reading: this lookup resolves to one target table and uses the navigation property above for $expand.");
    }
    for (const limitation of item.limitations ?? []) {
      lines.push(`- Limitation: ${limitation}`);
    }
    if (item.evidenceRefs?.length) {
      lines.push(`- Metadata evidence: ${item.evidenceRefs.map((reference) => `\`${reference}\``).join(", ")}`);
    }
  }

  return lines;
}
