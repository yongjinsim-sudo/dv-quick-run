import { EntityDef } from "../../../../utils/entitySetCache.js";
import { type ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import { buildDesignNotes, buildIntentLines, buildSections, buildSummary, buildValidationLines } from "./explainQuerySections.js";
import { ParsedDataverseQuery } from "./explainQueryTypes.js";

export function toExplainMarkdown(
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  validationIssues: ValidationIssue[] = []
): string {
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
