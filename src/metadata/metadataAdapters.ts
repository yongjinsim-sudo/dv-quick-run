import {
  ChoiceMetadata,
  ChoiceMetadataKind,
  ChoiceOptionMetadata,
  EntityMetadata,
  FieldMetadata,
  RelationshipMetadata,
  normalizeChoiceKind,
  normalizeChoiceLabel,
  normalizeMetadataBool,
  normalizeMetadataName,
  normalizeMetadataNumber,
  normalizeMetadataStringArray
} from "./metadataModel.js";

function distinctBy<T>(items: T[], keySelector: (item: T) => string): T[] {
  const map = new Map<string, T>();

  for (const item of items) {
    const key = keySelector(item).trim().toLowerCase();
    if (!key || map.has(key)) {
      continue;
    }

    map.set(key, item);
  }

  return Array.from(map.values());
}

function getLocalizedLabel(value: any): string | undefined {
  return normalizeMetadataName(value?.UserLocalizedLabel?.Label)
    ?? normalizeMetadataName(value?.LocalizedLabels?.[0]?.Label)
    ?? normalizeMetadataName(value?.label)
    ?? normalizeMetadataName(value?.Label)
    ?? normalizeMetadataName(value);
}

function normalizeChoiceOption(option: any): ChoiceOptionMetadata | undefined {
  const value = normalizeMetadataNumber(option?.Value ?? option?.value);
  const label = getLocalizedLabel(option?.Label ?? option?.label);

  if (value === undefined || !label) {
    return undefined;
  }

  return {
    value,
    label,
    normalizedLabel: normalizeChoiceLabel(label)
  };
}

function normalizeBooleanChoiceOption(option: any): ChoiceOptionMetadata | undefined {
  const rawValue = option?.Value ?? option?.value;
  const label = getLocalizedLabel(option?.Label ?? option?.label);

  let value: boolean | undefined;
  if (typeof rawValue === "boolean") {
    value = rawValue;
  } else {
    const numeric = normalizeMetadataNumber(rawValue);
    if (numeric === 0) {
      value = false;
    } else if (numeric === 1) {
      value = true;
    }
  }

  if (value === undefined || !label) {
    return undefined;
  }

  return {
    value,
    label,
    normalizedLabel: normalizeChoiceLabel(label)
  };
}

function normalizeChoiceOptions(options: any[]): ChoiceOptionMetadata[] {
  const normalized = (options ?? [])
    .map((option) => normalizeChoiceOption(option))
    .filter((option): option is ChoiceOptionMetadata => !!option);

  return distinctBy(normalized, (option) => String(option.value)).sort((a, b) => Number(a.value) - Number(b.value));
}

function normalizeBooleanChoiceOptions(attribute: any): ChoiceOptionMetadata[] {
  const candidates = [
    attribute?.OptionSet?.FalseOption,
    attribute?.OptionSet?.TrueOption,
    attribute?.FalseOption,
    attribute?.TrueOption
  ].filter(Boolean);

  const normalized = candidates
    .map((option) => normalizeBooleanChoiceOption(option))
    .filter((option): option is ChoiceOptionMetadata => !!option);

  if (normalized.length) {
    return distinctBy(normalized, (option) => String(option.value));
  }

  return normalizeChoiceOptions(attribute?.OptionSet?.Options ?? attribute?.options ?? []);
}

function buildChoiceMetadata(
  attribute: any,
  entityLogicalName: string,
  kind: ChoiceMetadataKind
): ChoiceMetadata | undefined {
  const fieldLogicalName = normalizeMetadataName(attribute?.LogicalName ?? attribute?.logicalname);
  if (!fieldLogicalName) {
    return undefined;
  }

  const options = kind === "boolean"
    ? normalizeBooleanChoiceOptions(attribute)
    : normalizeChoiceOptions(
      attribute?.OptionSet?.Options
      ?? attribute?.GlobalOptionSet?.Options
      ?? attribute?.options
      ?? []
    );

  if (!options.length) {
    return undefined;
  }

  return {
    entityLogicalName,
    fieldLogicalName,
    attributeType: normalizeMetadataName(attribute?.AttributeType ?? attribute?.attributetype),
    kind,
    globalChoiceName: normalizeMetadataName(
      attribute?.GlobalOptionSet?.Name
      ?? attribute?.OptionSet?.Name
      ?? attribute?.GlobalOptionSetName
    ),
    options
  };
}

export function normalizeEntityMetadataList(value: any[]): EntityMetadata[] {
  const normalized = (value ?? [])
    .map((item): EntityMetadata | undefined => {
      const entitySetName = normalizeMetadataName(item?.EntitySetName ?? item?.entitysetname);
      const logicalName = normalizeMetadataName(item?.LogicalName ?? item?.logicalname);

      if (!entitySetName || !logicalName) {
        return undefined;
      }

      return {
        entitySetName,
        logicalName,
        displayName:
          normalizeMetadataName(item?.DisplayName?.UserLocalizedLabel?.Label) ??
          normalizeMetadataName(item?.displayname?.userlocalizedlabel?.label),
        primaryIdAttribute: normalizeMetadataName(item?.PrimaryIdAttribute ?? item?.primaryidattribute),
        primaryNameAttribute: normalizeMetadataName(item?.PrimaryNameAttribute ?? item?.primarynameattribute)
      };
    })
    .filter((item): item is EntityMetadata => !!item);

  return distinctBy(normalized, (item) => item.entitySetName).sort((a, b) =>
    a.entitySetName.localeCompare(b.entitySetName, undefined, { sensitivity: "base" })
  );
}

export function normalizeFieldMetadataList(value: any[]): FieldMetadata[] {
  const normalized = (value ?? [])
    .map((attribute): FieldMetadata | undefined => {
      const logicalName = normalizeMetadataName(attribute?.LogicalName ?? attribute?.logicalname);
      if (!logicalName) {
        return undefined;
      }

      return {
        logicalName,
        attributeType: normalizeMetadataName(attribute?.AttributeType ?? attribute?.attributetype),
        attributeOf: normalizeMetadataName(attribute?.AttributeOf ?? attribute?.attributeof),
        schemaName: normalizeMetadataName(attribute?.SchemaName ?? attribute?.schemaname),
        displayName:
          normalizeMetadataName(attribute?.DisplayName?.UserLocalizedLabel?.Label) ??
          normalizeMetadataName(attribute?.displayname?.userlocalizedlabel?.label),
        isValidForRead: normalizeMetadataBool(
          attribute?.IsValidForRead ?? attribute?.isvalidforread ?? attribute?.validforreadapi,
          true
        ),
        isValidForCreate: normalizeMetadataBool(
          attribute?.IsValidForCreate ?? attribute?.isvalidforcreate,
          true
        ),
        isValidForUpdate: normalizeMetadataBool(
          attribute?.IsValidForUpdate ?? attribute?.isvalidforupdate,
          true
        ),
        lookupTargets: normalizeMetadataStringArray(attribute?.Targets ?? attribute?.targets)
      };
    })
    .filter((item): item is FieldMetadata => !!item);

  return distinctBy(normalized, (item) => item.logicalName).sort((a, b) =>
    a.logicalName.localeCompare(b.logicalName, undefined, { sensitivity: "base" })
  );
}

export function normalizeChoiceMetadataList(value: any[], entityLogicalName: string): ChoiceMetadata[] {
  const normalized = (value ?? [])
    .map((attribute): ChoiceMetadata | undefined => {
      const kind = normalizeChoiceKind(attribute?.AttributeType ?? attribute?.attributetype);
      if (!kind) {
        return undefined;
      }

      return buildChoiceMetadata(attribute, entityLogicalName, kind);
    })
    .filter((item): item is ChoiceMetadata => !!item);

  return distinctBy(normalized, (item) => item.fieldLogicalName).sort((a, b) =>
    a.fieldLogicalName.localeCompare(b.fieldLogicalName, undefined, { sensitivity: "base" })
  );
}

export function normalizeRelationshipMetadataList(value: any[], logicalName: string): RelationshipMetadata[] {
  const normalized: RelationshipMetadata[] = [];
  const currentLogicalName = logicalName.trim().toLowerCase();

  for (const item of value ?? []) {
    const m2oNavigation = normalizeMetadataName(item?.ReferencingEntityNavigationPropertyName);
    if (m2oNavigation) {
      normalized.push({
        navigationPropertyName: m2oNavigation,
        relationshipType: "ManyToOne",
        referencingAttribute: normalizeMetadataName(item?.ReferencingAttribute),
        referencedEntity: normalizeMetadataName(item?.ReferencedEntity),
        referencingEntity: normalizeMetadataName(item?.ReferencingEntity),
        schemaName: normalizeMetadataName(item?.SchemaName)
      });
      continue;
    }

    const o2mNavigation = normalizeMetadataName(item?.ReferencedEntityNavigationPropertyName);
    if (o2mNavigation) {
      normalized.push({
        navigationPropertyName: o2mNavigation,
        relationshipType: "OneToMany",
        referencingAttribute: normalizeMetadataName(item?.ReferencingAttribute),
        referencedEntity: normalizeMetadataName(item?.ReferencedEntity),
        referencingEntity: normalizeMetadataName(item?.ReferencingEntity),
        schemaName: normalizeMetadataName(item?.SchemaName)
      });
      continue;
    }

    const entity1LogicalName = normalizeMetadataName(item?.Entity1LogicalName);
    const entity2LogicalName = normalizeMetadataName(item?.Entity2LogicalName);
    const entity1Navigation = normalizeMetadataName(item?.Entity1NavigationPropertyName);
    const entity2Navigation = normalizeMetadataName(item?.Entity2NavigationPropertyName);
    const schemaName = normalizeMetadataName(item?.SchemaName);

    if (entity1LogicalName?.toLowerCase() === currentLogicalName && entity1Navigation) {
      normalized.push({
        navigationPropertyName: entity1Navigation,
        relationshipType: "ManyToMany",
        referencingEntity: entity1LogicalName,
        referencedEntity: entity2LogicalName,
        schemaName
      });
    }

    if (entity2LogicalName?.toLowerCase() === currentLogicalName && entity2Navigation) {
      normalized.push({
        navigationPropertyName: entity2Navigation,
        relationshipType: "ManyToMany",
        referencingEntity: entity2LogicalName,
        referencedEntity: entity1LogicalName,
        schemaName
      });
    }
  }

  return distinctBy(normalized, (item) => item.navigationPropertyName).sort((a, b) =>
    a.navigationPropertyName.localeCompare(b.navigationPropertyName, undefined, { sensitivity: "base" })
  );
}
