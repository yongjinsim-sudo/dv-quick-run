// src/commands/router/actions/investigateRecord/investigationSignalsBuilder.ts
import { InvestigationDocumentSignal, InvestigationLookupSuggestion, RecordContext } from "./types.js";

const RECENT_MODIFICATION_WINDOW_HOURS = 24;

export function buildInvestigationSignals(args: {
  recordContext: RecordContext;
  record: Record<string, unknown>;
  relatedRecords: InvestigationLookupSuggestion[];
  selectedCandidateType?: "primary" | "related" | "unknown";
  selectedCandidateConfidence?: number;
}): InvestigationDocumentSignal[] {
  const { recordContext, record, relatedRecords, selectedCandidateType, selectedCandidateConfidence } = args;
  const signals: InvestigationDocumentSignal[] = [];

  const primaryNameSignal = buildPrimaryNameSignal(recordContext, record);
  if (primaryNameSignal) {
    signals.push(primaryNameSignal);
  }

  const stateSignal = buildStateSignal(record);
  if (stateSignal) {
    signals.push(stateSignal);
  }

  const ownerSignal = buildMissingLookupSignal(record, "_ownerid_value", "Owner lookup is empty");
  if (ownerSignal) {
    signals.push(ownerSignal);
  }

  const parentSignal = buildMissingLookupSignal(record, "_parentcustomerid_value", "Parent customer lookup is empty");
  if (parentSignal) {
    signals.push(parentSignal);
  }

  const recentSignal = buildRecentModificationSignal(record);
  if (recentSignal) {
    signals.push(recentSignal);
  }

  const candidateSignal = buildCandidateConfidenceSignal(selectedCandidateType, selectedCandidateConfidence);
  if (candidateSignal) {
    signals.push(candidateSignal);
  }

  if (!relatedRecords.length) {
    signals.push({
      severity: "info",
      message: "No lookup relationships were surfaced from the record payload.",
      note: "Worth checking if you expected related record links here."
    });
  }

  return dedupeSignals(signals).slice(0, 5);
}

function buildPrimaryNameSignal(
  recordContext: RecordContext,
  record: Record<string, unknown>
): InvestigationDocumentSignal | undefined {
  if (!recordContext.primaryNameField) {
    return undefined;
  }

  const value = record[recordContext.primaryNameField];
  if (typeof value === "string" && value.trim()) {
    return undefined;
  }

  return {
    severity: "warn",
    message: `Primary name field is empty (${recordContext.primaryNameField}).`,
    note: "Worth checking if the record is expected to be easy to identify in the UI."
  };
}

function buildStateSignal(record: Record<string, unknown>): InvestigationDocumentSignal | undefined {
  const value = record["statecode"];
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  if (String(value).trim() === "0") {
    return undefined;
  }

  return {
    severity: "warn",
    message: `State is non-default (statecode = ${String(value)}).`,
    note: "Worth checking if this record is meant to be active/open."
  };
}

function buildMissingLookupSignal(
  record: Record<string, unknown>,
  logicalName: string,
  message: string
): InvestigationDocumentSignal | undefined {
  if (logicalName in record && !record[logicalName]) {
    return {
      severity: "warn",
      message,
      note: "This is only a structural signal, not a business-rule failure."
    };
  }

  return undefined;
}

function buildRecentModificationSignal(
  record: Record<string, unknown>
): InvestigationDocumentSignal | undefined {
  const value = record["modifiedon"];
  if (typeof value !== "string" || !value.trim()) {
    return undefined;
  }

  const modified = Date.parse(value);
  if (Number.isNaN(modified)) {
    return undefined;
  }

  const hoursAgo = (Date.now() - modified) / (1000 * 60 * 60);
  if (hoursAgo < 0 || hoursAgo > RECENT_MODIFICATION_WINDOW_HOURS) {
    return undefined;
  }

  return {
    severity: "info",
    message: `Record was modified recently (${formatHoursAgo(hoursAgo)} ago).`,
    note: "Worth checking if another user, workflow, or integration touched it."
  };
}

function buildCandidateConfidenceSignal(
  selectedCandidateType?: "primary" | "related" | "unknown",
  selectedCandidateConfidence?: number
): InvestigationDocumentSignal | undefined {
  if (selectedCandidateConfidence === undefined) {
    return undefined;
  }

  if (selectedCandidateType === "primary" && selectedCandidateConfidence >= 90) {
    return undefined;
  }

  return {
    severity: "info",
    message: `Record inference was heuristic (candidate type: ${selectedCandidateType ?? "unknown"}, confidence: ${selectedCandidateConfidence}).`,
    note: "Worth checking if the selected GUID came from the record you intended to inspect."
  };
}

function formatHoursAgo(hoursAgo: number): string {
  if (hoursAgo < 1) {
    const minutes = Math.max(1, Math.round(hoursAgo * 60));
    return `${minutes} minute${minutes === 1 ? "" : "s"}`;
  }

  const rounded = Math.round(hoursAgo);
  return `${rounded} hour${rounded === 1 ? "" : "s"}`;
}

function dedupeSignals(signals: InvestigationDocumentSignal[]): InvestigationDocumentSignal[] {
  const seen = new Set<string>();
  const output: InvestigationDocumentSignal[] = [];

  for (const signal of signals) {
    const key = `${signal.severity}|${signal.message}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(signal);
  }

  return output;
}