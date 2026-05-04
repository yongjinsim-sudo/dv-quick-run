import type { ExecutionEvidenceRef, ExecutionInsightSeverity } from "./executionInsightTypes.js";

export type AsyncOperationConfidence = "high" | "medium" | "low";

export interface AsyncOperationSignal {
  asyncOperationId?: string;
  correlationId?: string;
  requestId?: string;
  operationId?: string;
  workflowActivationId?: string;
  name?: string;
  operationType?: number;
  operationTypeLabel?: string;
  messageName?: string;
  primaryEntityType?: string;
  stateCode?: number;
  stateLabel?: string;
  statusCode?: number;
  statusLabel?: string;
  startedOn?: string;
  completedOn?: string;
  modifiedOn?: string;
  createdOn?: string;
  executionTimeSeconds?: number;
  executionTimeMs?: number;
  depth?: number;
  retryCount?: number;
  isWaitingForEvent?: boolean;
  errorCode?: number;
  message?: string;
  friendlyMessageSummary?: string;
  confidence: AsyncOperationConfidence;
  severity: ExecutionInsightSeverity;
  evidenceRef: ExecutionEvidenceRef;
}

export type AsyncOperationLookupStatus =
  | "success"
  | "empty"
  | "accessDenied"
  | "unavailable"
  | "timeout"
  | "error";

export interface AsyncOperationAnalysisResult {
  signals: AsyncOperationSignal[];
  source: "currentResult" | "correlationLookup" | "requestLookup" | "recentLookup" | "none";
  status: AsyncOperationLookupStatus;
  attemptedQuery?: string;
  message?: string;
}

export interface AsyncOperationAnalyzerOptions {
  maxRows?: number;
  timeoutMs?: number;
  slowMs?: number;
  verySlowMs?: number;
}

export const DEFAULT_ASYNC_OPERATION_MAX_ROWS = 5;
export const DEFAULT_ASYNC_OPERATION_TIMEOUT_MS = 2500;
export const DEFAULT_ASYNC_OPERATION_SLOW_MS = 5000;
export const DEFAULT_ASYNC_OPERATION_VERY_SLOW_MS = 30000;
