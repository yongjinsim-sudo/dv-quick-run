import type { ExecutionEvidenceRef } from "./executionInsightTypes.js";

export type FlowSessionConfidence = "high" | "medium" | "low";

export interface FlowSessionSignal {
  flowSessionId?: string;
  flowId?: string;
  runId?: string;
  environmentId?: string;
  correlationId?: string;
  requestId?: string;
  workflowActivationId?: string;
  name?: string;
  stateCode?: number;
  stateLabel?: string;
  statusCode?: number;
  statusLabel?: string;
  status?: string;
  startedOn?: string;
  completedOn?: string;
  createdOn?: string;
  modifiedOn?: string;
  errorMessage?: string;
  flowRunUrl?: string;
  confidence: FlowSessionConfidence;
  evidenceRef: ExecutionEvidenceRef;
}

export type FlowSessionLookupStatus =
  | "success"
  | "empty"
  | "accessDenied"
  | "unavailable"
  | "timeout"
  | "error";

export interface FlowSessionAnalysisResult {
  signals: FlowSessionSignal[];
  source: "currentResult" | "linkedLookup" | "none";
  status: FlowSessionLookupStatus;
  attemptedQuery?: string;
  message?: string;
}

export interface FlowSessionAnalyzerOptions {
  maxRows?: number;
  timeoutMs?: number;
}

export const DEFAULT_FLOW_SESSION_MAX_ROWS = 5;
export const DEFAULT_FLOW_SESSION_TIMEOUT_MS = 2500;
