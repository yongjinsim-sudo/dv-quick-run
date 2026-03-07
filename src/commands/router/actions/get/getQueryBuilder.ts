import { FieldDef } from "../../../../services/entityFieldMetadataService";


export function normalizePath(input: string): string {
  const t = input.trim();
  if (!t) {return "";}
  return t.startsWith("/") ? t : `/${t}`;
}

export function buildResultTitle(path: string): string {
  let title = path.replace(/^\//, "");
  title = title.replace(/\?/g, "_");
  title = title.replace(/\$/g, "");
  title = title.replace(/=/g, "");
  title = title.replace(/&/g, "_");
  title = title.replace(/[<>:"/\\|?*\s]+/g, "_");
  return `DVQR_${title}`;
}

export function selectTokenForField(f: FieldDef): string | undefined {
  const ln = (f.logicalName || "").trim();
  if (!ln) {return undefined;}

  const t = (f.attributeType || "").toLowerCase();

  if (t === "lookup" || t === "customer" || t === "owner") {
    return `_${ln}_value`;
  }

  if (t === "virtual" || t === "managedproperty" || t === "partylist") {
    return undefined;
  }

  return ln;
}

export function buildTopQuery(entitySetName: string, top = 10): string {
  return `${entitySetName}?$top=${top}`;
}

export function buildCustomQuery(entitySetName: string, query: string | undefined): string {
  const q = (query ?? "").trim();
  if (!q) {return entitySetName;}
  if (q.startsWith("?")) {return `${entitySetName}${q}`;}
  if (q.startsWith("$")) {return `${entitySetName}?${q}`;}
  return `${entitySetName}?${q}`;
}