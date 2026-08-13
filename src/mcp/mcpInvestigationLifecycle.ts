export interface PendingInvestigationIntent {
  readonly leadingDirection: string;
  readonly directionLabel: string;
  readonly directionLogicalName?: string;
  readonly reportedProblem: string;
  readonly reason: string;
}

export type InvestigationConfirmationDisposition = "Confirm" | "Edit" | "Reject";

const CONFIRM_PATTERNS = [
  /^\s*(continue investigation|continue|confirm|yes|yes[,!. ]+that(?: is|'s) correct|looks right|proceed|accept inferred intent)\s*[.!]?\s*$/i,
  /^\s*(yes|yep|yeah|correct|confirmed|accept|accepted)\s*[.!]?\s*$/i,
  /^\s*(?:confirmed|yes|yep|yeah|correct|looks (?:right|good)|sounds good)\s*[,;:-]?\s*(?:please\s+)?(?:continue|proceed)(?:\s+(?:the\s+)?investigation)?\s*[.!]?\s*$/i,
  /^\s*(?:please\s+)?continue(?:\s+(?:the\s+)?investigation)?\s*[.!]?\s*$/i,
  /^\s*looks good\s*[,;:-]?\s*proceed\s*[.!]?\s*$/i
];

const EDIT_PATTERNS = [
  /\bedit investigation\b/i,
  /\bchange (?:the )?(?:focus|problem|goal)\b/i,
  /\bupdate (?:the )?(?:focus|problem|goal|investigation intent)\b/i,
  /\b(?:actually|instead|rather)\b/i,
  /\bfocus (?:on|should be|needs? to be)\b/i,
  /\bthe problem (?:is|should be)\b/i,
  /\buse .+ as (?:the )?(?:focus|problem|goal)\b/i
];

const BYPASS_PATTERNS = [
  /\bskip (?:the )?confirmation\b/i,
  /\bignore (?:the )?confirmation\b/i,
  /\bwithout confirmation\b/i,
  /\bdo not stop for confirmation\b/i,
  /\bdon't stop for confirmation\b/i,
  /\bcontinue anyway\b/i,
  /\bpersist (?:it|intent|the inferred intent) automatically\b/i,
  /\bimmediately confirm\b/i,
  /\bconfirm it and continue\b/i,
  /\bconfirm and continue\b/i
];

export function classifyInvestigationConfirmationText(value: unknown): InvestigationConfirmationDisposition {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return "Reject";
  if (BYPASS_PATTERNS.some((pattern) => pattern.test(text))) return "Reject";
  if (EDIT_PATTERNS.some((pattern) => pattern.test(text))) return "Edit";
  if (CONFIRM_PATTERNS.some((pattern) => pattern.test(text))) return "Confirm";
  return "Reject";
}

function normalizeIntentText(value: string | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/\bwasn['’]?t\b/g, "was not")
    .replace(/\bweren['’]?t\b/g, "were not")
    .replace(/\bisn['’]?t\b/g, "is not")
    .replace(/\baren['’]?t\b/g, "are not")
    .replace(/msemr[_ -]?/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(runtime|path|investigation|investigate|focus|record|table|expected|this|the|for|contact)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeFocus(value: string | undefined): string {
  return normalizeIntentText(value).replace(/\s+/g, "");
}

export function classifyInvestigationProblem(value: string | undefined): string {
  const normalized = normalizeIntentText(value);
  if (/not (created|generated|produced)|never (created|generated|produced)|failed to (?:get )?(?:create|created|generate|generated|produce|produced)|missing|absent/.test(normalized)) return "missing-creation";
  if (/not linked|not associated|wrong (task|relationship|link)|linked to wrong|relationship missing|association/.test(normalized)) return "relationship";
  if (/not updated|failed to update|stale/.test(normalized)) return "update";
  if (/duplicate|created twice/.test(normalized)) return "duplicate";
  if (/incorrect|unexpected|wrong|not working|failed|error/.test(normalized)) return "unexpected";
  return normalized;
}

export function isGenuineInvestigationIntentEdit(args: Record<string, unknown>, pending: PendingInvestigationIntent): boolean {
  const incomingLogicalName = typeof args.directionLogicalName === "string" ? args.directionLogicalName.trim() : "";
  const incomingDirection = typeof args.leadingDirection === "string" ? args.leadingDirection.trim() : "";
  const incomingProblem = typeof args.reportedProblem === "string" ? args.reportedProblem.trim() : "";

  const pendingLogicalFocus = normalizeFocus(pending.directionLogicalName);
  const incomingLogicalFocus = normalizeFocus(incomingLogicalName);
  const pendingLabelFocus = normalizeFocus(pending.leadingDirection || pending.directionLabel);
  const incomingLabelFocus = normalizeFocus(incomingDirection);

  const sameFocus = Boolean(
    (pendingLogicalFocus && incomingLogicalFocus && pendingLogicalFocus === incomingLogicalFocus)
    || (pendingLogicalFocus && incomingLabelFocus && pendingLogicalFocus === incomingLabelFocus)
    || (pendingLabelFocus && incomingLogicalFocus && pendingLabelFocus === incomingLogicalFocus)
    || (pendingLabelFocus && incomingLabelFocus && pendingLabelFocus === incomingLabelFocus)
  );
  const sameProblem = classifyInvestigationProblem(incomingProblem) === classifyInvestigationProblem(pending.reportedProblem);
  return !(sameFocus && sameProblem);
}

export const INVESTIGATION_INTENT_GUARDED_TOOLS = new Set([
  "dvqr_continue_investigation",
  "dvqr_acquire_investigation_evidence",
  "dvqr_acquire_mechanism_context",
  "dvqr_acquire_timeline_context",
  "dvqr_assess_investigation_readiness",
  "dvqr_get_investigation_readiness",
  "dvqr_explain_investigation_readiness",
  "dvqr_get_investigation_gaps",
  "dvqr_get_investigation_evidence_gaps",
  "dvqr_get_contributor_availability",
  "dvqr_get_evidence_recommendations",
  "dvqr_generate_mini_rca",
  "dvqr_generate_mini_rca_checkpoint",
  "dvqr_summarize_investigation",
  "dvqr_list_investigation_evidence",
  "dvqr_explain_investigation_evidence",
  "dvqr_get_supporting_evidence",
  "dvqr_get_contradictory_evidence",
  "dvqr_get_missing_evidence",
  "dvqr_explain_contributor",
  "dvqr_explain_confidence"
]);
