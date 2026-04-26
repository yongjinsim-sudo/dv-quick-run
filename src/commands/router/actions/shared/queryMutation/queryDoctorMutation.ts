import { buildEditorQuery, parseEditorQuery } from "./parsedEditorQuery.js";

export interface QueryDoctorMutation {
  top?: number;
  filter?: string;
}

const CANONICAL_OPTION_ORDER = ["$select", "$top", "$filter", "$orderby", "$expand"];

export function applyQueryDoctorMutation(originalQuery: string, mutation: QueryDoctorMutation): string {
  const parsed = parseEditorQuery(originalQuery);

  if (mutation.top !== undefined) {
    parsed.queryOptions.set("$top", String(mutation.top));
  }

  if (mutation.filter !== undefined) {
    parsed.queryOptions.set("$filter", mutation.filter);
  }

  return buildEditorQueryCanonical(parsed);
}

export function buildEditorQueryCanonical(parsed: ReturnType<typeof parseEditorQuery>): string {
  const ordered = new URLSearchParams();
  const emitted = new Set<string>();

  for (const key of CANONICAL_OPTION_ORDER) {
    const value = parsed.queryOptions.get(key);
    if (value !== null) {
      ordered.set(key, value);
      emitted.add(key);
    }
  }

  const remaining = Array.from(parsed.queryOptions.entries())
    .filter(([key]) => !emitted.has(key))
    .sort(([left], [right]) => left.localeCompare(right));

  for (const [key, value] of remaining) {
    ordered.set(key, value);
  }

  return buildEditorQuery({ ...parsed, queryOptions: ordered });
}
