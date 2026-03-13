import { ParsedRecord } from "./generateQueryFromJsonTypes.js";

export function buildGetPath(rec: ParsedRecord): string {
  return `${rec.entitySetName}(${rec.id})`;
}

export function buildGetPathWithSelect(rec: ParsedRecord, maxFields = 50): string {
  const base = buildGetPath(rec);

  const fields = rec.selectFields
    .filter((x) => x && x !== rec.primaryIdField)
    .slice(0, maxFields);

  if (fields.length === 0) {return base;}
  return `${base}?$select=${fields.join(",")}`;
}

export function buildFilterPathById(rec: ParsedRecord): string {
  const idField =
    rec.primaryIdField ??
    (rec.entitySetName.endsWith("s")
      ? `${rec.entitySetName.slice(0, -1)}id`
      : "id");

  return `${rec.entitySetName}?$filter=${idField} eq ${rec.id}`;
}

export function buildFilterPathByIdWithSelect(rec: ParsedRecord, maxFields = 50): string {
  const base = buildFilterPathById(rec);

  const fields = rec.selectFields
    .filter((x) => x && x !== rec.primaryIdField)
    .slice(0, maxFields);

  if (fields.length === 0) {return base;}
  return `${base}&$select=${fields.join(",")}`;
}

export function buildFullUrl(baseUrl: string, path: string): string {
  const b = (baseUrl || "").replace(/\/+$/, "");
  const p = (path || "").startsWith("/") ? path : `/${path}`;
  return `${b}${p}`;
}

export function buildCurlGet(fullUrl: string): string {
  return [
    `curl -X GET "${fullUrl}"`,
    `  -H "Authorization: Bearer <TOKEN>"`,
    `  -H "Accept: application/json"`,
    `  -H "OData-MaxVersion: 4.0"`,
    `  -H "OData-Version: 4.0"`
  ].join(" \\\n");
}