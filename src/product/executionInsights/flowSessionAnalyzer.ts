import type { DataverseClient } from "../../services/dataverseClient.js";
import type { AsyncOperationSignal } from "./asyncOperationTypes.js";
import {
  DEFAULT_FLOW_SESSION_MAX_ROWS,
  DEFAULT_FLOW_SESSION_TIMEOUT_MS,
  type FlowSessionAnalysisResult,
  type FlowSessionAnalyzerOptions,
  type FlowSessionLookupStatus
} from "./flowSessionTypes.js";
import { buildFlowSessionSignals } from "./flowSessionSignalBuilder.js";
import { buildFlowSessionLinkedQuery, buildFlowSessionSafeLinkedQuery } from "./flowSessionQueryBuilder.js";

export interface FlowSessionAnalyzerArgs {
  client: DataverseClient;
  token: string;
  currentResult?: unknown;
  asyncSignals: AsyncOperationSignal[];
  options?: FlowSessionAnalyzerOptions;
}

interface FlowSessionErrorSummary {
  status: FlowSessionLookupStatus;
  message: string;
}

function classifyFlowSessionError(error: unknown): FlowSessionErrorSummary {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const statusMatch = message.match(/Dataverse error\s+(\d+)/i);
  const statusCode = statusMatch?.[1];

  if (statusCode === "401" || statusCode === "403") {
    return { status: "accessDenied", message: "The current user may not have permission to read flowsessions." };
  }

  if (statusCode === "404") {
    return { status: "unavailable", message: "flowsessions is unavailable in this environment." };
  }

  if (statusCode) {
    return { status: "error", message: `Dataverse returned ${statusCode}.` };
  }

  if (/timeout|timed out|aborted/i.test(message)) {
    return { status: "timeout", message: "The bounded flowsession lookup timed out." };
  }

  return { status: "error", message: "The bounded flowsession lookup could not complete." };
}

function isRecoverableSelectError(error: unknown): boolean {
  const summary = classifyFlowSessionError(error);
  return summary.status === "error" && summary.message === "Dataverse returned 400.";
}

function firstLinkedSignal(signals: AsyncOperationSignal[]): AsyncOperationSignal | undefined {
  return signals.find((signal) => signal.correlationId || signal.requestId || signal.workflowActivationId);
}

async function fetchFlowSessionLookup(args: {
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

export async function analyzeLinkedFlowSessions(args: FlowSessionAnalyzerArgs): Promise<FlowSessionAnalysisResult> {
  const maxRows = args.options?.maxRows ?? DEFAULT_FLOW_SESSION_MAX_ROWS;
  const timeoutMs = args.options?.timeoutMs ?? DEFAULT_FLOW_SESSION_TIMEOUT_MS;
  const currentSignals = buildFlowSessionSignals(args.currentResult, "high").slice(0, maxRows);
  if (currentSignals.length) {
    return {
      signals: currentSignals,
      source: "currentResult",
      status: "success",
      message: `Analysed ${currentSignals.length} flowsession row${currentSignals.length === 1 ? "" : "s"} from the current result.`
    };
  }

  const linkedSignal = firstLinkedSignal(args.asyncSignals);
  if (!linkedSignal) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "No asyncoperation evidence was available for linked flowsession lookup."
    };
  }

  const query = buildFlowSessionLinkedQuery({
    correlationId: linkedSignal.correlationId,
    requestId: linkedSignal.requestId,
    workflowActivationId: linkedSignal.workflowActivationId,
    maxRows
  });
  const safeQuery = buildFlowSessionSafeLinkedQuery({
    correlationId: linkedSignal.correlationId,
    requestId: linkedSignal.requestId,
    workflowActivationId: linkedSignal.workflowActivationId,
    maxRows
  });

  if (!query) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "No valid asyncoperation identifier was available for linked flowsession lookup."
    };
  }

  try {
    const lookup = await fetchFlowSessionLookup({
      client: args.client,
      token: args.token,
      query,
      safeQuery,
      timeoutMs
    });
    const signals = buildFlowSessionSignals(lookup.result, "high").slice(0, maxRows);
    return {
      signals,
      source: "linkedLookup",
      status: signals.length ? "success" : "empty",
      attemptedQuery: lookup.attemptedQuery,
      message: signals.length
        ? `Loaded ${signals.length} flowsession record${signals.length === 1 ? "" : "s"} linked from asyncoperation evidence${lookup.usedSafeSelect ? " using safe fields" : ""}.`
        : "No flowsession records were found for the linked asyncoperation evidence."
    };
  } catch (error) {
    const summary = classifyFlowSessionError(error);
    return {
      signals: [],
      source: "linkedLookup",
      status: summary.status,
      attemptedQuery: query,
      message: summary.status === "accessDenied" || summary.status === "unavailable"
        ? summary.message
        : `Execution Insights could not read flowsessions within the bounded lookup. ${summary.message}`
    };
  }
}
