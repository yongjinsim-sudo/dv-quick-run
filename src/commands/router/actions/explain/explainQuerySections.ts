import { EntityDef } from "../../../../utils/entitySetCache.js";
import { clauseFact, FILTER_OPERATOR_FACTS } from "../shared/queryExplain/factLibrary.js";
import { getFieldHint } from "../shared/queryExplain/fieldHints.js";
import { narrateExpression } from "../shared/queryExplain/filterNarrator.js";
import { buildQueryShapeAdvice } from "../shared/queryExplain/queryShapeAdvisor.js";
import { type ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import { ExplanationSection, ParsedDataverseQuery, ParsedExpand, ParsedOrderBy } from "./explainQueryTypes.js";

export function buildSummary(parsed: ParsedDataverseQuery, entity?: EntityDef): string {
  const target = entity?.logicalName ?? parsed.entitySetName ?? "record";
  const parts: string[] = [];

  if (parsed.isSingleRecord) {
    parts.push(`Retrieves a single ${target} record by ID.`);
  } else {
    parts.push(`Retrieves ${target} records.`);
  }

  if (parsed.select.length) {
    parts.push("Returns a reduced projection rather than full rows.");
  }

  if (parsed.filter) {
    parts.push(`Filter intent: ${narrateExpression(parsed.filter)}.`);
  }

  if (parsed.orderBy.length) {
    const orderText = parsed.orderBy.map((o) => `${o.field} ${o.direction}`).join(", ");
    parts.push(`Sorts by ${orderText}.`);
  }

  if (typeof parsed.top === "number") {
    parts.push(`Limits the result to ${parsed.top} row${parsed.top === 1 ? "" : "s"}.`);
  }

  if (parsed.expand.length) {
    parts.push(`Includes related data through ${parsed.expand.map((x) => x.navigationProperty).join(", ")}.
`);
  }

  return parts.join(" ").trim();
}

function buildFieldLines(fields: string[]): string[] {
  return fields.map((field) => {
    const hint = getFieldHint(field);
    return hint ? `- \`${field}\` — ${hint}` : `- \`${field}\``;
  });
}

function buildFilterLines(filter: string): string[] {
  const lines: string[] = [
    clauseFact("$filter") ?? "",
    `Raw expression: \`${filter}\``,
    `Plain English: ${narrateExpression(filter)}`
  ].filter(Boolean);

  const recognised = FILTER_OPERATOR_FACTS
    .filter((x) => filter.toLowerCase().includes(x.token.trim().toLowerCase()))
    .map((x) => `- \`${x.token.trim()}\` → ${x.meaning}`);

  if (recognised.length) {
    lines.push("Recognised operators:");
    lines.push(...recognised);
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

export function buildSections(parsed: ParsedDataverseQuery, entity?: EntityDef): ExplanationSection[] {
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
    sections.push({ heading: "$filter", lines: buildFilterLines(parsed.filter) });
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
