import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { EntityRelationshipExplorerResult } from "../../services/entityRelationshipExplorerService.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type {
  EntityMetadataSnapshotPayload,
  SnapshotAttributeMetadata,
  SnapshotEntityConfigurationMetadata,
  SnapshotEntityMetadata,
  SnapshotOptionMetadata,
  SnapshotOptionSetMetadata,
  SnapshotRelationshipMetadata
} from "./comparisonSnapshotTypes.js";

export function buildEntityMetadataSnapshotPayload(args: {
  readonly entityLogicalName: string;
  readonly entityDisplayName?: string;
  readonly fields: readonly FieldDef[];
  readonly choices: readonly ChoiceMetadataDef[];
  readonly relationships: EntityRelationshipExplorerResult | undefined;
  readonly configuration?: SnapshotEntityConfigurationMetadata;
  readonly capturedAt?: Date;
}): EntityMetadataSnapshotPayload | undefined {
  const logicalName = normalizeString(args.entityLogicalName);
  if (!logicalName) {
    return undefined;
  }

  const entity: SnapshotEntityMetadata = {
    metadataVersion: "entity-metadata-v1",
    logicalName,
    displayName: normalizeString(args.entityDisplayName),
    capturedAtIso: (args.capturedAt ?? new Date()).toISOString(),
    configuration: normalizeEntityConfiguration(args.configuration),
    attributes: buildSnapshotAttributes(args.fields, args.choices),
    relationships: buildSnapshotRelationships(args.relationships)
  };

  return {
    metadataVersion: "entity-metadata-payload-v1",
    entities: [entity]
  };
}


function normalizeEntityConfiguration(
  configuration: SnapshotEntityConfigurationMetadata | undefined
): SnapshotEntityConfigurationMetadata | undefined {
  if (!configuration) {
    return undefined;
  }

  const normalized = pruneUndefined({
    entitySetName: normalizeString(configuration.entitySetName),
    ownershipType: normalizeString(configuration.ownershipType),
    isAuditEnabled: normalizeBoolean(configuration.isAuditEnabled),
    changeTrackingEnabled: normalizeBoolean(configuration.changeTrackingEnabled),
    isActivity: normalizeBoolean(configuration.isActivity),
    isCustomEntity: normalizeBoolean(configuration.isCustomEntity),
    isManaged: normalizeBoolean(configuration.isManaged),
    isValidForAdvancedFind: normalizeBoolean(configuration.isValidForAdvancedFind)
  });

  return Object.keys(normalized).length ? normalized : undefined;
}

function buildSnapshotAttributes(
  fields: readonly FieldDef[],
  choices: readonly ChoiceMetadataDef[]
): readonly SnapshotAttributeMetadata[] {
  const choicesByField = new Map<string, ChoiceMetadataDef>();
  for (const choice of choices) {
    const key = normalizeKey(choice.fieldLogicalName);
    if (key) {
      choicesByField.set(key, choice);
    }
  }

  return fields
    .map((field): SnapshotAttributeMetadata | undefined => {
      const logicalName = normalizeString(field.logicalName);
      if (!logicalName) {
        return undefined;
      }

      const choice = choicesByField.get(normalizeKey(logicalName));
      return pruneUndefined({
        logicalName,
        schemaName: normalizeString(field.schemaName),
        displayName: normalizeString(field.displayName),
        attributeType: normalizeString(field.attributeType),
        attributeOf: normalizeString(field.attributeOf),
        requiredLevel: normalizeString(field.requiredLevel),
        isValidForCreate: field.isValidForCreate,
        isValidForUpdate: field.isValidForUpdate,
        isValidForRead: field.isValidForRead,
        isValidForAdvancedFind: field.isValidForAdvancedFind,
        maxLength: normalizeNumber(field.maxLength),
        precision: normalizeNumber(field.precision),
        scale: normalizeNumber(field.scale),
        format: normalizeString(field.format),
        targets: normalizeStringArray(field.lookupTargets),
        isSearchable: normalizeBoolean(field.isSearchable),
        isAuditEnabled: normalizeBoolean(field.isAuditEnabled),
        description: normalizeString(field.description),
        optionSet: choice ? buildSnapshotOptionSet(choice) : undefined
      });
    })
    .filter((attribute): attribute is SnapshotAttributeMetadata => Boolean(attribute))
    .sort((left, right) => left.logicalName.localeCompare(right.logicalName, undefined, { sensitivity: "base" }));
}

function buildSnapshotOptionSet(choice: ChoiceMetadataDef): SnapshotOptionSetMetadata {
  return pruneUndefined({
    name: normalizeString(choice.globalChoiceName ?? choice.optionSetName),
    isGlobal: Boolean(choice.globalChoiceName),
    isMultiSelect: choice.kind === "multiselectpicklist",
    options: choice.options.map((option): SnapshotOptionMetadata => pruneUndefined({
      value: option.value,
      label: normalizeString(option.label),
      normalizedLabel: normalizeString(option.normalizedLabel),
      color: normalizeString(option.color),
      externalValue: normalizeString(option.externalValue)
    }))
  });
}

function buildSnapshotRelationships(
  relationships: EntityRelationshipExplorerResult | undefined
): readonly SnapshotRelationshipMetadata[] {
  if (!relationships) {
    return [];
  }

  const items: SnapshotRelationshipMetadata[] = [];

  for (const relationship of relationships.manyToOne) {
    items.push(pruneUndefined({
      schemaName: normalizeString(relationship.schemaName) ?? relationship.navigationPropertyName,
      relationshipType: "ManyToOne" as const,
      referencingEntity: normalizeString(relationship.referencingEntity),
      referencedEntity: normalizeString(relationship.referencedEntity),
      referencingAttribute: normalizeString(relationship.referencingAttribute),
      navigationPropertyName: normalizeString(relationship.navigationPropertyName),
      cascadeConfiguration: normalizeRecordOfStrings((relationship as Record<string, unknown>).cascadeConfiguration),
      associatedMenuConfiguration: normalizeRecord((relationship as Record<string, unknown>).associatedMenuConfiguration)
    }));
  }

  for (const relationship of relationships.oneToMany) {
    items.push(pruneUndefined({
      schemaName: normalizeString(relationship.schemaName) ?? relationship.navigationPropertyName,
      relationshipType: "OneToMany" as const,
      referencingEntity: normalizeString(relationship.referencingEntity),
      referencedEntity: normalizeString(relationship.referencedEntity),
      referencingAttribute: normalizeString(relationship.referencingAttribute),
      navigationPropertyName: normalizeString(relationship.navigationPropertyName),
      cascadeConfiguration: normalizeRecordOfStrings((relationship as Record<string, unknown>).cascadeConfiguration),
      associatedMenuConfiguration: normalizeRecord((relationship as Record<string, unknown>).associatedMenuConfiguration)
    }));
  }

  for (const relationship of relationships.manyToMany) {
    items.push(pruneUndefined({
      schemaName: normalizeString(relationship.schemaName) ?? relationship.navigationPropertyName,
      relationshipType: "ManyToMany" as const,
      referencingEntity: normalizeString(relationship.entity1LogicalName),
      referencedEntity: normalizeString(relationship.targetEntity ?? relationship.entity2LogicalName),
      navigationPropertyName: normalizeString(relationship.navigationPropertyName),
      intersectEntityName: normalizeString((relationship as Record<string, unknown>).intersectEntityName),
      associatedMenuConfiguration: normalizeRecord((relationship as Record<string, unknown>).associatedMenuConfiguration)
    }));
  }

  return items.sort((left, right) => {
    const leftKey = `${left.relationshipType}:${left.schemaName}:${left.navigationPropertyName ?? ""}`;
    const rightKey = `${right.relationshipType}:${right.schemaName}:${right.navigationPropertyName ?? ""}`;
    return leftKey.localeCompare(rightKey, undefined, { sensitivity: "base" });
  });
}

function pruneUndefined<T extends Record<string, unknown>>(value: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    if (item !== undefined) {
      result[key] = item;
    }
  }

  return result as T;
}

function normalizeString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function normalizeKey(value: unknown): string {
  return normalizeString(value)?.toLowerCase() ?? "";
}

function normalizeNumber(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number(value.trim());
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function normalizeStringArray(value: readonly string[] | undefined): readonly string[] | undefined {
  const items = (value ?? [])
    .map((item) => normalizeString(item))
    .filter((item): item is string => Boolean(item));
  return items.length ? [...new Set(items)].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" })) : undefined;
}

function normalizeRecord(value: unknown): Readonly<Record<string, unknown>> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Readonly<Record<string, unknown>>;
}

function normalizeRecordOfStrings(value: unknown): Readonly<Record<string, string>> | undefined {
  const record = normalizeRecord(value);
  if (!record) {
    return undefined;
  }

  const normalized: Record<string, string> = {};
  for (const [key, item] of Object.entries(record)) {
    const normalizedValue = normalizeString(item);
    if (normalizedValue) {
      normalized[key] = normalizedValue;
    }
  }

  return Object.keys(normalized).length ? normalized : undefined;
}
