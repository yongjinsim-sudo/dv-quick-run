import { DataverseClient } from "./dataverseClient";

type ODataList<T> = { value?: T[] };

export type EntityDef = {
  entitySetName: string;
  logicalName: string;
};

function distinctSorted(defs: EntityDef[]): EntityDef[] {
  const map = new Map<string, EntityDef>(); // key: entitySetName
  for (const d of defs) {
    if (!d.entitySetName || !d.logicalName) {continue;}
    if (!map.has(d.entitySetName)) {map.set(d.entitySetName, d);}
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => a.entitySetName.localeCompare(b.entitySetName, undefined, { sensitivity: "base" }));
  return arr;
}

function extractEntityDefs(value: any[]): EntityDef[] {
  const defs =
    (value ?? [])
      .map(x => {
        const entitySetName = (x?.EntitySetName ?? x?.entitysetname ?? "").toString().trim();
        const logicalName = (x?.LogicalName ?? x?.logicalname ?? "").toString().trim();
        return { entitySetName, logicalName };
      })
      .filter(x => x.entitySetName && x.logicalName);

  return distinctSorted(defs);
}

async function tryGet(client: DataverseClient, token: string, path: string): Promise<EntityDef[]> {
  const r = await client.get(path, token) as ODataList<any>;
  return extractEntityDefs(r.value ?? []);
}

export async function fetchEntityDefs(
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {

  try {
    return await tryGet(
      client,
      token,
      "/EntityDefinitions?$select=EntitySetName,LogicalName&$filter=EntitySetName ne null"
    );
  } catch { /* continue */ }

  try {
    return await tryGet(
      client,
      token,
      "/EntityDefinitions?$select=EntitySetName,LogicalName&$top=5000"
    );
  } catch { /* continue */ }

  return await tryGet(
    client,
    token,
    "/EntityDefinitions?$top=500"
  );
}