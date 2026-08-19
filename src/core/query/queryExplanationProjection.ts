import { narrateExpression } from "./filterNarrator.js";
import { buildQueryShapeAdvice } from "./queryShapeAdvisor.js";
import type { ParsedDataverseQuery } from "./queryParseTypes.js";

export function buildQuerySummary(parsed: ParsedDataverseQuery, entityLogicalName?: string): string {
  const target = entityLogicalName ?? parsed.entitySetName ?? "record";
  const entityLabel = target === "record" ? "records" : `${target} records`;
  const parts: string[] = [];

  if (parsed.isSingleRecord) {
    parts.push(`This appears to be a direct lookup for a single ${target} record.`);
  } else if (parsed.filter) {
    parts.push(`This appears to be a targeted retrieval of ${entityLabel}.`);
  } else if (typeof parsed.top === "number" && parsed.select.length) {
    parts.push(`This appears to be a lightweight inspection query for ${entityLabel}.`);
  } else {
    parts.push(`This appears to be a broad retrieval query for ${entityLabel}.`);
  }

  if (parsed.select.length) {
    parts.push(`It deliberately requests ${parsed.select.length} column${parsed.select.length === 1 ? "" : "s"} instead of a full entity payload, which usually indicates browsing, validation, or focused investigation rather than complete export.`);
  } else {
    parts.push("It does not specify a projection, so the payload may be broader than the investigation actually needs.");
  }

  if (parsed.filter) {
    parts.push(`The filter narrows the evidence set: ${narrateExpression(parsed.filter)}.`);
  } else if (!parsed.isSingleRecord) {
    parts.push("No filter is applied, so the query is sampling from the available record set rather than targeting a specific condition.");
  }

  if (parsed.orderBy.length) {
    const orderText = parsed.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ");
    parts.push(`The result order is intentional: ${orderText}.`);
  } else if (!parsed.isSingleRecord) {
    parts.push("No explicit ordering is present, so repeated executions may not be directly comparable.");
  }

  if (typeof parsed.top === "number") {
    parts.push(`The ${parsed.top}-row limit keeps the result bounded while the query shape is being validated.`);
  }

  if (parsed.expand.length) {
    const expands = parsed.expand.map((x) => x.navigationProperty).join(", ");
    parts.push(`It also pulls related context through ${expands}, which can reduce follow-up requests when relationship context matters.`);
  }

  if (parsed.isSingleRecord) {
    parts.push("Overall this query is appropriate for direct record inspection and evidence capture when the identifier is the intended investigation boundary.");
  } else if (parsed.filter && parsed.orderBy.length) {
    parts.push("Overall this query is moving from discovery toward validation because it narrows the evidence set and makes returned records more repeatable.");
  } else if (parsed.filter) {
    parts.push("Overall this query is suitable for targeted validation, but explicit ordering may improve repeatability if the result is used as evidence.");
  } else {
    parts.push("Overall this query is appropriate for discovery and validation, but should usually be refined before being relied upon as investigation evidence.");
  }

  return parts.join(" ").trim();
}

export function buildQueryIntentLines(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  if (parsed.isSingleRecord) {
    lines.push("- This is a direct record lookup by ID.");
  } else if (parsed.filter && parsed.orderBy.length && typeof parsed.top === "number") {
    lines.push("- This looks like a focused list/search-style query.");
  } else if (parsed.filter) {
    lines.push("- This looks like a filtered list query.");
  } else {
    lines.push("- This looks like a general retrieval query.");
  }

  if (parsed.select.length) {
    lines.push("- Projection is used, so the query is intentionally not asking for full rows.");
  }

  if (parsed.expand.some((x) => x.nestedSelect.length > 0)) {
    lines.push("- Related data is being pulled efficiently with nested projection.");
  }

  return lines;
}

export function buildQueryDesignNotes(parsed: ParsedDataverseQuery): string[] {
  return buildQueryShapeAdvice({
    hasSelect: parsed.select.length > 0,
    hasFilter: !!parsed.filter,
    hasOrderBy: parsed.orderBy.length > 0,
    hasTop: typeof parsed.top === "number",
    hasExpand: parsed.expand.length > 0,
    expandHasNestedSelect: parsed.expand.some((x) => x.nestedSelect.length > 0),
    isSingleRecord: parsed.isSingleRecord,
    unknownParamKeys: parsed.unknownParams.map((x) => x.key)
  }).map((x) => `- ${x}`);
}

export function buildQueryOperationalCharacteristics(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];
  lines.push(parsed.isSingleRecord ? "- Read operation: single-record retrieve." : "- Read operation: multiple-record retrieval.");
  lines.push(parsed.select.length ? `- Projection: ${parsed.select.length} selected column${parsed.select.length === 1 ? "" : "s"}.` : "- Projection: none; the query may return the default/full entity payload.");
  lines.push(parsed.filter ? "- Filtering: present." : "- Filtering: none detected.");
  lines.push(parsed.orderBy.length ? `- Ordering: ${parsed.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ")}.` : "- Ordering: no explicit $orderby detected.");
  lines.push(typeof parsed.top === "number" ? `- Row limit: ${parsed.top}.` : "- Row limit: none detected.");
  lines.push(parsed.expand.length ? `- Relationship expansion: ${parsed.expand.length} expand clause${parsed.expand.length === 1 ? "" : "s"}.` : "- Relationship expansion: none detected.");
  return lines;
}

export function buildQueryVerificationGuidance(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  if (!parsed.orderBy.length && !parsed.isSingleRecord) {
    lines.push("- If deterministic paging, screenshots, or cross-run comparison are required, add an explicit `$orderby`.");
  }
  if (!parsed.filter && !parsed.isSingleRecord) {
    lines.push("- Confirm that discovery is the goal; add `$filter` if the investigation is meant to test a narrower operational question.");
  }
  if (typeof parsed.top === "number") {
    lines.push("- Confirm the `$top` value is large enough to answer the current question but small enough to keep review noise low.");
  }
  if (!parsed.select.length) {
    lines.push("- Consider adding $select to keep the evidence payload focused and repeatable.");
  }
  if (parsed.expand.length && parsed.expand.some((x) => x.nestedSelect.length === 0)) {
    lines.push("- Consider nested $select inside $expand when only specific related fields are needed.");
  }
  if (!lines.length) {
    lines.push("- Review returned rows and execution evidence before treating this query as operational evidence.");
  }
  return lines;
}
