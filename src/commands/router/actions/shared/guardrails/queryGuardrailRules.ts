import { QueryGuardrailContext, QueryGuardrailIssue } from "./queryGuardrailTypes.js";

export type QueryGuardrailRule = (ctx: QueryGuardrailContext) => QueryGuardrailIssue[];

const SINGLE_VALUE_OPTIONS = new Set([
  "$select",
  "$filter",
  "$expand",
  "$orderby",
  "$top",
  "$skip",
  "$count"
]);

function makeIssue(
  code: string,
  severity: "info" | "warning" | "error",
  message: string,
  suggestion?: string
): QueryGuardrailIssue {
  return {
    code,
    severity,
    message,
    suggestion
  };
}

export function checkMissingEntity(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const entityPath = ctx.parsed.entityPath.trim();

  if (!entityPath) {
    return [
      makeIssue(
        "missing-entity",
        "error",
        "Missing entity path.",
        "Start with a Dataverse entity set, e.g. contacts?$top=10"
      )
    ];
  }

  return [];
}

export function checkUnknownEntity(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const entitySetName = ctx.parsed.entitySetName?.trim().toLowerCase();
  const known = ctx.knownEntitySetNames;

  if (!entitySetName || !known || known.size === 0) {
    return [];
  }

  if (!known.has(entitySetName)) {
    return [
      makeIssue(
        "unknown-entity",
        "error",
        `Unknown entity set: ${ctx.parsed.entitySetName}`,
        "Check the table name or refresh metadata."
      )
    ];
  }

  return [];
}

export function checkEmptyOptionValues(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const issues: QueryGuardrailIssue[] = [];

  for (const [key, value] of ctx.parsed.queryOptions.entries()) {
    if (!key.trim()) {continue;}

    if (!value.trim()) {
      issues.push(
        makeIssue(
          "empty-query-option",
          "error",
          `Query option ${key} is present but empty.`,
          `Provide a value for ${key} or remove it.`
        )
      );
    }
  }

  return issues;
}

export function checkMissingTop(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  if (!ctx.parsed.isCollectionQuery) {
    return [];
  }

  if (!ctx.parsed.queryOptions.has("$top")) {
    return [
      makeIssue(
        "missing-top",
        "warning",
        "Missing $top — this may return many records. Consider using preview action.",
        "Consider adding $top=10 or $top=50."
      )
    ];
  }

  return [];
}


export function checkMissingFilter(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  if (!ctx.parsed.isCollectionQuery) {
    return [];
  }

  if (!ctx.parsed.queryOptions.has("$filter")) {
    return [
      makeIssue(
        "missing-filter",
        "warning",
        "Missing $filter — this may return a broad result set.",
        "Consider adding a focused $filter clause."
      )
    ];
  }

  return [];
}

export function checkMissingSelect(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  if (!ctx.parsed.queryOptions.has("$select")) {
    return [
      makeIssue(
        "missing-select",
        "warning",
        "Missing $select — this may retrieve more columns than expected.",
        "Consider adding a focused $select clause."
      )
    ];
  }

  return [];
}

export function checkDuplicateSingleValueOptions(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const issues: QueryGuardrailIssue[] = [];

  for (const [key, count] of ctx.parsed.duplicateOptionCounts.entries()) {
    const lowered = key.toLowerCase();

    if (!SINGLE_VALUE_OPTIONS.has(lowered)) {continue;}
    if (count <= 1) {continue;}

    issues.push(
      makeIssue(
        "duplicate-single-value-option",
        "warning",
        `Query option ${key} appears ${count} times.`,
        `Merge duplicate ${key} values into a single clause.`
      )
    );
  }

  return issues;
}

export function checkLargeTop(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  if (!ctx.parsed.isCollectionQuery) {
    return [];
  }

  const rawTop = ctx.parsed.queryOptions.get("$top");
  if (!rawTop) {return [];}

  const top = Number(rawTop);
  if (!Number.isFinite(top)) {
    return [
      makeIssue(
        "invalid-top",
        "error",
        `$top is not a valid number: ${rawTop}`,
        "Use a whole number such as $top=10."
      )
    ];
  }

  if (top <= 0) {
    return [
      makeIssue(
        "non-positive-top",
        "error",
        `$top must be greater than zero: ${rawTop}`,
        "Use a positive whole number such as $top=10."
      )
    ];
  }

  if (top > 1000) {
    return [
      makeIssue(
        "very-large-top",
        "warning",
        `Large $top detected (${top}).`,
        "Consider reducing $top unless you really need a very large result set."
      )
    ];
  }

  if (top > 250) {
    return [
      makeIssue(
        "large-top",
        "warning",
        `High $top detected (${top}).`,
        "Consider lowering $top for safer and faster reads."
      )
    ];
  }

  return [];
}

export function checkExpandWithoutInnerSelect(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const expand = ctx.parsed.queryOptions.get("$expand");
  if (!expand) {return [];}

  const trimmed = expand.trim();
  if (!trimmed) {return [];}

  const hasInnerSelect = /\(\s*\$select\s*=/.test(trimmed);

  if (!hasInnerSelect) {
    return [
      makeIssue(
        "expand-without-inner-select",
        "warning",
        "Expand detected without an inner $select.",
        "Consider using $expand=nav($select=field1,field2) to keep payloads focused."
      )
    ];
  }

  return [];
}

export function checkTooManyExpands(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  const expand = ctx.parsed.queryOptions.get("$expand");
  if (!expand) {return [];}

  const count = expand
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean).length;

  if (count > 3) {
    return [
      makeIssue(
        "too-many-expands",
        "warning",
        `This query has ${count} expand clauses.`,
        "Consider reducing expands to keep queries readable and performant."
      )
    ];
  }

  return [];
}

export function checkLeadingSlash(ctx: QueryGuardrailContext): QueryGuardrailIssue[] {
  if (!ctx.parsed.hadLeadingSlash) {
    return [];
  }

  return [
    makeIssue(
      "leading-slash",
      "warning",
      "Query starts with a leading slash.",
      "This is allowed, but DV Quick Run usually stores paths without the leading slash."
    )
  ];
}