import type { ExecutionEvidenceRef } from "./executionInsightTypes.js";

export type WorkflowConfidence = "high" | "medium" | "low";

export interface WorkflowSignal {
  workflowId?: string;
  workflowIdUnique?: string;
  activeWorkflowId?: string;
  name?: string;
  category?: number;
  categoryLabel?: string;
  mode?: number;
  modeLabel?: string;
  primaryEntity?: string;
  stateCode?: number;
  stateLabel?: string;
  statusCode?: number;
  statusLabel?: string;
  type?: number;
  typeLabel?: string;
  modifiedOn?: string;
  createdOn?: string;
  confidence: WorkflowConfidence;
  evidenceRef: ExecutionEvidenceRef;
}

export type WorkflowLookupStatus =
  | "success"
  | "empty"
  | "accessDenied"
  | "unavailable"
  | "timeout"
  | "error";

export interface WorkflowAnalysisResult {
  signals: WorkflowSignal[];
  source: "linkedLookup" | "none";
  status: WorkflowLookupStatus;
  attemptedQuery?: string;
  message?: string;
}

export interface WorkflowAnalyzerOptions {
  maxRows?: number;
  timeoutMs?: number;
}

export const DEFAULT_WORKFLOW_MAX_ROWS = 5;
export const DEFAULT_WORKFLOW_TIMEOUT_MS = 2500;
