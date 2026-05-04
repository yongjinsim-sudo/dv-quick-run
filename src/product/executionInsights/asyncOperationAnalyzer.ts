import type { DataverseClient } from "../../services/dataverseClient.js";
import {
  DEFAULT_ASYNC_OPERATION_MAX_ROWS,
  DEFAULT_ASYNC_OPERATION_TIMEOUT_MS,
  type AsyncOperationAnalysisResult,
  type AsyncOperationAnalyzerOptions,
  type AsyncOperationLookupStatus
} from "./asyncOperationTypes.js";
import {
  buildAsyncOperationCorrelationQuery,
  buildAsyncOperationRecentQuery,
  buildAsyncOperationRequestQuery,
  buildAsyncOperationSafeCorrelationQuery,
  buildAsyncOperationSafeRecentQuery,
  buildAsyncOperationSafeRequestQuery
} from "./asyncOperationQueryBuilder.js";
import {
  buildAsyncOperationSignals,
  findFirstAsyncOperationCorrelationId,
  findFirstAsyncOperationRequestId
} from "./asyncOperationSignalBuilder.js";

export interface AsyncOperationAnalyzerArgs {
  client: DataverseClient;
  token: string;
  currentResult?: unknown;
  queryPath?: string;
  correlationId?: string;
  requestId?: string;
  options?: AsyncOperationAnalyzerOptions;
}

export interface AsyncOperationErrorSummary {
  status: AsyncOperationLookupStatus;
  message: string;
  shouldSuppressExecutionInsights: boolean;
}

export function classifyAsyncOperationError(error: unknown): AsyncOperationErrorSummary {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const statusMatch = message.match(/Dataverse error\s+(\d+)/i);
  const statusCode = statusMatch?.[1];

  if (statusCode === "401" || statusCode === "403") {
    return {
      status: "accessDenied",
      message: "The current user may not have permission to read asyncoperations.",
      shouldSuppressExecutionInsights: true
    };
  }

  if (statusCode === "404") {
    return {
      status: "unavailable",
      message: "asyncoperations is unavailable in this environment.",
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
      message: "The current user may not have permission to read asyncoperations.",
      shouldSuppressExecutionInsights: true
    };
  }

  return {
    status: "error",
    message: "The bounded asyncoperation lookup could not complete.",
    shouldSuppressExecutionInsights: false
  };
}

function isAsyncOperationQuery(queryPath?: string): boolean {
  const trimmed = String(queryPath ?? "").trim().toLowerCase().replace(/^\/+/, "");
  return trimmed.startsWith("asyncoperations") || trimmed.includes("/asyncoperations");
}

function isRecoverableSelectError(error: unknown): boolean {
  const summary = classifyAsyncOperationError(error);
  return summary.status === "error" && summary.message === "Dataverse returned 400.";
}

async function fetchAsyncOperationLookup(args: {
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

export async function analyzeAsyncOperations(args: AsyncOperationAnalyzerArgs): Promise<AsyncOperationAnalysisResult> {
  const maxRows = args.options?.maxRows ?? DEFAULT_ASYNC_OPERATION_MAX_ROWS;
  const timeoutMs = args.options?.timeoutMs ?? DEFAULT_ASYNC_OPERATION_TIMEOUT_MS;
  const currentSignals = buildAsyncOperationSignals(args.currentResult, "high").slice(0, maxRows);

  if (currentSignals.length) {
    return {
      signals: currentSignals,
      source: "currentResult",
      status: "success",
      message: `Analysed ${currentSignals.length} asyncoperation signal${currentSignals.length === 1 ? "" : "s"} from the current Result Viewer payload.`
    };
  }

  const correlationId = args.correlationId ?? findFirstAsyncOperationCorrelationId(args.currentResult);
  const requestId = args.requestId ?? findFirstAsyncOperationRequestId(args.currentResult);
  const correlationQuery = correlationId ? buildAsyncOperationCorrelationQuery(correlationId, maxRows) : undefined;
  const safeCorrelationQuery = correlationId ? buildAsyncOperationSafeCorrelationQuery(correlationId, maxRows) : undefined;
  const requestQuery = !correlationQuery && requestId ? buildAsyncOperationRequestQuery(requestId, maxRows) : undefined;
  const safeRequestQuery = !correlationQuery && requestId ? buildAsyncOperationSafeRequestQuery(requestId, maxRows) : undefined;
  const fallbackQuery = !correlationQuery && !requestQuery && isAsyncOperationQuery(args.queryPath) ? buildAsyncOperationRecentQuery(maxRows) : undefined;
  const safeFallbackQuery = !correlationQuery && !requestQuery && isAsyncOperationQuery(args.queryPath) ? buildAsyncOperationSafeRecentQuery(maxRows) : undefined;
  const query = correlationQuery ?? requestQuery ?? fallbackQuery;
  const safeQuery = correlationQuery ? safeCorrelationQuery : requestQuery ? safeRequestQuery : safeFallbackQuery;

  if (!query) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "Execution Insights need an asyncoperations result or a correlation/request id before bounded asyncoperation lookup can run."
    };
  }

  try {
    const lookup = await fetchAsyncOperationLookup({
      client: args.client,
      token: args.token,
      query,
      safeQuery,
      timeoutMs
    });
    const signals = buildAsyncOperationSignals(lookup.result, correlationQuery || requestQuery ? "high" : "medium").slice(0, maxRows);
    const lookupKind = correlationQuery ? "correlation" : requestQuery ? "request" : "recent asyncoperation";
    return {
      signals,
      source: correlationQuery ? "correlationLookup" : requestQuery ? "requestLookup" : "recentLookup",
      status: signals.length ? "success" : "empty",
      attemptedQuery: lookup.attemptedQuery,
      message: signals.length
        ? `Analysed ${signals.length} asyncoperation signal${signals.length === 1 ? "" : "s"} from a bounded ${lookupKind} lookup${lookup.usedSafeSelect ? " using safe fields" : ""}.`
        : lookup.usedSafeSelect
          ? "No matching asyncoperation records were found in the bounded safe-field lookup."
          : "No matching asyncoperation records with failed, waiting, slow, retry, or repeated execution signals were found in the bounded lookup."
    };
  } catch (error) {
    const summary = classifyAsyncOperationError(error);
    return {
      signals: [],
      source: correlationQuery ? "correlationLookup" : requestQuery ? "requestLookup" : "recentLookup",
      status: summary.status,
      attemptedQuery: query,
      message: summary.status === "accessDenied" || summary.status === "unavailable"
        ? summary.message
        : `Execution Insights could not read asyncoperations within the bounded lookup. ${summary.message}`
    };
  }
}
