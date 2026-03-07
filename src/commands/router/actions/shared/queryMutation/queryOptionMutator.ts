import { ParsedEditorQuery } from "./parsedEditorQuery.js";

export type UpsertMode = "replace" | "appendCsv";

function splitCsv(value: string): string[] {
  return value
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

function dedupeCaseInsensitive(values: string[]): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) {continue;}
    seen.add(key);
    output.push(value);
  }

  return output;
}

export function setQueryOption(
  parsed: ParsedEditorQuery,
  optionName: string,
  value: string
): ParsedEditorQuery {
  parsed.queryOptions.delete(optionName);
  parsed.queryOptions.set(optionName, value);
  return parsed;
}

export function removeQueryOption(
  parsed: ParsedEditorQuery,
  optionName: string
): ParsedEditorQuery {
  parsed.queryOptions.delete(optionName);
  return parsed;
}

export function upsertCsvQueryOption(
  parsed: ParsedEditorQuery,
  optionName: string,
  values: string[],
  mode: UpsertMode = "replace"
): ParsedEditorQuery {
  const incoming = dedupeCaseInsensitive(values.map((x) => x.trim()).filter(Boolean));

  if (incoming.length === 0) {
    return parsed;
  }

  if (mode === "replace" || !parsed.queryOptions.has(optionName)) {
    parsed.queryOptions.delete(optionName);
    parsed.queryOptions.set(optionName, incoming.join(","));
    return parsed;
  }

  const existingRaw = parsed.queryOptions.get(optionName) ?? "";
  const merged = dedupeCaseInsensitive([
    ...splitCsv(existingRaw),
    ...incoming
  ]);

  parsed.queryOptions.delete(optionName);
  parsed.queryOptions.set(optionName, merged.join(","));
  return parsed;
}

export function appendOrderByExpression(
  parsed: ParsedEditorQuery,
  expression: string,
  replaceExisting: boolean
): ParsedEditorQuery {
  const incoming = expression.trim();
  if (!incoming) {
    return parsed;
  }

  if (replaceExisting || !parsed.queryOptions.has("$orderby")) {
    parsed.queryOptions.delete("$orderby");
    parsed.queryOptions.set("$orderby", incoming);
    return parsed;
  }

  const existing = parsed.queryOptions.get("$orderby")?.trim();
  const merged = existing ? `${existing},${incoming}` : incoming;

  parsed.queryOptions.delete("$orderby");
  parsed.queryOptions.set("$orderby", merged);
  return parsed;
}