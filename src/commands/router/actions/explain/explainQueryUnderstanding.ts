import type { EntityDef } from "../../../../utils/entitySetCache.js";
import type { DiagnosticResult } from "../shared/diagnostics/diagnosticTypes.js";
import type { ExecutionEvidence } from "../shared/diagnostics/executionEvidence.js";
import type { ExplainResult, ExplainSection } from "../../../../product/explainEngine/explainEngineTypes.js";
import type { UnderstandingComplexity, UnderstandingDocument, UnderstandingReturnedShapeNode, UnderstandingSignal, UnderstandingTraversalNode } from "../../../../product/understanding/understandingTypes.js";
import type { ParsedDataverseQuery } from "./explainQueryTypes.js";

function firstLineFromSection(sections: ExplainSection[], heading: string): string | undefined {
  return sections.find((section) => section.heading === heading)?.lines.find((line) => line.trim().length > 0);
}

function normalizeFilterText(filter: string): string {
  return filter
    .replace(/\s+/g, " ")
    .replace(/([^\s])\b(and|or)\b\s+/gi, "$1 $2 ")
    .replace(/\s+\b(and|or)\b([^\s])/gi, " $1 $2")
    .trim();
}

function normalizePreviewQuery(query?: string): string | undefined {
  if (!query) {
    return undefined;
  }
  return query.replace(/([^\s])\b(and|or)\b\s+/gi, "$1 $2 ").replace(/\s+\b(and|or)\b([^\s])/gi, " $1 $2");
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

function operationLabel(parsed: ParsedDataverseQuery): string {
  if (parsed.isSingleRecord && parsed.recordId) {
    return `Retrieve one record by id ${parsed.recordId}`;
  }
  return "Retrieve multiple records";
}

function buildNarrativeOverview(parsed: ParsedDataverseQuery, entity?: EntityDef): string {
  const target = entity?.logicalName ?? parsed.entitySetName ?? "the target table";
  const parts: string[] = [];

  if (parsed.isSingleRecord) {
    parts.push(`This query inspects one ${target} record.`);
  } else if (parsed.filter) {
    parts.push(`This query retrieves a focused set of ${target} records.`);
  } else {
    parts.push(`This query retrieves ${target} records for discovery or inspection.`);
  }

  if (parsed.select.length) {
    parts.push(`It keeps the payload focused by selecting ${parsed.select.length} column${parsed.select.length === 1 ? "" : "s"}.`);
  } else {
    parts.push("It does not define a projection, so the returned payload may be broader than needed.");
  }

  if (parsed.expand.length) {
    parts.push(`It includes related context through ${parsed.expand.map((item) => item.navigationProperty).join(", ")}.`);
  }

  if (parsed.filter) {
    parts.push("The filter makes this more useful for validation than broad discovery.");
  } else if (!parsed.isSingleRecord) {
    parts.push("Because no filter is present, the result should usually be narrowed before it becomes handoff evidence.");
  }

  return parts.join(" ");
}

function buildIntent(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];
  if (parsed.isSingleRecord) {
    lines.push("- Confirm the shape and values of a known record.");
  } else if (parsed.filter) {
    lines.push("- Validate records that match a specific condition.");
  } else {
    lines.push("- Explore available records before narrowing the investigation.");
  }

  if (parsed.select.length) {
    lines.push("- Return only the fields that are relevant to the current investigation question.");
  }
  if (parsed.orderBy.length) {
    lines.push("- Make result ordering explicit so repeated review is easier to compare.");
  }
  if (typeof parsed.top === "number") {
    lines.push("- Keep the query bounded while the query shape is being validated.");
  }
  if (parsed.expand.length) {
    lines.push("- Bring relationship context into the same inspection surface.");
  }
  return lines;
}

function buildTechnicalSummary(parsed: ParsedDataverseQuery): string[] {
  const lines: string[] = [];
  lines.push(`- Root entity set: \`${parsed.entitySetName ?? "unknown"}\``);
  lines.push(`- Operation: ${operationLabel(parsed)}`);
  lines.push(`- Projection count: ${parsed.select.length}`);
  lines.push(`- Filter present: ${parsed.filter ? "yes" : "no"}`);
  lines.push(`- Expand count: ${parsed.expand.length}`);
  lines.push(`- Order clause count: ${parsed.orderBy.length}`);
  lines.push(`- Server-side filtering: ${parsed.filter ? "yes" : "no"}`);
  lines.push(`- Server-side ordering: ${parsed.orderBy.length ? "yes" : "no"}`);
  lines.push(`- Relationship traversal: ${parsed.expand.length ? "yes" : "no"}`);
  lines.push(`- Payload reduction: ${parsed.select.length ? "yes, via $select" : "no explicit projection"}`);
  if (typeof parsed.top === "number") {
    lines.push(`- Requested row limit: ${parsed.top}`);
  }
  if (parsed.unknownParams.length) {
    lines.push(`- Unknown query options preserved: ${parsed.unknownParams.length}`);
  }
  return lines;
}

function buildTraversal(parsed: ParsedDataverseQuery, entity?: EntityDef): UnderstandingTraversalNode[] {
  const rootName = entity?.displayName ?? parsed.entitySetName ?? "Root";
  const rootTechnical = entity?.logicalName ?? parsed.entitySetName;
  return [
    { label: rootName, technicalName: rootTechnical, depth: 0 },
    ...parsed.expand.map((expand) => ({
      label: expand.navigationProperty,
      technicalName: expand.navigationProperty,
      depth: 1,
      relationship: "OData $expand navigation",
      joinType: "Dataverse navigation expansion"
    }))
  ];
}

function buildReturnedShape(parsed: ParsedDataverseQuery, entity?: EntityDef): UnderstandingReturnedShapeNode[] {
  const rootName = entity?.displayName ?? parsed.entitySetName ?? "Root";
  const rootTechnical = entity?.logicalName ?? parsed.entitySetName;
  return [
    { label: rootName, technicalName: rootTechnical, depth: 0, fields: parsed.select.map((field) => `\`${field}\``) },
    ...parsed.expand.map((expand) => ({
      label: expand.navigationProperty,
      technicalName: expand.navigationProperty,
      depth: 1,
      fields: expand.nestedSelect.map((field) => `\`${field}\``)
    }))
  ];
}

function buildComplexity(parsed: ParsedDataverseQuery): UnderstandingComplexity {
  let score = 10;
  const reasons: string[] = ["Base collection/query understanding." ];

  if (parsed.select.length > 0) {
    score += Math.min(15, parsed.select.length);
    reasons.push(`${parsed.select.length} projected column${parsed.select.length === 1 ? "" : "s"}.`);
  } else {
    score += 15;
    reasons.push("No explicit projection increases payload review complexity.");
  }

  if (parsed.filter) {
    score += 15;
    reasons.push("Server-side filter defines an evidence boundary.");
  }
  if (parsed.orderBy.length) {
    score += 8;
    reasons.push(`${parsed.orderBy.length} ordering clause${parsed.orderBy.length === 1 ? "" : "s"}.`);
  }
  if (parsed.expand.length) {
    score += parsed.expand.length * 18;
    reasons.push(`${parsed.expand.length} relationship expansion${parsed.expand.length === 1 ? "" : "s"}.`);
  }
  if (parsed.expand.some((expand) => expand.nestedSelect.length === 0)) {
    score += 12;
    reasons.push("At least one expand has no nested projection.");
  }
  if (typeof parsed.top !== "number" && !parsed.isSingleRecord) {
    score += 10;
    reasons.push("No row limit is present for collection retrieval.");
  }
  if (parsed.unknownParams.length) {
    score += 10;
    reasons.push("Unknown query options require manual review.");
  }

  const boundedScore = Math.min(100, score);
  const level = boundedScore >= 65 ? "High" : boundedScore >= 35 ? "Medium" : "Low";
  return { level, score: boundedScore, reasons };
}

function buildExpandExplanation(navigationProperty: string): string {
  return `Each root record attempts to include related data through \`${navigationProperty}\`. If no related row exists, the expanded value may be null; if it exists, the related payload is embedded in the response.`;
}

function buildSignals(parsed: ParsedDataverseQuery, result: ExplainResult, diagnostics?: DiagnosticResult, executionEvidence?: ExecutionEvidence): UnderstandingSignal[] {
  const signals: UnderstandingSignal[] = [];

  if (parsed.select.length) {
    signals.push({ kind: "positive", title: "Focused projection", detail: "The query uses $select, which usually makes payloads smaller and explanations clearer.", confidence: "high", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (parsed.filter) {
    signals.push({ kind: "positive", title: "Explicit filter boundary", detail: "The query narrows the evidence set instead of relying on broad table retrieval.", confidence: "high", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (typeof parsed.top === "number") {
    signals.push({ kind: "positive", title: "Bounded retrieval", detail: `The query limits rows with $top=${parsed.top}, keeping the result set reviewable during investigation.`, confidence: "high", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (parsed.expand.every((expand) => expand.nestedSelect.length > 0) && parsed.expand.length > 0) {
    signals.push({ kind: "positive", title: "Bounded related payload", detail: "Every expand has a nested projection, reducing unnecessary related-record payload.", confidence: "medium", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (!parsed.select.length) {
    signals.push({ kind: "smell", title: "Projection not specified", detail: "The query may return more fields than needed, which can make inspection and handoff noisier.", confidence: "high", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (!parsed.filter && !parsed.isSingleRecord) {
    signals.push({ kind: "smell", title: "Unfiltered collection retrieval", detail: "The query is useful for discovery, but the evidence boundary is broad.", confidence: "high", sourceContributor: "dvqr.understanding.v2.2" });
  }
  if (!parsed.orderBy.length && !parsed.isSingleRecord) {
    signals.push({ kind: "risk", title: "No explicit ordering", detail: "Repeated executions may not be directly comparable if the platform returns records in a different order.", confidence: "medium", sourceContributor: "dvqr.understanding.v2.2" });
  }
  for (const expand of parsed.expand.filter((item) => item.nestedSelect.length === 0)) {
    signals.push({ kind: "risk", title: "Expand without nested projection", detail: `The \`${expand.navigationProperty}\` expand may return a broader related payload than needed.`, confidence: "medium", sourceContributor: "dvqr.understanding.v2.2" });
  }
  for (const unknown of result.unknowns) {
    signals.push({ kind: "unknown", title: unknown.label, detail: unknown.impact ? `${unknown.reason} ${unknown.impact}` : unknown.reason, confidence: "low", sourceContributor: "dvqr.understanding.v2.2" });
  }
  for (const finding of diagnostics?.findings ?? []) {
    if (finding.suggestedFix || finding.suggestedQuery || finding.suggestion) {
      continue;
    }
    const relationshipPartial = finding.message.includes("Expand support");
    signals.push({
      kind: relationshipPartial ? "smell" : (finding.severity === "info" ? "positive" : "smell"),
      title: relationshipPartial ? "Relationship diagnostics are partial" : "Query Doctor finding",
      detail: relationshipPartial ? "Nested $expand clauses are recognised, but detailed relationship diagnostics are still advisory." : finding.message,
      confidence: relationshipPartial ? "low" : "medium",
      sourceContributor: "query.doctor.v2"
    });
  }
  if (executionEvidence) {
    signals.push({ kind: "positive", title: "Execution evidence available", detail: `Latest observed execution returned ${executionEvidence.returnedRowCount} rows in ${executionEvidence.executionTimeMs}ms.`, confidence: "medium", sourceContributor: "execution.evidence" });
  }

  return signals;
}

export function buildODataQueryUnderstandingDocument(
  result: ExplainResult,
  parsed: ParsedDataverseQuery,
  entity: EntityDef | undefined,
  diagnostics?: DiagnosticResult,
  executionEvidence?: ExecutionEvidence
): UnderstandingDocument {
  const technicalSections = result.sections.filter((section) => !["Design Notes", "Trust Model", "Raw Query"].includes(section.heading));
  const trustSections = result.sections.filter((section) => ["Design Notes", "Trust Model"].includes(section.heading));
  const targetLine = firstLineFromSection(result.sections, "Target");

  return {
    schemaVersion: "1.0",
    engineVersion: "v2.3",
    title: "DV Quick Run - Query Understanding Report",
    generatedAt: result.context.generatedAt ?? new Date().toISOString(),
    subject: {
      kind: result.context.subjectKind,
      entityLogicalName: result.context.entityLogicalName,
      entitySetName: result.context.entitySetName
    },
    confidence: result.confidence,
    audience: ["investigator", "developer", "admin", "handoff"],
    invariant: "Narrative must never replace technical truth.",
    narrative: {
      overview: buildNarrativeOverview(parsed, entity),
      intent: buildIntent(parsed),
      investigationStage: classifyInvestigationStage(parsed),
      investigationPattern: classifyInvestigationPattern(parsed)
    },
    technical: {
      summary: buildTechnicalSummary(parsed),
      sections: [
        ...technicalSections.map((section) => ({
          heading: section.heading,
          lines: section.heading === "$filter" ? section.lines.map((line) => line.replace(parsed.filter ?? "", parsed.filter ? normalizeFilterText(parsed.filter) : "")) : section.lines,
          confidence: section.confidence,
          sourceContributor: section.sourceContributor
        })),
        ...trustSections.map((section) => ({
          heading: section.heading,
          lines: section.lines,
          confidence: section.confidence,
          sourceContributor: section.sourceContributor
        }))
      ]
    },
    mechanics: {
      rootTarget: targetLine?.replace(/^- Entity set: /, "").replace(/`/g, "") ?? parsed.entitySetName,
      operation: operationLabel(parsed),
      projection: parsed.select,
      filters: parsed.filter ? [normalizeFilterText(parsed.filter)] : [],
      ordering: parsed.orderBy.map((item) => `${item.field} ${item.direction}`),
      expands: parsed.expand.map((expand) => ({ navigationProperty: expand.navigationProperty, nestedProjection: expand.nestedSelect, raw: expand.raw, explanation: buildExpandExplanation(expand.navigationProperty) })),
      rowLimit: parsed.top,
      unknownOptions: parsed.unknownParams.map((param) => param.value ? `${param.key}=${param.value}` : param.key)
    },
    traversal: buildTraversal(parsed, entity),
    returnedShape: buildReturnedShape(parsed, entity),
    complexity: buildComplexity(parsed),
    signals: buildSignals(parsed, result, diagnostics, executionEvidence),
    recommendations: result.recommendations.map((recommendation) => {
      const relationshipPartial = recommendation.detail.includes("Expand support") || recommendation.detail.includes("Diagnostics inside $expand");
      return {
      title: relationshipPartial ? "Relationship diagnostics are partial" : (recommendation.title === "Review diagnostic finding" ? "Review query diagnostic" : recommendation.title),
      detail: relationshipPartial ? "Nested $expand clauses are recognised, but detailed relationship diagnostics are still advisory." : recommendation.detail,
      rationale: "Recommendation is derived from parsed query mechanics, Query Doctor diagnostics, or observed execution evidence. It is advisory and should be reviewed before applying.",
      confidence: relationshipPartial ? "low" : recommendation.confidence,
      actionability: recommendation.actionability,
      previewQuery: normalizePreviewQuery(recommendation.previewQuery),
      sourceContributor: recommendation.sourceContributor
    };
    }),
    evidence: result.evidence.map((evidence) => ({ label: evidence.label, detail: evidence.detail, confidence: evidence.confidence })),
    rawReference: { language: "odata", text: parsed.normalized },
    sourceContributors: result.contributors
  };
}
