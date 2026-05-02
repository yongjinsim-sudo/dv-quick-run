export type PluginTraceConfidence = "high" | "medium" | "low";

export interface PluginTraceSignal {
  pluginTraceLogId?: string;
  correlationId?: string;
  operationId?: string;
  requestId?: string;
  typeName?: string;
  messageName?: string;
  entityName?: string;
  stage?: number;
  mode?: number;
  depth?: number;
  durationMs?: number;
  exceptionMessage?: string;
  createdOn?: string;
  confidence: PluginTraceConfidence;
}

export type PluginTraceLookupStatus =
  | "success"
  | "empty"
  | "accessDenied"
  | "unavailable"
  | "timeout"
  | "error";

export interface PluginTraceAnalysisResult {
  signals: PluginTraceSignal[];
  source: "currentResult" | "correlationLookup" | "recentLookup" | "none";
  status: PluginTraceLookupStatus;
  attemptedQuery?: string;
  message?: string;
}

export interface PluginTraceAnalyzerOptions {
  maxRows?: number;
  timeoutMs?: number;
}

export const DEFAULT_PLUGIN_TRACE_MAX_ROWS = 5;
export const DEFAULT_PLUGIN_TRACE_TIMEOUT_MS = 2500;
