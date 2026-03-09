import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { DataverseClient } from "../../../services/dataverseClient.js";
import { EntityDef } from "../../../utils/entitySetCache.js";
import { loadEntityDefs, findEntityByEntitySetName } from "./shared/metadataAccess.js";
import { clauseFact, FILTER_OPERATOR_FACTS } from "./shared/queryExplain/factLibrary.js";
import { getFieldHint } from "./shared/queryExplain/fieldHints.js";
import { narrateExpression } from "./shared/queryExplain/filterNarrator.js";
import { buildQueryShapeAdvice } from "./shared/queryExplain/queryShapeAdvisor.js";
import { validateParsedQuery, type ValidationIssue } from "./shared/queryExplain/queryValidation.js";
import { getLogicalEditorQueryTarget } from "./shared/queryMutation/editorQueryTarget.js";

type QueryParam = {
  key: string;
  value: string;
};

type ParsedOrderBy = {
  field: string;
  direction: "asc" | "desc";
};

type ParsedExpand = {
  navigationProperty: string;
  nestedSelect: string[];
  raw: string;
};

type ParsedDataverseQuery = {
  raw: string;
  normalized: string;
  pathPart: string;
  queryPart: string;
  entitySetName?: string;
  recordId?: string;
  isSingleRecord: boolean;
  isCollection: boolean;
  params: QueryParam[];
  select: string[];
  filter?: string;
  orderBy: ParsedOrderBy[];
  top?: number;
  expand: ParsedExpand[];
  unknownParams: QueryParam[];
};

type ExplanationSection = {
  heading: string;
  lines: string[];
};

function getEditorAndRangeText(): { text: string } {
  const { text } = getLogicalEditorQueryTarget();
  return { text };
}

function normalizeInput(input: string): string {
  return input.trim().replace(/^\/+/, "");
}

function splitPathAndQuery(input: string): { pathPart: string; queryPart: string } {
  const text = normalizeInput(input);
  const idx = text.indexOf("?");

  if (idx < 0) {
    return { pathPart: text, queryPart: "" };
  }

  return {
    pathPart: text.slice(0, idx),
    queryPart: text.slice(idx + 1)
  };
}

function splitTopLevel(input: string, delimiter: string): string[] {
  const parts: string[] = [];
  let current = "";
  let depth = 0;
  let inSingleQuote = false;

  for (let i = 0; i < input.length; i++) {
    const ch = input[i];

    if (ch === "'") {
      if (inSingleQuote && input[i + 1] === "'") {
        current += "''";
        i++;
        continue;
      }

      inSingleQuote = !inSingleQuote;
      current += ch;
      continue;
    }

    if (!inSingleQuote) {
      if (ch === "(") {
        depth++;
      } else if (ch === ")") {
        depth = Math.max(0, depth - 1);
      } else if (ch === delimiter && depth === 0) {
        if (current.trim()) {
          parts.push(current.trim());
        }
        current = "";
        continue;
      }
    }

    current += ch;
  }

  if (current.trim()) {
    parts.push(current.trim());
  }

  return parts;
}

function parseQueryParams(queryPart: string): QueryParam[] {
  if (!queryPart.trim()) {
    return [];
  }

  return splitTopLevel(queryPart, "&").map((part) => {
    const idx = part.indexOf("=");
    if (idx < 0) {
      return { key: part.trim(), value: "" };
    }

    return {
      key: part.slice(0, idx).trim(),
      value: part.slice(idx + 1).trim()
    };
  });
}

function firstParamValue(params: QueryParam[], key: string): string | undefined {
  return params.find((p) => p.key.toLowerCase() === key.toLowerCase())?.value;
}

function parseEntityPath(pathPart: string): {
  entitySetName?: string;
  recordId?: string;
  isSingleRecord: boolean;
  isCollection: boolean;
} {
  const clean = pathPart.trim();
  const match = /^([A-Za-z_][A-Za-z0-9_]*)(?:\(([^)]+)\))?$/.exec(clean);

  if (!match) {
    return {
      entitySetName: undefined,
      recordId: undefined,
      isSingleRecord: false,
      isCollection: false
    };
  }

  const entitySetName = match[1];
  const recordId = match[2]?.trim();

  return {
    entitySetName,
    recordId,
    isSingleRecord: !!recordId,
    isCollection: !recordId
  };
}

function parseSelect(value?: string): string[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",").map((x) => x.trim()).filter(Boolean);
}

function parseOrderBy(value?: string): ParsedOrderBy[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",")
    .map((part) => {
      const bits = part.trim().split(/\s+/).filter(Boolean);
      if (!bits.length) {return undefined;}

      return {
        field: bits[0],
        direction: bits[1]?.toLowerCase() === "desc" ? "desc" : "asc"
      } as ParsedOrderBy;
    })
    .filter((x): x is ParsedOrderBy => !!x);
}

function parseTop(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function parseSingleExpand(expandPart: string): ParsedExpand {
  const trimmed = expandPart.trim();
  const openIdx = trimmed.indexOf("(");

  if (openIdx < 0 || !trimmed.endsWith(")")) {
    return {
      navigationProperty: trimmed,
      nestedSelect: [],
      raw: trimmed
    };
  }

  const navigationProperty = trimmed.slice(0, openIdx).trim();
  const inner = trimmed.slice(openIdx + 1, -1).trim();
  const innerParams = parseQueryParams(inner);
  const nestedSelect = parseSelect(firstParamValue(innerParams, "$select"));

  return {
    navigationProperty,
    nestedSelect,
    raw: trimmed
  };
}

function parseExpand(value?: string): ParsedExpand[] {
  if (!value) {
    return [];
  }

  return splitTopLevel(value, ",")
    .map((part) => parseSingleExpand(part))
    .filter((x) => !!x.navigationProperty);
}

function parseDataverseQuery(input: string): ParsedDataverseQuery {
  const normalized = normalizeInput(input);
  const { pathPart, queryPart } = splitPathAndQuery(normalized);
  const path = parseEntityPath(pathPart);
  const params = parseQueryParams(queryPart);

  const select = parseSelect(firstParamValue(params, "$select"));
  const filter = firstParamValue(params, "$filter");
  const orderBy = parseOrderBy(firstParamValue(params, "$orderby"));
  const top = parseTop(firstParamValue(params, "$top"));
  const expand = parseExpand(firstParamValue(params, "$expand"));

  const known = new Set(["$select", "$filter", "$orderby", "$top", "$expand"]);
  const unknownParams = params.filter((p) => !known.has(p.key.toLowerCase()));

  return {
    raw: input,
    normalized,
    pathPart,
    queryPart,
    entitySetName: path.entitySetName,
    recordId: path.recordId,
    isSingleRecord: path.isSingleRecord,
    isCollection: path.isCollection,
    params,
    select,
    filter,
    orderBy,
    top,
    expand,
    unknownParams
  };
}

function buildSummary(parsed: ParsedDataverseQuery, entity?: EntityDef): string {
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
    const orderText = parsed.orderBy
      .map((o) => `${o.field} ${o.direction}`)
      .join(", ");
    parts.push(`Sorts by ${orderText}.`);
  }

  if (typeof parsed.top === "number") {
    parts.push(`Limits the result to ${parsed.top} row${parsed.top === 1 ? "" : "s"}.`);
  }

  if (parsed.expand.length) {
    parts.push(`Includes related data through ${parsed.expand.map((x) => x.navigationProperty).join(", ")}.`);
  }

  return parts.join(" ");
}

function buildFieldLines(fields: string[]): string[] {
  const lines: string[] = [];

  for (const field of fields) {
    const hint = getFieldHint(field);
    lines.push(hint ? `- \`${field}\` — ${hint}` : `- \`${field}\``);
  }

  return lines;
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
  const lines: string[] = [
    clauseFact("$orderby") ?? ""
  ].filter(Boolean);

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
  const lines: string[] = [
    clauseFact("$expand") ?? ""
  ].filter(Boolean);

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

function buildSections(parsed: ParsedDataverseQuery, entity?: EntityDef): ExplanationSection[] {
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
      lines: [
        clauseFact("$select") ?? "",
        "Fields returned:",
        ...buildFieldLines(parsed.select)
      ].filter(Boolean)
    });
  }

  if (parsed.filter) {
    sections.push({
      heading: "$filter",
      lines: buildFilterLines(parsed.filter)
    });
  }

  if (parsed.orderBy.length) {
    sections.push({
      heading: "$orderby",
      lines: buildOrderByLines(parsed.orderBy)
    });
  }

  if (typeof parsed.top === "number") {
    sections.push({
      heading: "$top",
      lines: [
        clauseFact("$top") ?? "",
        `Maximum rows requested: \`${parsed.top}\``
      ].filter(Boolean)
    });
  }

  if (parsed.expand.length) {
    sections.push({
      heading: "$expand",
      lines: buildExpandLines(parsed.expand)
    });
  }

  if (parsed.unknownParams.length) {
    sections.push({
      heading: "Other query options",
      lines: parsed.unknownParams.map((p) =>
        p.value ? `- \`${p.key}=${p.value}\`` : `- \`${p.key}\``
      )
    });
  }

  return sections;
}

function buildIntentLines(parsed: ParsedDataverseQuery): string[] {
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

function buildDesignNotes(parsed: ParsedDataverseQuery): string[] {
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

function buildValidationLines(issues: ValidationIssue[]): string[] {
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

function toMarkdown(parsed: ParsedDataverseQuery, entity: EntityDef | undefined, validationIssues: ValidationIssue[] = []): string {
  const summary = buildSummary(parsed, entity);
  const sections = buildSections(parsed, entity);
  const intentLines = buildIntentLines(parsed);
  const designNotes = buildDesignNotes(parsed);

  const lines: string[] = [];

  lines.push("# DV Quick Run - Explain Query");
  lines.push("");

  lines.push("## Raw Query");
  lines.push("");
  lines.push("```text");
  lines.push(parsed.normalized);
  lines.push("```");
  lines.push("");

  lines.push("## Executive Summary");
  lines.push("");
  lines.push(summary);
  lines.push("");

  lines.push("## Query Intent");
  lines.push("");
  lines.push(...intentLines);
  lines.push("");

  for (const section of sections) {
    lines.push(`## ${section.heading}`);
    lines.push("");
    lines.push(...section.lines);
    lines.push("");
  }

  if (validationIssues.length) {
    lines.push("## Validation");
    lines.push("");
    lines.push(...buildValidationLines(validationIssues));
    lines.push("");
  }

  lines.push("## Design Notes");
  lines.push("");
  lines.push(...designNotes);
  lines.push("");

  lines.push("## Trust Model");
  lines.push("");
  lines.push("- Clause explanations are based on parsed OData query structure.");
  lines.push("- Dataverse-specific hints are applied only for recognised patterns and common system fields.");
  lines.push("- Unknown query options are preserved and shown rather than silently ignored.");
  lines.push("");

  return lines.join("\n");
}

async function tryResolveEntity(
  ctx: CommandContext,
  entitySetName?: string
): Promise<EntityDef | undefined> {
  if (!entitySetName) {
    return undefined;
  }

  try {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);
    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient(baseUrl);
    const defs = await loadEntityDefs(ctx, client, token);

    return findEntityByEntitySetName(defs, entitySetName);
  } catch (e: any) {
    ctx.output.appendLine(`Explain Query metadata resolution skipped: ${e?.message ?? String(e)}`);
    return undefined;
  }
}

async function openMarkdownPreview(markdown: string): Promise<void> {
  const doc = await vscode.workspace.openTextDocument({
    language: "markdown",
    content: markdown
  });

  await vscode.window.showTextDocument(doc, {
    preview: true,
    viewColumn: vscode.ViewColumn.Beside
  });
}

export async function runExplainQueryAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const { text } = getEditorAndRangeText();
    if (!text) {
      throw new Error("No Dataverse query found on the current line or selection.");
    }

    const parsed = parseDataverseQuery(text);
    if (!parsed.entitySetName) {
      throw new Error(`Could not detect entity set from: ${text}`);
    }

    ctx.output.appendLine(`Explain Query input: ${text}`);

    const entity = await tryResolveEntity(ctx, parsed.entitySetName);

    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);
    const token = await ctx.getToken(scope);
    const client: DataverseClient = ctx.getClient(baseUrl);

    const validationIssues = await validateParsedQuery(ctx, client, token, parsed, entity);
    const markdown = toMarkdown(parsed, entity, validationIssues);

    await openMarkdownPreview(markdown);

    ctx.output.appendLine(`Explain Query success for entity set: ${parsed.entitySetName}`);
    vscode.window.showInformationMessage("DV Quick Run: Query explained.");
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: Explain Query failed. Check Output.");
  }
}
