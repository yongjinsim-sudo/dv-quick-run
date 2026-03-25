export type DiagnosticSeverity = "info" | "warning" | "error";

export interface DiagnosticSuggestedFix {
  label: string;
  detail: string;
  example?: string;
  confidence?: number;
  isSpeculative?: boolean;
}

export interface DiagnosticFinding {
  message: string;
  severity: DiagnosticSeverity;
  suggestion?: string;
  suggestedFix?: DiagnosticSuggestedFix;
  confidence?: number;
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
