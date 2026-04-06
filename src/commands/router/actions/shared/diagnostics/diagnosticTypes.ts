export type DiagnosticSeverity = "info" | "warning" | "error";

export interface DiagnosticSuggestedFix {
  label: string;
  detail: string;
  example?: string;
  confidence?: number;
  isSpeculative?: boolean;
}

export type DiagnosticActionability = "none" | "previewOnly" | "previewAndApply";

export interface DiagnosticFixHook {
  kind: string;
  label: string;
}

export interface DiagnosticSuggestedQuery {
  query: string;
  label?: string;
}

export type NarrowingSuggestionKind = "categorical" | "presence";

export type DiagnosticNarrowingSuggestionTier = "recommended" | "secondary";

export interface DiagnosticNarrowingSuggestion {
  field: string;
  kind: NarrowingSuggestionKind;
  rationale: string;
  reasons: string[];
  tier?: DiagnosticNarrowingSuggestionTier;
  suggestedOperator?: "eq" | "ne";
  suggestedValue?: string | null;
}

export interface DiagnosticFinding {
  message: string;
  severity: DiagnosticSeverity;
  suggestion?: string;
  suggestedFix?: DiagnosticSuggestedFix;
  suggestedQuery?: DiagnosticSuggestedQuery;
  observedDetails?: string[];
  narrowingSuggestions?: DiagnosticNarrowingSuggestion[];
  confidence?: number;
  actionability?: DiagnosticActionability;
  fixHook?: DiagnosticFixHook;
}

export interface DiagnosticResult {
  findings: DiagnosticFinding[];
}

export interface RootCauseGroup {
  id: string;
  title: string;
  confidence: number;
  findings: DiagnosticFinding[];

  summary: string;
  recommendation?: string;
}

export function getDiagnosticActionability(finding: DiagnosticFinding): DiagnosticActionability {
  return finding.actionability ?? "none";
}

export function isActionableDiagnosticFinding(finding: DiagnosticFinding): boolean {
  return getDiagnosticActionability(finding) !== "none";
}
