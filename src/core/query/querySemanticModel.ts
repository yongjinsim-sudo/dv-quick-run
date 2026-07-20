import type {
  ParsedDataverseQuery,
  QueryParseDiagnostic
} from "../../commands/router/actions/explain/explainQueryTypes.js";

export type QueryReferenceClause = "$select" | "$filter" | "$orderby" | "$expand";

export interface QueryFieldReference {
  readonly raw: string;
  readonly fieldName: string;
  readonly clause: QueryReferenceClause;
  readonly pathSegments: readonly string[];
}

export interface QueryExpandReference {
  readonly navigationProperty: string;
  readonly nestedSelect: readonly string[];
  readonly raw: string;
}

export interface QuerySemanticModel {
  readonly sourceText: string;
  readonly queryKind: "OData";
  readonly entitySetName?: string;
  readonly selectedFields: readonly QueryFieldReference[];
  readonly expandedProperties: readonly QueryExpandReference[];
  readonly filterReferences: readonly QueryFieldReference[];
  readonly orderByReferences: readonly QueryFieldReference[];
  readonly top?: number;
  readonly unknownOptions: readonly { key: string; value: string }[];
  readonly duplicateOptions: readonly { key: string; value: string }[];
  readonly parseDiagnostics: readonly QueryParseDiagnostic[];
}

function toReference(raw: string, clause: QueryReferenceClause): QueryFieldReference {
  const trimmed = raw.trim();
  const pathSegments = trimmed.split("/").map((item) => item.trim()).filter(Boolean);
  return {
    raw: trimmed,
    fieldName: pathSegments[pathSegments.length - 1] ?? trimmed,
    clause,
    pathSegments
  };
}

function extractFilterReferences(filter: string | undefined): QueryFieldReference[] {
  if (!filter) {
    return [];
  }

  const references: QueryFieldReference[] = [];
  const seen = new Set<string>();
  const comparisonPattern = /\b([A-Za-z_][A-Za-z0-9_./]*)\s+(?:eq|ne|gt|ge|lt|le|in|not\s+in)\b/gi;
  const functionPattern = /\b(?:contains|startswith|endswith)\s*\(\s*([A-Za-z_][A-Za-z0-9_./]*)\s*,/gi;

  for (const pattern of [comparisonPattern, functionPattern]) {
    for (const match of filter.matchAll(pattern)) {
      const raw = match[1]?.trim();
      const key = raw?.toLowerCase();
      if (!raw || !key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      references.push(toReference(raw, "$filter"));
    }
  }

  return references;
}

export function buildQuerySemanticModel(parsed: ParsedDataverseQuery): QuerySemanticModel {
  return {
    sourceText: parsed.raw.trim(),
    queryKind: "OData",
    entitySetName: parsed.entitySetName,
    selectedFields: parsed.select.map((field) => toReference(field, "$select")),
    expandedProperties: parsed.expand.map((expand) => ({
      navigationProperty: expand.navigationProperty,
      nestedSelect: expand.nestedSelect,
      raw: expand.raw
    })),
    filterReferences: extractFilterReferences(parsed.filter),
    orderByReferences: parsed.orderBy.map((item) => toReference(item.field, "$orderby")),
    top: parsed.top,
    unknownOptions: parsed.unknownParams,
    duplicateOptions: parsed.duplicateParams ?? [],
    parseDiagnostics: parsed.parseDiagnostics ?? []
  };
}
