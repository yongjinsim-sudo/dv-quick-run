import type { AsyncOperationSignal } from "../asyncOperationTypes.js";

export interface AsyncOperationGroup {
  key: string;
  signals: AsyncOperationSignal[];
  failureSignal?: AsyncOperationSignal;
  waitingSignal?: AsyncOperationSignal;
  slowSignal?: AsyncOperationSignal;
  retrySignal?: AsyncOperationSignal;
  repeatCount: number;
  score: number;
}

export interface AsyncOperationRepeatPattern {
  uniqueCorrelationIds: string[];
  uniqueRequestIds: string[];
  isCrossRequestRepetition: boolean;
  isSameRequestRepetition: boolean;
  hasMultipleRequests: boolean;
}

export interface ExecutionRelatedSignal {
  label: string;
  description: string;
  query?: string;
}

export function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)));
}

function buildRelatedPluginTraceCorrelationQuery(correlationId: string): string {
  return `/plugintracelogs?$select=plugintracelogid,correlationid,requestid,typename,messagename,primaryentity,depth,mode,performanceexecutionduration,exceptiondetails,createdon&$filter=${encodeURIComponent(`correlationid eq ${correlationId} or requestid eq ${correlationId}`)}&$orderby=createdon desc&$top=10`;
}

function buildRelatedPluginTraceRequestQuery(requestId: string): string {
  return `/plugintracelogs?$select=plugintracelogid,correlationid,requestid,typename,messagename,primaryentity,depth,mode,performanceexecutionduration,exceptiondetails,createdon&$filter=${encodeURIComponent(`requestid eq ${requestId}`)}&$orderby=createdon desc&$top=10`;
}

export function classifyRepeatPattern(group: AsyncOperationGroup): AsyncOperationRepeatPattern {
  const uniqueCorrelationIds = uniqueStrings(group.signals.map((signal) => signal.correlationId));
  const uniqueRequestIds = uniqueStrings(group.signals.map((signal) => signal.requestId));
  const hasMultipleRequests = uniqueCorrelationIds.length > 1 || uniqueRequestIds.length > 1;

  return {
    uniqueCorrelationIds,
    uniqueRequestIds,
    isCrossRequestRepetition: group.repeatCount >= 2 && hasMultipleRequests,
    isSameRequestRepetition: group.repeatCount >= 2 && !hasMultipleRequests && (uniqueCorrelationIds.length === 1 || uniqueRequestIds.length === 1),
    hasMultipleRequests
  };
}

export function isPrimaryAsyncOperationSignal(group: AsyncOperationGroup, pattern: AsyncOperationRepeatPattern): boolean {
  return group.repeatCount >= 2 && pattern.uniqueRequestIds.length > 1;
}

export function buildPrimarySignalSummary(group: AsyncOperationGroup, pattern: AsyncOperationRepeatPattern): string | undefined {
  if (!isPrimaryAsyncOperationSignal(group, pattern)) {
    return undefined;
  }

  return `This operation is being triggered repeatedly across ${pattern.uniqueRequestIds.length} separate request contexts. Treat this as recurring background activity to investigate, not a single retry loop.`;
}

export function buildGuidedInvestigationSteps(group: AsyncOperationGroup, pattern: AsyncOperationRepeatPattern): string[] {
  if (!isPrimaryAsyncOperationSignal(group, pattern)) {
    return [];
  }

  return [
    "Query asyncoperations by CorrelationId to inspect the related background records.",
    "Sort the results by startedOn or createdOn to confirm the execution sequence.",
    "Compare RequestId values to confirm this spans separate requests rather than one retry loop.",
    "Check whether a plugin, workflow, or cloud flow is updating the same record repeatedly."
  ];
}

export function buildRelatedSignals(pattern: AsyncOperationRepeatPattern): ExecutionRelatedSignal[] {
  const relatedSignals: ExecutionRelatedSignal[] = [];
  const correlationId = pattern.uniqueCorrelationIds[0];
  const requestId = pattern.uniqueRequestIds[0];

  // Related signals are lightweight investigation hints only.
  // They must not imply causal certainty or merged execution reasoning.
  if (correlationId) {
    relatedSignals.push({
      label: "Related plugin traces by CorrelationId",
      description: "Query plugin trace logs with the same correlation context to look for supporting nested or repeated plugin execution.",
      query: buildRelatedPluginTraceCorrelationQuery(correlationId)
    });
  }

  if (!correlationId && requestId) {
    relatedSignals.push({
      label: "Related plugin traces by RequestId",
      description: "Query plugin trace logs with the same request context to look for supporting nested or repeated plugin execution.",
      query: buildRelatedPluginTraceRequestQuery(requestId)
    });
  }

  return relatedSignals;
}
