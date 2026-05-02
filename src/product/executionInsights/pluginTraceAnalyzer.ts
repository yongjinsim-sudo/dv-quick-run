import type { DataverseClient } from "../../services/dataverseClient.js";
import {
  DEFAULT_PLUGIN_TRACE_MAX_ROWS,
  DEFAULT_PLUGIN_TRACE_TIMEOUT_MS,
  type PluginTraceAnalysisResult,
  type PluginTraceAnalyzerOptions,
  type PluginTraceLookupStatus
} from "./pluginTraceTypes.js";
import {
  buildPluginTraceCorrelationQuery,
  buildPluginTraceRecentQuery,
  buildPluginTraceSafeCorrelationQuery,
  buildPluginTraceSafeRecentQuery
} from "./pluginTraceQueryBuilder.js";
import { buildPluginTraceSignals, findFirstTraceCorrelationId } from "./pluginTraceSignalBuilder.js";

export interface PluginTraceAnalyzerArgs {
  client: DataverseClient;
  token: string;
  currentResult?: unknown;
  queryPath?: string;
  correlationId?: string;
  options?: PluginTraceAnalyzerOptions;
}

export interface PluginTraceErrorSummary {
  status: PluginTraceLookupStatus;
  message: string;
  shouldSuppressExecutionInsights: boolean;
}

export function summarizePluginTraceError(error: unknown): string {
  return classifyPluginTraceError(error).message;
}

export function classifyPluginTraceError(error: unknown): PluginTraceErrorSummary {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const statusMatch = message.match(/Dataverse error\s+(\d+)/i);
  const statusCode = statusMatch?.[1];

  if (statusCode === "401" || statusCode === "403") {
    return {
      status: "accessDenied",
      message: "The current user may not have permission to read plugintracelogs.",
      shouldSuppressExecutionInsights: true
    };
  }

  if (statusCode === "404") {
    return {
      status: "unavailable",
      message: "plugintracelogs is unavailable in this environment.",
      shouldSuppressExecutionInsights: true
    };
  }

  if (statusCode) {
    return {
      status: "error",
      message: `Dataverse returned ${statusCode}.`,
      shouldSuppressExecutionInsights: false
    };
  }

  if (/timeout|timed out|aborted/i.test(message)) {
    return {
      status: "timeout",
      message: "The bounded lookup timed out.",
      shouldSuppressExecutionInsights: false
    };
  }

  if (/forbidden|permission|unauthori[sz]ed/i.test(message)) {
    return {
      status: "accessDenied",
      message: "The current user may not have permission to read plugintracelogs.",
      shouldSuppressExecutionInsights: true
    };
  }

  return {
    status: "error",
    message: "The bounded lookup could not complete.",
    shouldSuppressExecutionInsights: false
  };
}

function isPluginTraceQuery(queryPath?: string): boolean {
  const trimmed = String(queryPath ?? "").trim().toLowerCase().replace(/^\/+/, "");
  return trimmed.startsWith("plugintracelogs") || trimmed.includes("/plugintracelogs");
}

function isRecoverableSelectError(error: unknown): boolean {
  const summary = classifyPluginTraceError(error);
  return summary.status === "error" && summary.message === "Dataverse returned 400.";
}

async function fetchPluginTraceLookup(args: {
  client: DataverseClient;
  token: string;
  query: string;
  safeQuery?: string;
  timeoutMs: number;
}): Promise<{ result: unknown; attemptedQuery: string; usedSafeSelect: boolean }> {
  try {
    const result = await args.client.get(args.query, args.token, { timeoutMs: args.timeoutMs }) as unknown;
    return { result, attemptedQuery: args.query, usedSafeSelect: false };
  } catch (error) {
    if (!args.safeQuery || !isRecoverableSelectError(error)) {
      throw error;
    }

    const result = await args.client.get(args.safeQuery, args.token, { timeoutMs: args.timeoutMs }) as unknown;
    return { result, attemptedQuery: args.safeQuery, usedSafeSelect: true };
  }
}

export async function analyzePluginTraces(args: PluginTraceAnalyzerArgs): Promise<PluginTraceAnalysisResult> {
  const maxRows = args.options?.maxRows ?? DEFAULT_PLUGIN_TRACE_MAX_ROWS;
  const timeoutMs = args.options?.timeoutMs ?? DEFAULT_PLUGIN_TRACE_TIMEOUT_MS;
  const currentSignals = buildPluginTraceSignals(args.currentResult, "high").slice(0, maxRows);

  if (currentSignals.length) {
    return {
      signals: currentSignals,
      source: "currentResult",
      status: "success",
      message: `Analysed ${currentSignals.length} plugin trace signal${currentSignals.length === 1 ? "" : "s"} from the current Result Viewer payload.`
    };
  }

  const correlationId = args.correlationId ?? findFirstTraceCorrelationId(args.currentResult);
  const correlationQuery = correlationId ? buildPluginTraceCorrelationQuery(correlationId, maxRows) : undefined;
  const safeCorrelationQuery = correlationId ? buildPluginTraceSafeCorrelationQuery(correlationId, maxRows) : undefined;
  const fallbackQuery = isPluginTraceQuery(args.queryPath) ? buildPluginTraceRecentQuery(maxRows) : undefined;
  const safeFallbackQuery = isPluginTraceQuery(args.queryPath) ? buildPluginTraceSafeRecentQuery(maxRows) : undefined;
  const query = correlationQuery ?? fallbackQuery;
  const safeQuery = correlationQuery ? safeCorrelationQuery : safeFallbackQuery;

  if (!query) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "Execution Insights need a plugintracelogs result or a correlation/request id before bounded trace lookup can run."
    };
  }

  try {
    const lookup = await fetchPluginTraceLookup({
      client: args.client,
      token: args.token,
      query,
      safeQuery,
      timeoutMs
    });
    const signals = buildPluginTraceSignals(lookup.result, correlationQuery ? "high" : "medium").slice(0, maxRows);
    const lookupKind = correlationQuery ? "correlation" : "recent trace";
    return {
      signals,
      source: correlationQuery ? "correlationLookup" : "recentLookup",
      status: signals.length ? "success" : "empty",
      attemptedQuery: lookup.attemptedQuery,
      message: signals.length
        ? `Analysed ${signals.length} plugin trace signal${signals.length === 1 ? "" : "s"} from a bounded ${lookupKind} lookup${lookup.usedSafeSelect ? " using safe fields" : ""}.`
        : lookup.usedSafeSelect
          ? "No matching plugin trace records were found in the bounded safe-field lookup."
          : "No matching plugin trace records with exception, duration, depth, or repeated execution signals were found in the bounded lookup."
    };
  } catch (error) {
    const summary = classifyPluginTraceError(error);
    return {
      signals: [],
      source: correlationQuery ? "correlationLookup" : "recentLookup",
      status: summary.status,
      attemptedQuery: query,
      message: summary.status === "accessDenied" || summary.status === "unavailable"
        ? summary.message
        : `Execution Insights could not read plugintracelogs within the bounded lookup. ${summary.message}`
    };
  }
}
