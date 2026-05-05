import type { DataverseClient } from "../../services/dataverseClient.js";
import type { BinderSuggestion } from "../binder/binderTypes.js";
import { analyzeAsyncOperations } from "./asyncOperationAnalyzer.js";
import { buildAsyncOperationInsightSuggestions } from "./asyncOperationInsightBuilder.js";
import { analyzePluginTraces } from "./pluginTraceAnalyzer.js";
import { buildPluginTraceInsightSuggestions } from "./pluginTraceInsightBuilder.js";
import { analyzeLinkedFlowSessions } from "./flowSessionAnalyzer.js";
import { buildFlowSessionInsightSuggestions } from "./flowSessionInsightBuilder.js";
import { analyzeLinkedWorkflows } from "./workflowAnalyzer.js";
import { buildWorkflowInsightSuggestions } from "./workflowInsightBuilder.js";

export interface ExecutionInsightsOrchestratorArgs {
  client: DataverseClient;
  token: string;
  currentResult?: unknown;
  queryPath?: string;
  correlationId?: string;
  requestId?: string;
  operationId?: string;
}

export async function buildExecutionInsightSuggestions(args: ExecutionInsightsOrchestratorArgs): Promise<{
  suggestions: BinderSuggestion[];
  shouldSuppressExecutionInsights: boolean;
}> {
  const lookupId = args.correlationId ?? args.requestId ?? args.operationId;
  const pluginAnalysis = await analyzePluginTraces({
    client: args.client,
    token: args.token,
    currentResult: args.currentResult,
    queryPath: args.queryPath,
    correlationId: lookupId
  });
  const asyncAnalysis = await analyzeAsyncOperations({
    client: args.client,
    token: args.token,
    currentResult: args.currentResult,
    queryPath: args.queryPath,
    correlationId: args.correlationId,
    requestId: args.requestId ?? args.operationId
  });
  const workflowAnalysis = await analyzeLinkedWorkflows({
    client: args.client,
    token: args.token,
    asyncSignals: asyncAnalysis.signals
  });
  const flowSessionAnalysis = await analyzeLinkedFlowSessions({
    client: args.client,
    token: args.token,
    currentResult: args.currentResult,
    asyncSignals: asyncAnalysis.signals
  });

  const shouldSuppressExecutionInsights = [pluginAnalysis.status, asyncAnalysis.status, workflowAnalysis.status, flowSessionAnalysis.status]
    .some((status) => status === "accessDenied" || status === "unavailable");

  const pluginSuggestions = buildPluginTraceInsightSuggestions(pluginAnalysis);
  const asyncSuggestions = buildAsyncOperationInsightSuggestions(asyncAnalysis);
  const workflowSuggestions = buildWorkflowInsightSuggestions(workflowAnalysis);
  const flowSessionSuggestions = buildFlowSessionInsightSuggestions(flowSessionAnalysis);

  return {
    suggestions: [
      ...pluginSuggestions,
      ...asyncSuggestions,
      ...workflowSuggestions,
      ...flowSessionSuggestions
    ].sort((a, b) => b.confidence - a.confidence),
    shouldSuppressExecutionInsights
  };
}
