import { FieldDef } from "../../../../../services/entityFieldMetadataService.js";
import { buildLookupSelectToken } from "../../../../../metadata/metadataModel.js";

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
  return buildLookupSelectToken(f.logicalName, f.attributeType);
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