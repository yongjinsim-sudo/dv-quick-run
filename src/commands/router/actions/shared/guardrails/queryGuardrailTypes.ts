export type GuardrailSeverity = "info" | "warning" | "error";

export interface QueryGuardrailIssue {
  code: string;
  severity: GuardrailSeverity;
  message: string;
  suggestion?: string;
}

export interface ParsedDvQuery {
  rawQuery: string;
  normalizedQuery: string;
  hadLeadingSlash: boolean;
  entityPath: string;
  entitySetName?: string;
  isSingleRecordPath: boolean;
  isCollectionQuery: boolean;
  queryOptions: URLSearchParams;
  duplicateOptionCounts: Map<string, number>;
}

export interface QueryGuardrailContext {
  parsed: ParsedDvQuery;
  knownEntitySetNames?: Set<string>;
}

export interface QueryGuardrailResult {
  issues: QueryGuardrailIssue[];
  hasWarnings: boolean;
  hasErrors: boolean;
}