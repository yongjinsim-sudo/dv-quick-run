import * as vscode from "vscode";
import type { DiagnosticResult } from "../shared/diagnostics/diagnosticTypes.js";

export interface ExplainSourceTargetSnapshot {
  uri: vscode.Uri;
  range: vscode.Range;
  text?: string;
}

export interface ExplainDocumentState {
  source: ExplainSourceTargetSnapshot;
  diagnostics: DiagnosticResult;
}

const explainDocState = new Map<string, ExplainDocumentState>();

export function setExplainDocumentState(uri: vscode.Uri, state: ExplainDocumentState): void {
  explainDocState.set(uri.toString(), state);
}

export function getExplainDocumentState(uri: vscode.Uri): ExplainDocumentState | undefined {
  return explainDocState.get(uri.toString());
}
