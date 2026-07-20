import type { EntityMetadata, FieldMetadata } from "../../metadata/metadataModel.js";
import { buildLookupSelectToken, isLookupLikeAttributeType } from "../../metadata/metadataModel.js";
import type { QuerySemanticModel } from "../query/querySemanticModel.js";

export type LookupKind =
  | "SingleTarget"
  | "MultiTarget"
  | "Owner"
  | "Customer"
  | "Regarding"
  | "Unknown";

export type MetadataResolutionState = "Resolved" | "Partial" | "Unavailable";

export interface LookupRelationshipMetadata {
  readonly navigationPropertyName?: string;
  readonly schemaName?: string;
  readonly referencingAttribute?: string;
  readonly referencingEntity?: string;
  readonly referencedEntity?: string;
  readonly relationshipType?: string;
}

export interface NavigationPropertyUnderstanding {
  readonly name: string;
  readonly relationshipSchemaName?: string;
  readonly relationshipType: "ManyToOne";
  readonly direction: "Referencing";
  readonly validForExpand: true;
  readonly targetEntityLogicalName: string;
}

export interface LookupTargetUnderstanding {
  readonly entityLogicalName: string;
  readonly entitySetName?: string;
  readonly displayName?: string;
  readonly primaryNameAttribute?: string;
  readonly primaryNameAttributeState: "Unvalidated" | "Validated" | "Unavailable" | "NotApplicable";
  readonly navigationProperties: readonly NavigationPropertyUnderstanding[];
}

export interface LookupUnderstanding {
  readonly attributeLogicalName: string;
  readonly displayName?: string;
  readonly attributeType?: string;
  readonly lookupValueProperty: string;
  readonly kind: LookupKind;
  readonly targetEntities: readonly LookupTargetUnderstanding[];
  readonly directExpandSupported: false;
  readonly metadataState: MetadataResolutionState;
  readonly evidenceRefs: readonly string[];
  readonly limitations: readonly string[];
}

export interface QueryMetadataContext {
  readonly environmentLabel?: string;
  readonly entityLogicalName: string;
  readonly entitySetName?: string;
  readonly capturedAtIso: string;
  readonly state: MetadataResolutionState;
  readonly lookupUnderstandings: readonly LookupUnderstanding[];
  readonly referencedLookups: readonly LookupUnderstanding[];
  readonly knownNavigationProperties: readonly string[];
  readonly limitations: readonly string[];
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().toLowerCase();
}

function classifyLookup(field: FieldMetadata, targetCount: number): LookupKind {
  const type = normalize(field.attributeType);
  const logicalName = normalize(field.logicalName);
  if (type === "owner") {
    return "Owner";
  }
  if (type === "customer") {
    return "Customer";
  }
  if (logicalName === "regardingobjectid" || logicalName.startsWith("regarding")) {
    return "Regarding";
  }
  if (targetCount > 1) {
    return "MultiTarget";
  }
  return targetCount === 1 ? "SingleTarget" : "Unknown";
}

function isMultiTarget(kind: LookupKind): boolean {
  return kind === "MultiTarget" || kind === "Owner" || kind === "Customer" || kind === "Regarding";
}

function buildEntityMap(defs: readonly EntityMetadata[]): Map<string, EntityMetadata> {
  return new Map(defs.map((def) => [normalize(def.logicalName), def]));
}

export function buildLookupUnderstandings(input: {
  readonly sourceLogicalName: string;
  readonly fields: readonly FieldMetadata[];
  readonly relationships: readonly LookupRelationshipMetadata[];
  readonly entityDefinitions?: readonly EntityMetadata[];
  readonly primaryIdAttribute?: string;
}): LookupUnderstanding[] {
  const source = normalize(input.sourceLogicalName);
  const entities = buildEntityMap(input.entityDefinitions ?? []);
  const results: LookupUnderstanding[] = [];

  for (const field of input.fields) {
    if (!isLookupLikeAttributeType(field.attributeType) || normalize(field.logicalName) === normalize(input.primaryIdAttribute)) {
      continue;
    }

    const lookupValueProperty = buildLookupSelectToken(field.logicalName, field.attributeType);
    if (!lookupValueProperty) {
      continue;
    }

    const outbound = input.relationships.filter((relationship) =>
      normalize(relationship.referencingEntity) === source
      && normalize(relationship.referencingAttribute) === normalize(field.logicalName)
      && !!String(relationship.navigationPropertyName ?? "").trim()
      && !!String(relationship.referencedEntity ?? "").trim()
    );

    // Attribute targets can establish supported types, but at least one outbound
    // relationship is required before DVQR presents a lookup as query-expandable.
    if (!outbound.length) {
      continue;
    }

    const targetNames = new Set<string>();
    for (const target of field.lookupTargets ?? []) {
      if (normalize(target)) {
        targetNames.add(normalize(target));
      }
    }
    for (const relationship of outbound) {
      targetNames.add(normalize(relationship.referencedEntity));
    }

    const targetEntities = [...targetNames]
      .map((targetName): LookupTargetUnderstanding | undefined => {
        const relationships = outbound
          .filter((relationship) => normalize(relationship.referencedEntity) === targetName)
          .map((relationship): NavigationPropertyUnderstanding => ({
            name: String(relationship.navigationPropertyName).trim(),
            relationshipSchemaName: String(relationship.schemaName ?? "").trim() || undefined,
            relationshipType: "ManyToOne",
            direction: "Referencing",
            validForExpand: true,
            targetEntityLogicalName: String(relationship.referencedEntity).trim()
          }))
          .sort((a, b) => a.name.localeCompare(b.name));
        const entity = entities.get(targetName);
        const logicalName = entity?.logicalName ?? outbound.find((item) => normalize(item.referencedEntity) === targetName)?.referencedEntity ?? targetName;
        if (!relationships.length) {
          return undefined;
        }
        return {
          entityLogicalName: logicalName,
          entitySetName: entity?.entitySetName,
          displayName: entity?.displayName,
          primaryNameAttribute: entity?.primaryNameAttribute,
          primaryNameAttributeState: entity?.primaryNameAttribute ? "Unvalidated" : "Unavailable",
          navigationProperties: relationships
        };
      })
      .filter((target): target is LookupTargetUnderstanding => !!target)
      .sort((a, b) => a.entityLogicalName.localeCompare(b.entityLogicalName));

    if (!targetEntities.length) {
      continue;
    }

    const kind = classifyLookup(field, targetEntities.length);
    const missingEntityDetails = targetEntities.some((target) => !target.entitySetName || !target.primaryNameAttribute);
    results.push({
      attributeLogicalName: field.logicalName,
      displayName: field.displayName,
      attributeType: field.attributeType,
      lookupValueProperty,
      kind,
      targetEntities,
      directExpandSupported: false,
      metadataState: missingEntityDetails ? "Partial" : "Resolved",
      evidenceRefs: [
        `attribute:${input.sourceLogicalName}.${field.logicalName}`,
        ...outbound.map((relationship) => `relationship:${relationship.schemaName ?? relationship.navigationPropertyName}`)
      ],
      limitations: [
        ...(isMultiTarget(kind)
          ? ["Supported targets describe schema validity; they do not identify the target used by a particular row."]
          : []),
        ...(missingEntityDetails ? ["Some target table display, entity-set, or primary-name metadata was unavailable."] : [])
      ]
    });
  }

  return results.sort((a, b) =>
    (a.displayName ?? a.attributeLogicalName).localeCompare(b.displayName ?? b.attributeLogicalName)
  );
}

export function validateLookupTargetDisplayFields(
  lookup: LookupUnderstanding,
  fieldsByTargetLogicalName: ReadonlyMap<string, readonly FieldMetadata[]>
): LookupUnderstanding {
  const limitations = new Set(lookup.limitations);

  if (lookup.kind === "Owner") {
    limitations.add(
      "Owner navigation resolves through Dataverse's principal abstraction; DVQR does not assume a common nested display field."
    );
    return {
      ...lookup,
      targetEntities: lookup.targetEntities.map((target) => ({
        ...target,
        primaryNameAttribute: undefined,
        primaryNameAttributeState: "NotApplicable"
      })),
      limitations: [...limitations]
    };
  }

  const targetEntities = lookup.targetEntities.map((target): LookupTargetUnderstanding => {
    const candidate = target.primaryNameAttribute?.trim();
    const fields = fieldsByTargetLogicalName.get(normalize(target.entityLogicalName));
    const validated = candidate && fields?.some((field) =>
      normalize(field.logicalName) === normalize(candidate) && field.isValidForRead !== false
    );

    if (!validated) {
      limitations.add(
        `No nested display field was added for ${target.entityLogicalName} because target metadata did not validate its primary-name attribute.`
      );
      return {
        ...target,
        primaryNameAttribute: undefined,
        primaryNameAttributeState: "Unavailable"
      };
    }

    return {
      ...target,
      primaryNameAttribute: candidate,
      primaryNameAttributeState: "Validated"
    };
  });

  return {
    ...lookup,
    targetEntities,
    limitations: [...limitations]
  };
}

export function buildLookupReferenceText(lookup: LookupUnderstanding): string {
  const displayName = lookup.displayName ?? lookup.attributeLogicalName;
  const lines = [
    `${displayName} (${lookup.attributeLogicalName})`,
    `Type: ${isMultiTargetLookup(lookup) ? "Multi-target lookup" : "Single-target lookup"}`,
    `Value property: ${lookup.lookupValueProperty}`,
    "Targets:"
  ];

  for (const target of lookup.targetEntities) {
    lines.push(`- ${target.displayName ?? target.entityLogicalName} (${target.entityLogicalName})`);
    for (const navigation of target.navigationProperties) {
      lines.push(`  Navigation: ${navigation.name}`);
      lines.push(`  Expand: $expand=${navigation.name}`);
    }
    if (target.primaryNameAttributeState === "Validated" && target.primaryNameAttribute) {
      lines.push(`  Validated display field: ${target.primaryNameAttribute}`);
    }
  }

  lines.push(`Runtime target: ${lookup.lookupValueProperty}@Microsoft.Dynamics.CRM.lookuplogicalname`);
  lines.push(`Formatted value: ${lookup.lookupValueProperty}@OData.Community.Display.V1.FormattedValue`);
  lines.push(...lookup.limitations.map((limitation) => `Limitation: ${limitation}`));
  return lines.join("\n");
}

export function selectReferencedLookups(
  model: QuerySemanticModel,
  lookups: readonly LookupUnderstanding[]
): LookupUnderstanding[] {
  const referencedTokens = new Set<string>();
  for (const reference of [...model.selectedFields, ...model.filterReferences, ...model.orderByReferences]) {
    referencedTokens.add(normalize(reference.raw));
    referencedTokens.add(normalize(reference.fieldName));
  }
  for (const expand of model.expandedProperties) {
    referencedTokens.add(normalize(expand.navigationProperty));
  }

  return lookups.filter((lookup) => {
    if (referencedTokens.has(normalize(lookup.attributeLogicalName)) || referencedTokens.has(normalize(lookup.lookupValueProperty))) {
      return true;
    }
    return lookup.targetEntities.some((target) =>
      target.navigationProperties.some((navigation) => referencedTokens.has(normalize(navigation.name)))
    );
  });
}

export function buildQueryMetadataContext(input: {
  readonly model: QuerySemanticModel;
  readonly environmentLabel?: string;
  readonly entityLogicalName: string;
  readonly entitySetName?: string;
  readonly fields?: readonly FieldMetadata[];
  readonly relationships?: readonly LookupRelationshipMetadata[];
  readonly allNavigationProperties?: readonly string[];
  readonly entityDefinitions?: readonly EntityMetadata[];
  readonly primaryIdAttribute?: string;
  readonly limitations?: readonly string[];
  readonly capturedAtIso?: string;
}): QueryMetadataContext {
  const fieldsAvailable = !!input.fields;
  const relationshipsAvailable = !!input.relationships;
  const state: MetadataResolutionState = fieldsAvailable && relationshipsAvailable
    ? "Resolved"
    : fieldsAvailable || relationshipsAvailable
      ? "Partial"
      : "Unavailable";
  const lookupUnderstandings = fieldsAvailable && relationshipsAvailable
    ? buildLookupUnderstandings({
        sourceLogicalName: input.entityLogicalName,
        fields: input.fields ?? [],
        relationships: input.relationships ?? [],
        entityDefinitions: input.entityDefinitions,
        primaryIdAttribute: input.primaryIdAttribute
      })
    : [];

  return {
    environmentLabel: input.environmentLabel,
    entityLogicalName: input.entityLogicalName,
    entitySetName: input.entitySetName,
    capturedAtIso: input.capturedAtIso ?? new Date().toISOString(),
    state,
    lookupUnderstandings,
    referencedLookups: selectReferencedLookups(input.model, lookupUnderstandings),
    knownNavigationProperties: [...new Set((input.allNavigationProperties ?? input.relationships?.map((item) => item.navigationPropertyName ?? "") ?? [])
      .map((item) => item.trim())
      .filter(Boolean))].sort((a, b) => a.localeCompare(b)),
    limitations: [
      ...(input.limitations ?? []),
      ...(state === "Unavailable" ? ["Lookup and navigation-property metadata could not be resolved for the active environment."] : []),
      ...(state === "Partial" ? ["Lookup metadata is partial; unresolved targets or navigation properties are not guessed."] : [])
    ]
  };
}

export function isMultiTargetLookup(lookup: LookupUnderstanding): boolean {
  return lookup.targetEntities.length > 1 || isMultiTarget(lookup.kind);
}
