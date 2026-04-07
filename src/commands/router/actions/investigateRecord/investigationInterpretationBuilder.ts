import type { InvestigationDocumentModel, InvestigationSummaryField } from "./types.js";
import { toFriendlyLabel } from "./investigationDisplayHelpers.js";

const INTERPRETATION_CUE_FIELDS = [
  "scope",
  "type",
  "category",
  "objecttypecode",
  "componentstate",
  "statecode",
  "statuscode",
  "mode"
] as const;

export function buildInvestigationInterpretation(model: InvestigationDocumentModel): string[] {
  const lines: string[] = [];
  const role = inferRecordRole(model);
  const sourceField = normalizeFieldName(model.selectedCandidateFieldName);
  const confidence = describeConfidence(model.selectedCandidateConfidence);
  const cue = pickInterpretationCue(model.summaryFields);

  if (role) {
    lines.push(`${confidence}${role}.`);
  } else {
    lines.push(`${confidence}This appears to be a ${toFriendlyLabel(model.entityLogicalName).toLowerCase()} record.`);
  }

  if (sourceField) {
    lines.push(`It was opened from the \`${sourceField}\` field, so this looks like a direct record reference rather than the primary row itself.`);
  }

  if (cue) {
    lines.push(`Context cue: ${cue.label} = ${cue.value}.`);
  }

  if (!model.primaryName?.trim()) {
    lines.push("This record may be easier to recognise by technical role or relationship than by display name.");
  }

  return dedupe(lines);
}

function inferRecordRole(model: InvestigationDocumentModel): string | undefined {
  const tokens = collectTokens(model);

  if (hasAny(tokens, ["process", "workflow", "trigger", "stage", "approval", "flow"])) {
    if (hasAny(tokens, ["form", "template", "page", "view", "ui", "render"])) {
      return "This likely represents a process-related configuration record tied to a UI or form surface";
    }

    return "This likely represents a process-related configuration or automation record";
  }

  if (hasAny(tokens, ["form", "template", "page", "view", "render", "component", "control"])) {
    return "This likely represents a UI or configuration artifact rather than day-to-day business data";
  }

  if (hasAny(tokens, ["solution", "plugin", "webresource", "workflow", "sdkmessage", "entitymap"])) {
    return "This likely represents a platform or solution artifact";
  }

  if (hasAny(tokens, ["address", "contact", "account", "lead", "opportunity", "case", "incident"])) {
    return `This appears to be an application data record related to ${toFriendlyLabel(model.entityLogicalName).toLowerCase()}`;
  }

  return undefined;
}

function collectTokens(model: InvestigationDocumentModel): Set<string> {
  const values: string[] = [
    model.entityLogicalName,
    model.entitySetName,
    model.selectedCandidateFieldName ?? ""
  ];

  for (const field of model.summaryFields) {
    values.push(field.logicalName, field.label);
  }

  const tokens = new Set<string>();

  for (const value of values) {
    for (const token of tokenize(value)) {
      tokens.add(token);
    }
  }

  return tokens;
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
}

function hasAny(tokens: Set<string>, expected: readonly string[]): boolean {
  return expected.some(token => tokens.has(token));
}

function normalizeFieldName(value: string | undefined): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return value.trim();
}

function describeConfidence(value: number | undefined): string {
  if (typeof value !== "number") {
    return "Heuristic interpretation: ";
  }

  if (value >= 85) {
    return "High-confidence interpretation: ";
  }

  if (value >= 60) {
    return "Medium-confidence interpretation: ";
  }

  return "Low-confidence interpretation: ";
}

function pickInterpretationCue(summaryFields: InvestigationSummaryField[]): InvestigationSummaryField | undefined {
  return summaryFields.find(field => INTERPRETATION_CUE_FIELDS.some(token => field.logicalName.toLowerCase().includes(token)));
}

function dedupe(values: string[]): string[] {
  return [...new Set(values.filter(value => value.trim().length > 0))];
}
