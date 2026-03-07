import { DataverseClient } from "./dataverseClient.js";

export type NavPropertyDef = {
  navigationPropertyName: string;
  relationshipType: "ManyToOne" | "OneToMany" | "ManyToMany";
  referencingAttribute?: string;
  referencedEntity?: string;
  referencingEntity?: string;
  schemaName?: string;
};

type ODataList<T> = { value?: T[] };

function asTrimmed(value: unknown): string | undefined {
  const s = String(value ?? "").trim();
  return s || undefined;
}

function dedupe(items: NavPropertyDef[]): NavPropertyDef[] {
  const map = new Map<string, NavPropertyDef>();

  for (const item of items) {
    const key = item.navigationPropertyName.trim().toLowerCase();
    if (!key) {
      continue;
    }

    if (!map.has(key)) {
      map.set(key, item);
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.navigationPropertyName.localeCompare(b.navigationPropertyName, undefined, { sensitivity: "base" })
  );
}

async function getManyToOne(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavPropertyDef[]> {
  const path =
    `/EntityDefinitions(LogicalName='${logicalName.replace(/'/g, "''")}')/ManyToOneRelationships` +
    `?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencingEntityNavigationPropertyName`;

  const response = (await client.get(path, token)) as ODataList<any>;
  const rows = Array.isArray(response?.value) ? response.value : [];

  return rows
    .map((x): NavPropertyDef | undefined => {
      const navigationPropertyName = asTrimmed(x?.ReferencingEntityNavigationPropertyName);
      if (!navigationPropertyName) {
        return undefined;
      }

      return {
        navigationPropertyName,
        relationshipType: "ManyToOne",
        referencingAttribute: asTrimmed(x?.ReferencingAttribute),
        referencedEntity: asTrimmed(x?.ReferencedEntity),
        referencingEntity: asTrimmed(x?.ReferencingEntity),
        schemaName: asTrimmed(x?.SchemaName)
      };
    })
    .filter((x): x is NavPropertyDef => !!x);
}

async function getOneToMany(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavPropertyDef[]> {
  const path =
    `/EntityDefinitions(LogicalName='${logicalName.replace(/'/g, "''")}')/OneToManyRelationships` +
    `?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedEntityNavigationPropertyName`;

  const response = (await client.get(path, token)) as ODataList<any>;
  const rows = Array.isArray(response?.value) ? response.value : [];

  return rows
    .map((x): NavPropertyDef | undefined => {
      const navigationPropertyName = asTrimmed(x?.ReferencedEntityNavigationPropertyName);
      if (!navigationPropertyName) {
        return undefined;
      }

      return {
        navigationPropertyName,
        relationshipType: "OneToMany",
        referencingAttribute: asTrimmed(x?.ReferencingAttribute),
        referencedEntity: asTrimmed(x?.ReferencedEntity),
        referencingEntity: asTrimmed(x?.ReferencingEntity),
        schemaName: asTrimmed(x?.SchemaName)
      };
    })
    .filter((x): x is NavPropertyDef => !!x);
}

async function getManyToMany(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavPropertyDef[]> {
  const path =
    `/EntityDefinitions(LogicalName='${logicalName.replace(/'/g, "''")}')/ManyToManyRelationships` +
    `?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName`;

  const response = (await client.get(path, token)) as ODataList<any>;
  const rows = Array.isArray(response?.value) ? response.value : [];

  const results: NavPropertyDef[] = [];

  for (const x of rows) {
    const entity1LogicalName = asTrimmed(x?.Entity1LogicalName);
    const entity2LogicalName = asTrimmed(x?.Entity2LogicalName);
    const entity1Nav = asTrimmed(x?.Entity1NavigationPropertyName);
    const entity2Nav = asTrimmed(x?.Entity2NavigationPropertyName);
    const schemaName = asTrimmed(x?.SchemaName);

    if (entity1LogicalName?.toLowerCase() === logicalName.toLowerCase() && entity1Nav) {
      results.push({
        navigationPropertyName: entity1Nav,
        relationshipType: "ManyToMany",
        referencingEntity: entity1LogicalName,
        referencedEntity: entity2LogicalName,
        schemaName
      });
    }

    if (entity2LogicalName?.toLowerCase() === logicalName.toLowerCase() && entity2Nav) {
      results.push({
        navigationPropertyName: entity2Nav,
        relationshipType: "ManyToMany",
        referencingEntity: entity2LogicalName,
        referencedEntity: entity1LogicalName,
        schemaName
      });
    }
  }

  return results;
}

export async function fetchEntityNavigationProperties(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavPropertyDef[]> {
  const [m2o, o2m, m2m] = await Promise.all([
    getManyToOne(client, token, logicalName).catch(() => []),
    getOneToMany(client, token, logicalName).catch(() => []),
    getManyToMany(client, token, logicalName).catch(() => [])
  ]);

  return dedupe([...m2o, ...o2m, ...m2m]);
}