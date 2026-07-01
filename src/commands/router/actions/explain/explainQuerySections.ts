import { EntityDef } from "../../../../utils/entitySetCache.js";
import { clauseFact, FILTER_OPERATOR_FACTS } from "../shared/queryExplain/factLibrary.js";
import { getFieldHint } from "../shared/queryExplain/fieldHints.js";
import { narrateExpression } from "../shared/queryExplain/filterNarrator.js";
import { buildQueryShapeAdvice } from "../shared/queryExplain/queryShapeAdvisor.js";
import { type ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import { ExplanationSection, ParsedDataverseQuery, ParsedExpand, ParsedOrderBy } from "./explainQueryTypes.js";
import type { ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import type { ExplainObservation } from "../../../../product/explainEngine/explainEngineTypes.js";
import { resolveChoiceValueFromMetadata } from "../shared/valueAwareness.js";

export function buildSummary(parsed: ParsedDataverseQuery, entity?: EntityDef): string {
  const target = entity?.logicalName ?? parsed.entitySetName ?? "record";
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

function buildFieldLines(fields: string[]): string[] {
  return fields.map((field) => {
    const hint = getFieldHint(field);
    return hint ? `- \`${field}\` — ${hint}` : `- \`${field}\``;
  });
}

function buildFilterLines(filter: string, choiceMetadata: ChoiceMetadataDef[] = []): string[] {
  const lines: string[] = [
    clauseFact("$filter") ?? "",
    `Raw expression: \`${filter}\``,
    `Plain English: ${narrateExpression(filter)}`
  ].filter(Boolean);

  const loweredFilter = filter.toLowerCase();
  const recognised = FILTER_OPERATOR_FACTS
    .filter((x) => {
      const token = x.token.toLowerCase();
      if (token === "not ") {
        return /(^|\W)not\s+(\(|[a-z_])/i.test(filter);
      }

      return loweredFilter.includes(token.trim().startsWith("$") ? token.trim() : token);
    })
    .map((x) => `- \`${x.token.trim()}\` → ${x.meaning}`);

  if (recognised.length) {
    lines.push("Recognised operators:");
    lines.push(...recognised);
  }

  const equalityMatch = /^([A-Za-z_][A-Za-z0-9_]*)\s+eq\s+((?:true|false|-?\d+(?:\.\d+)?)|'(?:[^']|'')*')$/i.exec(filter.trim());
  if (equalityMatch) {
    const [, fieldLogicalName, rawValue] = equalityMatch;
    const resolved = resolveChoiceValueFromMetadata(choiceMetadata, fieldLogicalName, rawValue);
    if (resolved?.option?.label) {
      lines[2] = `Plain English: ${narrateExpression(filter)} (${resolved.option.label})`;
    }
  }

  if (/\bstatecode\b/i.test(filter)) {
    lines.push("- `statecode` commonly represents a Dataverse active/inactive-style state field.");
  }

  if (/\bstatuscode\b/i.test(filter)) {
    lines.push("- `statuscode` commonly represents a Dataverse status reason field.");
  }

  return lines;
}

function buildOrderByLines(items: ParsedOrderBy[]): string[] {
  const lines: string[] = [clauseFact("$orderby") ?? ""].filter(Boolean);

  for (const item of items) {
    const hint = getFieldHint(item.field);
    const base = `- \`${item.field}\` ${item.direction}`;
    lines.push(hint ? `${base} — ${hint}` : base);

    if (item.field.toLowerCase() === "createdon" && item.direction === "desc") {
      lines.push("  - Practical reading: newest records first.");
    }
  }

  return lines;
}

function buildExpandLines(items: ParsedExpand[]): string[] {
  const lines: string[] = [clauseFact("$expand") ?? ""].filter(Boolean);

  for (const item of items) {
    lines.push(`- \`${item.navigationProperty}\``);

    if (item.nestedSelect.length) {
      lines.push(`  - Nested $select: ${item.nestedSelect.map((x) => `\`${x}\``).join(", ")}`);
      lines.push("  - Practical reading: related payload is being kept tighter instead of returning the full related record.");
    } else {
      lines.push("  - No nested $select detected, so the related payload may be broader than necessary.");
    }
  }

  return lines;
}

export function buildSections(parsed: ParsedDataverseQuery, entity?: EntityDef, choiceMetadata: ChoiceMetadataDef[] = []): ExplanationSection[] {
  const sections: ExplanationSection[] = [];

  sections.push({
    heading: "Target",
    lines: [
      `- Entity set: \`${parsed.entitySetName ?? "unknown"}\``,
      `- Logical name: ${entity?.logicalName ? `\`${entity.logicalName}\`` : "*(not resolved from metadata)*"}`,
      parsed.isSingleRecord && parsed.recordId
        ? `- Operation: Retrieve a single record by ID \`${parsed.recordId}\``
        : "- Operation: Retrieve multiple records"
    ]
  });

  if (parsed.select.length) {
    sections.push({
      heading: "$select",
      lines: [clauseFact("$select") ?? "", "Fields returned:", ...buildFieldLines(parsed.select)].filter(Boolean)
    });
  }

  if (parsed.filter) {
    sections.push({ heading: "$filter", lines: buildFilterLines(parsed.filter, choiceMetadata) });
  }

  if (parsed.orderBy.length) {
    sections.push({ heading: "$orderby", lines: buildOrderByLines(parsed.orderBy) });
  }

  if (typeof parsed.top === "number") {
    sections.push({
      heading: "$top",
      lines: [clauseFact("$top") ?? "", `Maximum rows requested: \`${parsed.top}\``].filter(Boolean)
    });
  }

  if (parsed.expand.length) {
    sections.push({ heading: "$expand", lines: buildExpandLines(parsed.expand) });
  }

  if (parsed.unknownParams.length) {
    sections.push({
      heading: "Other query options",
      lines: parsed.unknownParams.map((p) => (p.value ? `- \`${p.key}=${p.value}\`` : `- \`${p.key}\``))
    });
  }

  return sections;
}

export function buildIntentLines(parsed: ParsedDataverseQuery): string[] {
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

export function buildDesignNotes(parsed: ParsedDataverseQuery): string[] {
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

function classifyInvestigationPattern(parsed: ParsedDataverseQuery): string {
  if (parsed.isSingleRecord) {
    return "Direct Record Lookup";
  }
  if (parsed.filter && parsed.orderBy.length && typeof parsed.top === "number") {
    return "Focused Validation Query";
  }
  if (parsed.filter) {
    return "Targeted Retrieval Query";
  }
  if (parsed.select.length || typeof parsed.top === "number") {
    return "Inspection Query";
  }
  return "Discovery Query";
}

function classifyInvestigationStage(parsed: ParsedDataverseQuery): string {
  if (parsed.isSingleRecord || parsed.filter) {
    return "Validation";
  }
  return "Discovery";
}

function classifyEvidenceStrength(parsed: ParsedDataverseQuery): string {
  if (parsed.isSingleRecord || (parsed.filter && parsed.orderBy.length)) {
    return "High";
  }
  if (parsed.filter || typeof parsed.top === "number") {
    return "Medium";
  }
  return "Low";
}

function classifyRepeatability(parsed: ParsedDataverseQuery): string {
  if (parsed.isSingleRecord || parsed.orderBy.length) {
    return "High";
  }
  if (typeof parsed.top === "number") {
    return "Medium";
  }
  return "Low";
}

function classifyPayload(parsed: ParsedDataverseQuery): string {
  if (parsed.select.length && parsed.expand.every((x) => x.nestedSelect.length > 0)) {
    return "Lightweight";
  }
  if (parsed.select.length || parsed.expand.length) {
    return "Moderate";
  }
  return "Broad";
}

function suggestedNextStep(parsed: ParsedDataverseQuery): string {
  if (!parsed.filter && !parsed.isSingleRecord) {
    return "Add a filter before capturing evidence for a specific operational question.";
  }
  if (!parsed.orderBy.length && !parsed.isSingleRecord) {
    return "Add explicit ordering before using the result for repeatable comparison.";
  }
  if (!parsed.select.length) {
    return "Add a projection to keep the evidence payload focused.";
  }
  return "Run the query and preserve observed rows, timing and context as evidence.";
}

export function buildInvestigationStage(parsed: ParsedDataverseQuery): string[] {
  const stage = classifyInvestigationStage(parsed);
  const lines: string[] = [`- Current stage: **${stage}**`];
  if (stage === "Discovery") {
    lines.push("- Suitable for: browsing, validation, and understanding data shape.");
    lines.push("- Not yet ideal for: audit evidence, repeatable comparison, or automation.");
    lines.push("- Suggested next stage: narrow the question with a filter or ordering rule before relying on the result as evidence.");
  } else {
    lines.push("- Suitable for: validating a specific operational question and capturing focused evidence.");
    lines.push("- Watch for: repeatability, ordering, and whether the returned fields are enough to support the conclusion.");
    lines.push("- Suggested next stage: run the query, review observed results, and preserve evidence if the output supports the investigation.");
  }
  return lines;
}

export function buildInvestigationProfile(parsed: ParsedDataverseQuery): string[] {
  return [
    `- Pattern: **${classifyInvestigationPattern(parsed)}**`,
    `- Primary purpose: **${classifyInvestigationStage(parsed)}**`,
    `- Evidence strength: **${classifyEvidenceStrength(parsed)}**`,
    `- Repeatability: **${classifyRepeatability(parsed)}**`,
    `- Payload size: **${classifyPayload(parsed)}**`,
    `- Relationship context: **${parsed.expand.length ? "Present" : "None detected"}**`,
    `- Suggested next step: ${suggestedNextStep(parsed)}`
  ];
}

export function buildOperationalCharacteristics(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  lines.push(parsed.isSingleRecord ? "- Read operation: single-record retrieve." : "- Read operation: multiple-record retrieval.");
  lines.push(parsed.select.length ? `- Projection: ${parsed.select.length} selected column${parsed.select.length === 1 ? "" : "s"}.` : "- Projection: none; the query may return the default/full entity payload.");
  lines.push(parsed.filter ? "- Filtering: present." : "- Filtering: none detected.");
  lines.push(parsed.orderBy.length ? `- Ordering: ${parsed.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ")}.` : "- Ordering: no explicit $orderby detected.");
  lines.push(typeof parsed.top === "number" ? `- Row limit: ${parsed.top}.` : "- Row limit: none detected.");
  lines.push(parsed.expand.length ? `- Relationship expansion: ${parsed.expand.length} expand clause${parsed.expand.length === 1 ? "" : "s"}.` : "- Relationship expansion: none detected.");

  return lines;
}

export function buildPotentialObservations(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  if (!parsed.orderBy.length && !parsed.isSingleRecord) {
    lines.push("- Without explicit `$orderby`, repeated executions may return different rows or ordering, which weakens comparisons and screenshots as evidence.");
  }

  if (!parsed.filter && !parsed.isSingleRecord) {
    lines.push("- Because no `$filter` is applied, the result is exploratory rather than evidence for a specific condition.");
  }

  if (parsed.select.length) {
    lines.push("- Only projected columns are available downstream, so missing fields may require a follow-up query rather than being inferred from this result.");
  } else {
    lines.push("- Without $select, the payload may be broader than needed for investigation.");
  }

  if (typeof parsed.top === "number") {
    lines.push("- The row limit keeps the first pass reviewable; treat the result as a bounded sample, not a complete export.");
  }

  if (parsed.expand.length && parsed.expand.some((x) => x.nestedSelect.length === 0)) {
    lines.push("- At least one expand does not use nested $select, so related payload size may be higher than necessary.");
  }

  if (!lines.length) {
    lines.push("- No unusual query-shape observations were detected from the parsed OData structure.");
  }

  return lines;
}

export function buildVerificationGuidance(parsed: ParsedDataverseQuery): string[] {
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

export function buildTeachingNotes(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  if (parsed.select.length) {
    lines.push("- **Projection teaches intent.** `$select` is not just a performance option; it tells the reader which fields matter to the current investigation. A narrow projection is useful for list views, quick validation, and evidence capture where full records would add noise.");
    lines.push("  - Trade-off: any field not selected is unavailable to the caller, so follow-up investigation may require another query or a broader projection.");
  } else {
    lines.push("- **No projection usually means less focus.** Without `$select`, the response can include more data than the investigation needs, which makes evidence harder to review and compare.");
  }

  if (parsed.filter) {
    lines.push("- **Filters define the investigation boundary.** `$filter` turns a broad read into a focused question by describing which records should count as evidence.");
    lines.push(`  - In this query, the boundary is: ${narrateExpression(parsed.filter)}.`);
  } else if (!parsed.isSingleRecord) {
    lines.push("- **No filter means the query is exploratory.** This can be appropriate when discovering data shape, but it is weaker evidence for a specific operational question because the result set is not targeted.");
  }

  if (parsed.orderBy.length) {
    lines.push("- **Ordering makes evidence repeatable.** `$orderby` is useful when comparing results over time or across environments because it makes the returned sequence intentional.");
  } else if (!parsed.isSingleRecord) {
    lines.push("- **Ordering is a repeatability concern.** Dataverse can return collection results without a stable business meaning unless `$orderby` is specified. That may be fine for quick browsing, but comparisons and automation usually need deterministic ordering.");
  }

  if (typeof parsed.top === "number") {
    lines.push("- **Row limits are investigation guardrails.** `$top` keeps the first pass fast and reviewable while you confirm that the query returns the kind of evidence you expect.");
    lines.push("  - Trade-off: a bounded result is a sample, not proof that no other matching records exist beyond the requested page.");
  } else if (!parsed.isSingleRecord) {
    lines.push("- **Missing row limits increase investigation noise.** During early investigation, an explicit `$top` helps keep the result set small enough to inspect before widening the query.");
  }

  if (parsed.expand.length) {
    if (parsed.expand.some((x) => x.nestedSelect.length > 0)) {
      lines.push("- **Nested expansion balances context and payload size.** `$expand` brings related records into the same response, while nested `$select` keeps those related records focused instead of loading every related field.");
    } else {
      lines.push("- **Expansion adds relationship context.** `$expand` can avoid extra round trips, but without nested `$select` it may return more related data than the investigation needs.");
    }
  }

  if (!lines.length) {
    lines.push("- No specific teaching notes were produced for this query shape. Review the clause analysis for the parsed behaviour.");
  }

  return lines;
}

export function buildPatternTradeOffs(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];

  lines.push(parsed.select.length
    ? "- Use this pattern when you need a focused, readable evidence payload rather than the full record."
    : "- Consider adding `$select` when the goal is investigation or comparison rather than full record retrieval.");

  if (!parsed.filter && !parsed.isSingleRecord) {
    lines.push("- Broad retrieval is useful for discovery, but a targeted `$filter` is stronger when validating a specific theory or production issue.");
  }

  if (!parsed.orderBy.length && !parsed.isSingleRecord) {
    lines.push("- Add `$orderby` when the result must be repeatable, paged, or compared across runs.");
  }

  if (parsed.expand.length) {
    lines.push(parsed.expand.some((x) => x.nestedSelect.length > 0)
      ? "- The nested `$select` inside `$expand` is a good investigation pattern because it preserves relationship context without over-fetching related records."
      : "- Add nested `$select` inside `$expand` if only a few related fields are relevant.");
  }

  return lines;
}


export function buildTeachingObservations(parsed: ParsedDataverseQuery): ExplainObservation[] {
  const observations: ExplainObservation[] = [];

  observations.push({
    id: parsed.select.length ? "odata.projection.present" : "odata.projection.missing",
    title: parsed.select.length ? "Projection teaches intent" : "No projection usually means less focus",
    category: "projection",
    statement: parsed.select.length
      ? `The query requests ${parsed.select.length} selected column${parsed.select.length === 1 ? "" : "s"}, which makes the evidence payload narrower and easier to review.`
      : "The query does not specify `$select`, so the response may include more fields than the investigation needs.",
    why: parsed.select.length
      ? "A projection tells the next reader which fields matter to the investigation instead of forcing them to interpret a full record payload."
      : "Focused evidence is easier to compare, discuss and preserve than a broad default payload.",
    useWhen: parsed.select.length
      ? "Use narrow projections for list views, quick validation, handoff evidence and report-style queries."
      : "Add `$select` when the query is used for investigation, comparison or handoff rather than full record inspection.",
    tradeOff: parsed.select.length
      ? "Fields not selected are unavailable to the caller, so follow-up investigation may require another query or a broader projection."
      : "A broad payload can be convenient during exploration, but it may add noise and make reports harder to scan.",
    confidence: "high",
    sourceContributor: "dvqr.teaching",
    displayPriority: 10
  });

  observations.push({
    id: parsed.filter ? "odata.filter.present" : "odata.filter.missing",
    title: parsed.filter ? "Filters define the investigation boundary" : "No filter means the query is exploratory",
    category: "filtering",
    statement: parsed.filter
      ? `The filter narrows the evidence set: ${narrateExpression(parsed.filter)}.`
      : "The query samples from the available record set rather than targeting a specific condition.",
    why: parsed.filter
      ? "A filter turns a broad read into a focused operational question by defining which records count as evidence."
      : "Exploratory reads are useful for discovering data shape, but they are weaker evidence for a specific operational question.",
    useWhen: parsed.filter
      ? "Use filters when validating a hypothesis, checking a production issue or comparing a known subset of records."
      : "Use broad retrieval when discovering available records or validating the basic shape of an entity."
      ,
    tradeOff: parsed.filter
      ? "A narrow filter can miss related evidence outside the selected boundary."
      : "Without a filter, returned rows may be representative samples rather than evidence for a specific record or condition.",
    confidence: parsed.isSingleRecord ? "medium" : "high",
    sourceContributor: "dvqr.teaching",
    displayPriority: 20
  });

  if (!parsed.isSingleRecord) {
    observations.push({
      id: parsed.orderBy.length ? "odata.ordering.present" : "odata.ordering.missing",
      title: parsed.orderBy.length ? "Ordering makes evidence repeatable" : "Ordering is a repeatability concern",
      category: "ordering",
      statement: parsed.orderBy.length
        ? `The query defines explicit ordering: ${parsed.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ")}.`
        : "No explicit `$orderby` is present, so repeated executions may not be directly comparable.",
      why: parsed.orderBy.length
        ? "Stable ordering makes paging, screenshots and cross-run comparisons easier to reason about."
        : "Dataverse collection results do not carry a stable business meaning unless an ordering rule is specified.",
      useWhen: "Use explicit ordering when results will be paged, compared across runs, used in automation or included as investigation evidence.",
      tradeOff: parsed.orderBy.length
        ? "Ordering can add cost depending on indexed fields and query shape."
        : "For quick browsing this may be acceptable, but comparisons and automation usually need deterministic ordering.",
      confidence: "high",
      sourceContributor: "dvqr.teaching",
      displayPriority: 30
    });
  }

  if (!parsed.isSingleRecord) {
    observations.push({
      id: typeof parsed.top === "number" ? "odata.paging.top" : "odata.paging.noTop",
      title: typeof parsed.top === "number" ? "Row limits are investigation guardrails" : "Missing row limits increase investigation noise",
      category: "paging",
      statement: typeof parsed.top === "number"
        ? `$top=${parsed.top} keeps the first pass bounded while the query shape is being validated.`
        : "The query does not cap the number of records returned.",
      why: typeof parsed.top === "number"
        ? "A small bounded result is faster to inspect and easier to preserve as evidence during early investigation."
        : "Unbounded reads can produce large result sets before the investigator has confirmed the query is asking the right question.",
      useWhen: typeof parsed.top === "number"
        ? "Use `$top` for sampling, validation and early investigation before widening the query."
        : "Add `$top` when first validating query shape, especially before adding expands or broader projections.",
      tradeOff: typeof parsed.top === "number"
        ? "A bounded result is a sample, not proof that no other matching records exist beyond the requested page."
        : "Removing the limit may be valid for exports, but it increases review and execution risk during investigation.",
      confidence: "high",
      sourceContributor: "dvqr.teaching",
      displayPriority: 40
    });
  }

  if (parsed.expand.length) {
    const hasNestedSelect = parsed.expand.some((x) => x.nestedSelect.length > 0);
    observations.push({
      id: hasNestedSelect ? "odata.expand.nestedSelect" : "odata.expand.noNestedSelect",
      title: hasNestedSelect ? "Nested expansion balances context and payload size" : "Expansion adds relationship context",
      category: "relationship",
      statement: hasNestedSelect
        ? "The query pulls related records into the same response while using nested `$select` to keep related payloads focused."
        : "The query pulls related records into the same response, but at least one expand does not narrow the related payload with nested `$select`.",
      why: "$expand can reduce follow-up requests when relationship context matters to the investigation.",
      useWhen: "Use expand when related context is part of the question being investigated and the relationship payload is still reviewable.",
      tradeOff: hasNestedSelect
        ? "Relationship analysis is still more complex than flat retrieval, so verify that the expanded data is the context you intended."
        : "Without nested `$select`, expanded records may return more related data than needed.",
      watchFor: "Nested expand diagnostics are currently partial, so treat relationship guidance as advisory.",
      confidence: "medium",
      sourceContributor: "dvqr.teaching",
      displayPriority: 50
    });
  }

  return observations;
}

export function buildValidationLines(issues: ValidationIssue[]): string[] {
  const lines: string[] = [];

  for (const issue of issues) {
    const prefix = issue.severity === "error" ? "- Error:" : "- Warning:";
    lines.push(`${prefix} ${issue.message}`);
    if (issue.suggestion) {
      lines.push(`  - Suggestion: ${issue.suggestion}`);
    }
  }

  return lines;
}
