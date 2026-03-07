import { DataverseClient } from "./dataverseClient.js";

export type ManyToOneRelationshipDef = {
  navigationPropertyName: string;
  schemaName?: string;
  referencingAttribute?: string;
  referencingEntity?: string;
  referencedEntity?: string;
};

export type OneToManyRelationshipDef = {
  navigationPropertyName: string;
  schemaName?: string;
  referencingAttribute?: string;
  referencingEntity?: string;
  referencedEntity?: string;
};

export type ManyToManyRelationshipDef = {
  navigationPropertyName: string;
  schemaName?: string;
  entity1LogicalName?: string;
  entity2LogicalName?: string;
  targetEntity?: string;
};

export type EntityRelationshipExplorerResult = {
  logicalName: string;
  manyToOne: ManyToOneRelationshipDef[];
  oneToMany: OneToManyRelationshipDef[];
  manyToMany: ManyToManyRelationshipDef[];
};

type ODataList<T> = { value?: T[] };

function asTrimmed(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
}

function sortByNavName<T extends { navigationPropertyName: string }>(items: T[]): T[] {
  return [...items].sort((a, b) =>
    a.navigationPropertyName.localeCompare(b.navigationPropertyName, undefined, {
      sensitivity: "base"
    })
  );
}

export async function fetchEntityRelationships(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<EntityRelationshipExplorerResult> {
  const safeLogicalName = logicalName.replace(/'/g, "''");

  const [m2oRes, o2mRes, m2mRes] = await Promise.all([
    client.get(
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToOneRelationships` +
        `?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencingEntityNavigationPropertyName`,
      token
    ) as Promise<ODataList<any>>,
    client.get(
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/OneToManyRelationships` +
        `?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedEntityNavigationPropertyName`,
      token
    ) as Promise<ODataList<any>>,
    client.get(
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToManyRelationships` +
        `?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName`,
      token
    ) as Promise<ODataList<any>>
  ]);

  const manyToOne: ManyToOneRelationshipDef[] = (m2oRes.value ?? [])
    .map((x) => ({
      navigationPropertyName: asTrimmed(x?.ReferencingEntityNavigationPropertyName) ?? "",
      schemaName: asTrimmed(x?.SchemaName),
      referencingAttribute: asTrimmed(x?.ReferencingAttribute),
      referencingEntity: asTrimmed(x?.ReferencingEntity),
      referencedEntity: asTrimmed(x?.ReferencedEntity)
    }))
    .filter((x) => !!x.navigationPropertyName);

  const oneToMany: OneToManyRelationshipDef[] = (o2mRes.value ?? [])
    .map((x) => ({
      navigationPropertyName: asTrimmed(x?.ReferencedEntityNavigationPropertyName) ?? "",
      schemaName: asTrimmed(x?.SchemaName),
      referencingAttribute: asTrimmed(x?.ReferencingAttribute),
      referencingEntity: asTrimmed(x?.ReferencingEntity),
      referencedEntity: asTrimmed(x?.ReferencedEntity)
    }))
    .filter((x) => !!x.navigationPropertyName);

  const manyToMany: ManyToManyRelationshipDef[] = [];

  for (const x of m2mRes.value ?? []) {
    const entity1LogicalName = asTrimmed(x?.Entity1LogicalName);
    const entity2LogicalName = asTrimmed(x?.Entity2LogicalName);
    const entity1NavigationPropertyName = asTrimmed(x?.Entity1NavigationPropertyName);
    const entity2NavigationPropertyName = asTrimmed(x?.Entity2NavigationPropertyName);
    const schemaName = asTrimmed(x?.SchemaName);

    if (entity1LogicalName?.toLowerCase() === logicalName.toLowerCase() && entity1NavigationPropertyName) {
      manyToMany.push({
        navigationPropertyName: entity1NavigationPropertyName,
        schemaName,
        entity1LogicalName,
        entity2LogicalName,
        targetEntity: entity2LogicalName
      });
    }

    if (entity2LogicalName?.toLowerCase() === logicalName.toLowerCase() && entity2NavigationPropertyName) {
      manyToMany.push({
        navigationPropertyName: entity2NavigationPropertyName,
        schemaName,
        entity1LogicalName,
        entity2LogicalName,
        targetEntity: entity1LogicalName
      });
    }
  }

  return {
    logicalName,
    manyToOne: sortByNavName(manyToOne),
    oneToMany: sortByNavName(oneToMany),
    manyToMany: sortByNavName(manyToMany)
  };
}