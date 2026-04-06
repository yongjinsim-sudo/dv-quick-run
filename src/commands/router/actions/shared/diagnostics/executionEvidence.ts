import { parseDataverseQuery } from "../../explain/explainQueryParser.js";

export type ComparisonKind = "filterImpact" | "expandImpact" | "narrowerSelect";

export interface ExecutionFieldObservationValueCount {
  value: string;
  count: number;
}

export type ExecutionFieldObservationKind = "categorical" | "presence";

export interface ExecutionFieldObservation {
  field: string;
  nonNullCount: number;
  nullCount: number;
  distinctCount: number;
  mostCommonCount: number;
  kind: ExecutionFieldObservationKind;
  topValues: ExecutionFieldObservationValueCount[];
}

export interface ExecutionEvidence {
  querySignature: string;
  entitySetName?: string;
  executionTimeMs: number;
  returnedRowCount: number;
  requestedTop?: number;
  returnedFullPage: boolean;
  selectedColumnCount: number;
  hasExpand: boolean;
  filterFieldNames: string[];
  fieldObservations: ExecutionFieldObservation[];
  observedAt: number;
  comparisonKind?: ComparisonKind;
  comparisonAgainstQuerySignature?: string;
}

const evidenceStore = new Map<string, ExecutionEvidence>();

export function buildQuerySignature(queryText: string): string {
  return queryText.trim().replace(/^\/+/, "");
}

export function extractExecutionEvidence(queryText: string, result: unknown, executionTimeMs: number): ExecutionEvidence {
  const parsed = parseDataverseQuery(queryText);
  const returnedRowCount = getReturnedRowCount(result);
  const filterFieldNames = parseSimpleFilterFieldNames(parsed.filter);

  return {
    querySignature: buildQuerySignature(parsed.normalized),
    entitySetName: parsed.entitySetName,
    executionTimeMs,
    returnedRowCount,
    requestedTop: parsed.top,
    returnedFullPage: typeof parsed.top === "number" && parsed.top > 0 && returnedRowCount >= parsed.top,
    selectedColumnCount: parsed.select.length,
    hasExpand: parsed.expand.length > 0,
    filterFieldNames,
    fieldObservations: extractFieldObservations(result),
    observedAt: Date.now()
  };
}

export function recordExecutionEvidence(evidence: ExecutionEvidence): void {
  evidenceStore.set(evidence.querySignature, evidence);
}

export function getExecutionEvidenceForQuery(queryText: string): ExecutionEvidence | undefined {
  return evidenceStore.get(buildQuerySignature(queryText));
}

export function clearExecutionEvidenceStore(): void {
  evidenceStore.clear();
}

function getReturnedRowCount(result: unknown): number {
  if (Array.isArray((result as { value?: unknown[] } | undefined)?.value)) {
    return (result as { value: unknown[] }).value.length;
  }

  if (Array.isArray(result)) {
    return result.length;
  }

  return result ? 1 : 0;
}

function parseSimpleFilterFieldNames(filter: string | undefined): string[] {
  if (!filter) {
    return [];
  }

  const matches = Array.from(filter.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s+(?:eq|ne|gt|ge|lt|le)\s+/gi));
  const values = matches.map((match) => match[1]).filter((value): value is string => !!value);
  return Array.from(new Set(values.map((value) => value.trim())));
}

function extractFieldObservations(result: unknown): ExecutionFieldObservation[] {
  const rows = Array.isArray((result as { value?: unknown[] } | undefined)?.value)
    ? (result as { value: unknown[] }).value
    : Array.isArray(result)
      ? result
      : [];

  if (!rows.length) {
    return [];
  }

  const valuesByField = new Map<string, unknown[]>();
  const formattedValuesByField = new Map<string, (string | undefined)[]>();

  for (const row of rows) {
    if (!row || typeof row !== "object" || Array.isArray(row)) {
      continue;
    }

    const record = row as Record<string, unknown>;

    for (const [field, value] of Object.entries(record)) {
      if (!isObservableField(field, value)) {
        continue;
      }

      const bucket = valuesByField.get(field) ?? [];
      bucket.push(value);
      valuesByField.set(field, bucket);

      const formattedBucket = formattedValuesByField.get(field) ?? [];
      const formattedValue = record[`${field}@OData.Community.Display.V1.FormattedValue`];
      formattedBucket.push(typeof formattedValue === "string" ? formattedValue : undefined);
      formattedValuesByField.set(field, formattedBucket);
    }
  }

  const observations: ExecutionFieldObservation[] = [];

  for (const [field, values] of valuesByField.entries()) {
    const formattedValues = formattedValuesByField.get(field) ?? [];
    const typedCategory = classifyObservedField(field, values, formattedValues);
    if (typedCategory === "ignore") {
      continue;
    }

    const nonNullIndexes = values
      .map((value, index) => ({ value, index }))
      .filter((item) => item.value !== null && item.value !== undefined);

    if (!nonNullIndexes.length) {
      continue;
    }

    const counts = new Map<string, number>();
    for (const item of nonNullIndexes) {
      const key = normalizeObservedValue(item.value, formattedValues[item.index]);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }

    const sortedCounts = Array.from(counts.entries())
      .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
      .map(([value, count]) => ({ value, count }));

    observations.push({
      field,
      nonNullCount: nonNullIndexes.length,
      nullCount: values.length - nonNullIndexes.length,
      distinctCount: counts.size,
      mostCommonCount: sortedCounts[0]?.count ?? 0,
      kind: typedCategory === "presenceOnly" ? "presence" : "categorical",
      topValues: typedCategory === "categorical" ? sortedCounts.slice(0, 3) : []
    });
  }

  return observations.sort((left, right) => left.field.localeCompare(right.field));
}

function isObservableField(field: string, value: unknown): boolean {
  if (!field || field.startsWith("@") || field.includes("@") || field.endsWith("_formatted")) {
    return false;
  }

  if (typeof value === "object" && value !== null) {
    return false;
  }

  return true;
}

function normalizeObservedValue(value: unknown, formattedValue?: string): string {
  if (formattedValue && formattedValue.trim()) {
    return formattedValue.trim();
  }

  if (typeof value === "string") {
    return value.trim();
  }

  return String(value);
}

function classifyObservedField(field: string, values: unknown[], formattedValues: (string | undefined)[]): "categorical" | "presenceOnly" | "ignore" {
  if (/^(?:_|.*(?:id|versionnumber|activityid))$/i.test(field)) {
    return "ignore";
  }

  const nonNullValues = values.filter((value) => value !== null && value !== undefined);
  if (!nonNullValues.length) {
    return "ignore";
  }

  const sample = nonNullValues[0];

  if (typeof sample === "boolean") {
    return "ignore";
  }

  if (typeof sample === "number") {
    if (formattedValues.some((value) => !!value?.trim())) {
      return "categorical";
    }

    const distinctValues = new Set(nonNullValues
      .filter((value): value is number => typeof value === "number" && Number.isFinite(value))
      .map((value) => String(value)));

    if (distinctValues.size >= 2 && distinctValues.size <= 8) {
      return "categorical";
    }

    return "ignore";
  }

  if (typeof sample !== "string") {
    return "ignore";
  }

  const trimmed = sample.trim();
  if (!trimmed) {
    return "ignore";
  }

  if (looksLikeGuid(trimmed) || looksLikeIsoDate(trimmed)) {
    return "ignore";
  }

  if (formattedValues.some((value) => !!value?.trim())) {
    return "categorical";
  }

  const distinctValues = new Set(nonNullValues.map((value) => String(value).trim()).filter(Boolean));
  if (distinctValues.size <= 1) {
    return "presenceOnly";
  }

  const averageLength = Array.from(distinctValues).reduce((sum, value) => sum + value.length, 0) / distinctValues.size;
  if (averageLength > 40) {
    return "ignore";
  }

  return "categorical";
}

function looksLikeGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function looksLikeIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}(?:[T ]\d{2}:\d{2}(?::\d{2}(?:\.\d{1,7})?)?(?:Z|[+-]\d{2}:?\d{2})?)?$/i.test(value);
}
