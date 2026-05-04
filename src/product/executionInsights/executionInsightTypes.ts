export type ExecutionInsightSource = "pluginTrace" | "asyncOperation" | "workflow" | "flowSession";

export type ExecutionInsightSeverity = "high" | "medium" | "low";

export interface ExecutionEvidenceRef {
  source: ExecutionInsightSource;
  table: "plugintracelogs" | "asyncoperations" | "workflows" | "flowsessions";
  id?: string;
  correlationId?: string;
  requestId?: string;
  operationId?: string;
  workflowId?: string;
  workflowIdUnique?: string;
  workflowActivationId?: string;
  primaryEntityName?: string;
  messageName?: string;
  startedOn?: string;
  completedOn?: string;
  durationMs?: number;
  stateCode?: number;
  statusCode?: number;
  stateLabel?: string;
  statusLabel?: string;
}
