import type { DataverseClient } from "../../services/dataverseClient.js";
import type { AsyncOperationSignal } from "./asyncOperationTypes.js";
import {
  DEFAULT_WORKFLOW_MAX_ROWS,
  DEFAULT_WORKFLOW_TIMEOUT_MS,
  type WorkflowAnalysisResult,
  type WorkflowAnalyzerOptions,
  type WorkflowLookupStatus
} from "./workflowTypes.js";
import { findWorkflowActivationIds } from "./asyncOperationSignalBuilder.js";
import { buildWorkflowByIdQuery, buildWorkflowSafeByIdQuery } from "./workflowQueryBuilder.js";
import { buildWorkflowSignals } from "./workflowSignalBuilder.js";

export interface WorkflowAnalyzerArgs {
  client: DataverseClient;
  token: string;
  asyncSignals: AsyncOperationSignal[];
  options?: WorkflowAnalyzerOptions;
}

interface WorkflowErrorSummary {
  status: WorkflowLookupStatus;
  message: string;
}

function classifyWorkflowError(error: unknown): WorkflowErrorSummary {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const statusMatch = message.match(/Dataverse error\s+(\d+)/i);
  const statusCode = statusMatch?.[1];

  if (statusCode === "401" || statusCode === "403") {
    return { status: "accessDenied", message: "The current user may not have permission to read workflows." };
  }

  if (statusCode === "404") {
    return { status: "unavailable", message: "workflows is unavailable in this environment." };
  }

  if (statusCode) {
    return { status: "error", message: `Dataverse returned ${statusCode}.` };
  }

  if (/timeout|timed out|aborted/i.test(message)) {
    return { status: "timeout", message: "The bounded workflow lookup timed out." };
  }

  return { status: "error", message: "The bounded workflow lookup could not complete." };
}

function isRecoverableSelectError(error: unknown): boolean {
  const summary = classifyWorkflowError(error);
  return summary.status === "error" && summary.message === "Dataverse returned 400.";
}

async function fetchWorkflowLookup(args: {
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

export async function analyzeLinkedWorkflows(args: WorkflowAnalyzerArgs): Promise<WorkflowAnalysisResult> {
  const maxRows = args.options?.maxRows ?? DEFAULT_WORKFLOW_MAX_ROWS;
  const timeoutMs = args.options?.timeoutMs ?? DEFAULT_WORKFLOW_TIMEOUT_MS;
  const ids = findWorkflowActivationIds(args.asyncSignals).slice(0, maxRows);
  const firstId = ids[0];

  if (!firstId) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "No linked workflow activation id was present in the asyncoperation evidence."
    };
  }

  const query = buildWorkflowByIdQuery(firstId, maxRows);
  const safeQuery = buildWorkflowSafeByIdQuery(firstId, maxRows);
  if (!query) {
    return {
      signals: [],
      source: "none",
      status: "empty",
      message: "The linked workflow activation id was not a valid GUID."
    };
  }

  try {
    const lookup = await fetchWorkflowLookup({
      client: args.client,
      token: args.token,
      query,
      safeQuery,
      timeoutMs
    });
    const signals = buildWorkflowSignals(lookup.result, "high").slice(0, maxRows);
    return {
      signals,
      source: "linkedLookup",
      status: signals.length ? "success" : "empty",
      attemptedQuery: lookup.attemptedQuery,
      message: signals.length
        ? `Loaded ${signals.length} workflow metadata record${signals.length === 1 ? "" : "s"} linked from asyncoperation evidence${lookup.usedSafeSelect ? " using safe fields" : ""}.`
        : "No workflow metadata records were found for the linked asyncoperation evidence."
    };
  } catch (error) {
    const summary = classifyWorkflowError(error);
    return {
      signals: [],
      source: "linkedLookup",
      status: summary.status,
      attemptedQuery: query,
      message: summary.status === "accessDenied" || summary.status === "unavailable"
        ? summary.message
        : `Execution Insights could not read workflows within the bounded lookup. ${summary.message}`
    };
  }
}
