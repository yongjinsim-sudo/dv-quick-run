import { EntityDef } from "../../../../utils/entitySetCache.js";
import type { DiagnosticResult } from "../shared/diagnostics/diagnosticTypes.js";
import { buildDiagnosticMarkdownLines } from "../shared/diagnostics/diagnosticOutputBuilder.js";
import { type ValidationIssue } from "../shared/queryExplain/queryValidation.js";
import { buildDesignNotes, buildIntentLines, buildSections, buildSummary, buildValidationLines } from "./explainQuerySections.js";
import type { ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import { ExplainRelationshipReasoningNote, ParsedDataverseQuery } from "./explainQueryTypes.js";
import type { ExecutionEvidence } from "../shared/diagnostics/executionEvidence.js";

function buildRelationshipReasoningLines(notes: ExplainRelationshipReasoningNote[]): string[] {
  const lines: string[] = [];

  for (const note of notes) {
    lines.push(`- ${note.summary}`);
    lines.push(`  - Clause: \`${note.clause}\``);
    if (note.suggestion) {
      lines.push(`  - Suggestion: ${note.suggestion}`);
    }
  }

  return lines;
}

export function toExplainMarkdown(
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  validationIssues: ValidationIssue[] = [],
  relationshipReasoningNotes: ExplainRelationshipReasoningNote[] = [],
  diagnostics?: DiagnosticResult,
  executionEvidence?: ExecutionEvidence,
  choiceMetadata: ChoiceMetadataDef[] = []
): string {
  const summary = buildSummary(parsed, entity);
  const sections = buildSections(parsed, entity, choiceMetadata);
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

  if (relationshipReasoningNotes.length) {
    lines.push("## Field Provenance & Relationship Advice");
    lines.push("");
    lines.push(...buildRelationshipReasoningLines(relationshipReasoningNotes));
    lines.push("");
  }

  if (executionEvidence) {
    lines.push("## Evidence");
    lines.push("");
    lines.push(`- Observed rows returned: ${executionEvidence.returnedRowCount}`);
    lines.push(`- Observed execution time: ${executionEvidence.executionTimeMs}ms`);
    if (typeof executionEvidence.requestedTop === "number") {
      lines.push(`- Requested $top: ${executionEvidence.requestedTop}`);
      lines.push(`- Returned full requested page: ${executionEvidence.returnedFullPage ? "yes" : "no"}`);
    }
    lines.push(`- Selected column count: ${executionEvidence.selectedColumnCount}`);
    lines.push(`- Expand present: ${executionEvidence.hasExpand ? "yes" : "no"}`);
    if (executionEvidence.filterFieldNames.length) {
      lines.push(`- Filter fields observed: ${executionEvidence.filterFieldNames.map((item) => `\`${item}\``).join(", ")}`);
    }
    lines.push("");
  }

  if (diagnostics?.findings.length) {
    lines.push(...buildDiagnosticMarkdownLines(diagnostics));
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
