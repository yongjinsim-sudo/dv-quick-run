import {
  InvestigationDocumentModel,
  InvestigationLookupSuggestion,
  InvestigationReverseSuggestion,
  InvestigationDocumentSignal
} from "./types.js";
import { buildInvestigationInterpretation } from "./investigationInterpretationBuilder.js";

export function buildInvestigationDocument(model: InvestigationDocumentModel): string {
  const lines: string[] = [];

  pushBanner(lines, "DATAVERSE RECORD INVESTIGATION");
  pushOverview(lines, model);
  pushInterpretation(lines, model);
  pushSummary(lines, model.summaryFields);
  pushSignals(lines, model.signals);
  pushPointsTo(lines, model.relatedRecords);
  pushReverseLinks(lines, model.reverseLinks);
  pushSuggestedQueries(lines, model.suggestedQueries);
  pushDeveloperHandoff(lines, model);

  return lines.join("\n").trimEnd();
}

function pushBanner(lines: string[], title: string): void {
  lines.push("=".repeat(76));
  lines.push(title);
  lines.push("=".repeat(76));
  lines.push("");
}

function pushOverview(lines: string[], model: InvestigationDocumentModel): void {
  pushSectionTitle(lines, "OVERVIEW");

  pushKeyValue(lines, "Environment", model.environmentName);
  pushKeyValue(lines, "Entity", model.entityLogicalName);
  pushKeyValue(lines, "Entity Set", model.entitySetName);
  pushKeyValue(lines, "Record Id", model.recordId);
  pushKeyValue(lines, "Primary Name", model.primaryName);
  pushKeyValue(lines, "Open In Dataverse", model.uiLink);

  lines.push("");
}


function pushInterpretation(lines: string[], model: InvestigationDocumentModel): void {
  pushSectionTitle(lines, "INTERPRETATION");

  const interpretation = buildInvestigationInterpretation(model);

  if (!interpretation.length) {
    lines.push("  No lightweight interpretation was available.");
    lines.push("");
    return;
  }

  lines.push("  Fast, heuristic meaning layer to help explain what this record likely represents.");
  lines.push("");

  for (const line of interpretation) {
    lines.push(`  - ${line}`);
  }

  lines.push("");
}

function pushSummary(
  lines: string[],
  summaryFields: Array<{ label: string; value: string; category?: string }>
): void {
  pushSectionTitle(lines, "SUMMARY");

  if (!summaryFields.length) {
    lines.push("  No prioritized factual fields were available from the fetched row.");
    lines.push("");
    return;
  }

  lines.push("  Prioritized factual fields from the fetched row. Blank or noisy values are omitted.");
  lines.push("");

  const groups = groupSummaryFields(summaryFields);

  for (const [groupLabel, fields] of groups) {
    lines.push(`  ${groupLabel}`);
    lines.push(`  ${"-".repeat(groupLabel.length)}`);

    const longestLabel = Math.max(...fields.map(field => field.label.length));

    for (const field of fields) {
      lines.push(`  ${padRight(field.label, longestLabel)} : ${field.value}`);
    }

    lines.push("");
  }
}

function pushSignals(
  lines: string[],
  signals: InvestigationDocumentSignal[]
): void {
  pushSectionTitle(lines, "SIGNALS");

  lines.push("  Heuristic hints only. These are not root-cause findings or business-rule conclusions.");
  lines.push("");

  if (!signals.length) {
    lines.push("  [i] No lightweight signals were surfaced.");
    lines.push("");
    return;
  }

  for (const signal of signals) {
    const prefix = signal.severity === "warn" ? "[!]" : "[i]";
    lines.push(`  ${prefix} ${signal.message}`);

    if (signal.note?.trim()) {
      lines.push(`      ${signal.note}`);
    }
  }

  lines.push("");
}

function pushPointsTo(
  lines: string[],
  relatedRecords: InvestigationLookupSuggestion[]
): void {
  pushSectionTitle(lines, "POINTS TO");

  lines.push("  Direct lookup references present on the fetched row.");
  lines.push("  Target resolution is factual when a single target is known, and explicitly marked when a lookup is polymorphic.");
  lines.push("");

  if (!relatedRecords.length) {
    lines.push("  No related lookup records were identified.");
    lines.push("");
    return;
  }

  for (const related of relatedRecords) {
    lines.push(`  → ${related.logicalName}`);
    lines.push(`      Target    : ${related.targetEntityLogicalName ?? "unknown target"}`);

    if ((related.targetOptions?.length ?? 0) > 1) {
      lines.push("      Note      : Polymorphic lookup — multiple valid target entities.");
    }

    lines.push(`      Record Id : ${related.recordId ?? "unknown record id"}`);

    if (related.displayName?.trim()) {
      lines.push(`      Name      : ${related.displayName}`);
    }

    const queries = buildRelatedRecordQueries(related);
    for (const query of queries) {
      lines.push(`      ${query}`);
    }

    lines.push("");
  }
}

function buildRelatedRecordQueries(related: InvestigationLookupSuggestion): string[] {
  if (!related.recordId) {
    return [];
  }

  const entitySets = new Set<string>();

  if (related.targetEntitySetName?.trim()) {
    entitySets.add(related.targetEntitySetName.trim());
  }

  for (const option of related.targetOptions ?? []) {
    if (option.entitySetName?.trim()) {
      entitySets.add(option.entitySetName.trim());
    }
  }

  return [...entitySets].map(entitySetName => `${entitySetName}(${related.recordId})`);
}

function pushReverseLinks(
  lines: string[],
  reverseLinks: InvestigationReverseSuggestion[]
): void {
  pushSectionTitle(lines, "POTENTIAL REVERSE LINKS");

  lines.push("  Metadata-derived follow-up suggestions for records that may point back to this record.");
  lines.push("  These are suggestions, not evidence that related rows currently exist.");
  lines.push("");

  if (!reverseLinks.length) {
    lines.push("  No reverse relationship queries were suggested.");
    lines.push("");
    return;
  }

  for (const reverse of reverseLinks) {
    lines.push(`  ← ${reverse.label}`);
    lines.push(`      Source : ${reverse.sourceEntityLogicalName ?? "unknown source"}`);
    lines.push(`      Via    : ${reverse.referencingAttribute ?? "unknown lookup"}`);
    lines.push(`      ${reverse.query}`);
    lines.push("");
  }
}

function pushSuggestedQueries(lines: string[], queries: string[]): void {
  pushSectionTitle(lines, "SUGGESTED QUERIES");

  lines.push("  Suggested next queries only. These are convenience starting points, not verified findings.");
  lines.push("");

  if (!queries.length) {
    lines.push("  No suggested follow-up queries were available.");
    lines.push("");
    return;
  }

  for (const query of queries) {
    lines.push(`  ${describeSuggestedQuery(query)}`);
    lines.push(`  ${query}`);
    lines.push("");
  }
}

function pushDeveloperHandoff(
  lines: string[],
  model: InvestigationDocumentModel
): void {
  pushSectionTitle(lines, "DEVELOPER HANDOFF");

  const hasCandidateInfo =
    !!model.selectedCandidateFieldName ||
    !!model.selectedCandidateType ||
    model.selectedCandidateConfidence !== undefined ||
    !!model.selectedCandidateReason;

  if (hasCandidateInfo) {
    lines.push("  Candidate Selection");
    lines.push("  -------------------");

    if (model.selectedCandidateFieldName) {
      lines.push(`  Field      : ${model.selectedCandidateFieldName}`);
    }

    if (model.selectedCandidateType) {
      lines.push(`  Type       : ${model.selectedCandidateType}`);
    }

    if (model.selectedCandidateConfidence !== undefined) {
      lines.push(`  Confidence : ${model.selectedCandidateConfidence}`);
    }

    if (model.selectedCandidateReason) {
      lines.push(`  Reason     : ${model.selectedCandidateReason}`);
    }

    lines.push("");
  }

  if (model.inferenceNotes.length) {
    lines.push("  Resolution Notes");
    lines.push("  ---------------");

    for (const note of model.inferenceNotes) {
      lines.push(`  - ${note}`);
    }

    lines.push("");
  }

  if (!hasCandidateInfo && !model.inferenceNotes.length) {
    lines.push("  No additional developer handoff notes were available.");
    lines.push("");
  }
}

function groupSummaryFields(
  summaryFields: Array<{ label: string; value: string; category?: string }>
): Array<[string, Array<{ label: string; value: string }>]> {
  const groups = new Map<string, Array<{ label: string; value: string }>>();
  const categoryLabels: Record<string, string> = {
    identity: "Identity",
    lifecycle: "Lifecycle",
    ownership: "Ownership",
    business: "Business-relevant fields"
  };

  for (const field of summaryFields) {
    const label = categoryLabels[field.category ?? "business"] ?? "Other";
    const group = groups.get(label) ?? [];
    group.push({ label: field.label, value: field.value });
    groups.set(label, group);
  }

  return [...groups.entries()];
}

function pushSectionTitle(lines: string[], title: string): void {
  lines.push(title);
  lines.push("-".repeat(title.length));
}

function pushKeyValue(
  lines: string[],
  label: string,
  value?: string
): void {
  if (!value?.trim()) {
    return;
  }

  lines.push(`  ${padRight(label, 16)} : ${value}`);
}

function buildRelatedRecordQuery(
  related: InvestigationLookupSuggestion
): string | undefined {
  if (!related.targetEntitySetName || !related.recordId) {
    return undefined;
  }

  return `${related.targetEntitySetName}(${related.recordId})`;
}

function describeSuggestedQuery(query: string): string {
  const normalized = query.toLowerCase();

  if (!query.includes("?$")) {
    return "Base record";
  }

  if (normalized.includes("$expand=")) {
    return "Expanded relationship query";
  }

  if (normalized.includes("$filter=")) {
    return "Filtered follow-up query";
  }

  if (normalized.includes("$select=")) {
    return "Compact summary query";
  }

  return "Suggested query";
}

function padRight(value: string, width: number): string {
  return value.padEnd(width, " ");
}