import { DataverseClient } from "./dataverseClient";

export type FieldDef = {
  logicalName: string;
  attributeType?: string;
  isValidForRead?: boolean;
};

type ODataList<T> = { value?: T[] };

function asBool(v: any): boolean {
  if (v === null) {return true;}
  if (typeof v === "boolean") {return v;}
  if (typeof v === "object" && typeof v.Value === "boolean") {return v.Value;} // Dataverse sometimes wraps
  return true;
}

function distinctSorted(defs: FieldDef[]): FieldDef[] {
  const map = new Map<string, FieldDef>();
  for (const d of defs) {
    if (!d.logicalName) {continue;}
    if (!map.has(d.logicalName)) {map.set(d.logicalName, d);}
  }
  return Array.from(map.values()).sort((a, b) =>
    a.logicalName.localeCompare(b.logicalName, undefined, { sensitivity: "base" })
  );
}

function normalizeAttr(a: any): FieldDef | undefined {
  const logicalName = (a?.LogicalName ?? a?.logicalname ?? "").toString().trim();
  if (!logicalName) {return undefined;}

  const attributeType = (a?.AttributeType ?? a?.attributetype ?? "").toString().trim();
  const isValidForRead = asBool(a?.IsValidForRead ?? a?.isvalidforread ?? a?.validforreadapi);

  return { logicalName, attributeType, isValidForRead };
}

async function tryGet(client: DataverseClient, token: string, path: string): Promise<FieldDef[]> {
  const r = (await client.get(path, token)) as ODataList<any>;
  const defs = (r.value ?? []).map(normalizeAttr).filter(Boolean) as FieldDef[];
  const norm = distinctSorted(defs);
  if (!norm.length) {throw new Error(`No fields parsed from ${path}`);}
  return norm;
}

export async function fetchEntityFields(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldDef[]> {
  const ln = logicalName.replace(/'/g, "''");

  // Prefer the per-entity Attributes endpoint (returns { value: [...] })
  try {
    return await tryGet(
      client,
      token,
      `/EntityDefinitions(LogicalName='${ln}')/Attributes?$select=LogicalName,AttributeType,IsValidForRead&$top=5000`
    );
  } catch {
    // fallback: some orgs are picky; fetch entity then expand (rarely needed)
    const r = await client.get(
      `/EntityDefinitions(LogicalName='${ln}')?$select=LogicalName&$expand=Attributes($select=LogicalName,AttributeType,IsValidForRead)`,
      token
    );

    const attrs = (r as any)?.Attributes ?? [];
    const defs = (attrs ?? []).map(normalizeAttr).filter(Boolean) as FieldDef[];
    const norm = distinctSorted(defs);
    if (!norm.length) {throw new Error(`No fields parsed for ${logicalName}`);}
    return norm;
  }
}