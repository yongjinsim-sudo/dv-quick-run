import {
  EntityMetadata,
  FieldMetadata,
  RelationshipMetadata,
  normalizeMetadataBool,
  normalizeMetadataName,
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
