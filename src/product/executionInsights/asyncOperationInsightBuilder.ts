import type { BinderSuggestion } from "../binder/binderTypes.js";
import type { AsyncOperationAnalysisResult, AsyncOperationSignal } from "./asyncOperationTypes.js";

const SLOW_ASYNC_OPERATION_MS = 5000;
const VERY_SLOW_ASYNC_OPERATION_MS = 30000;
const MAX_ASYNC_OPERATION_INSIGHTS = 1;

type ExecutionSeverity = "high" | "medium" | "low";

interface ExecutionInsightIdentifier {
  label: string;
  value: string;
  query?: string;
}

interface ExecutionInsightFollowUpQuery {
  label: string;
  query: string;
}

function uniqueStrings(values: Array<string | undefined>): string[] {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => !!value)));
}

function formatDuration(ms: number | undefined): string | undefined {
  if (typeof ms !== "number" || !Number.isFinite(ms)) {
    return undefined;
  }

  if (ms >= 60_000) {
    return `${Math.round(ms / 1000)}s (${ms}ms)`;
  }

  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s (${ms}ms)`;
  }

  return `${ms}ms`;
}

function buildAsyncOperationRecordQuery(id: string): string {
  return `/asyncoperations(${id})`;
}

function buildAsyncOperationCorrelationQuery(correlationId: string): string {
  return `/asyncoperations?$select=name,asyncoperationid,correlationid,requestid,statecode,statuscode,startedon,completedon,executiontimespan,_workflowactivationid_value&$filter=correlationid eq ${correlationId}&$top=10`;
}

function buildAsyncOperationRequestQuery(requestId: string): string {
  return `/asyncoperations?$select=name,asyncoperationid,correlationid,requestid,statecode,statuscode,startedon,completedon,executiontimespan,_workflowactivationid_value&$filter=requestid eq ${requestId}&$top=10`;
}

function buildWorkflowRecordQuery(workflowId: string): string {
  return `/workflows(${workflowId})?$select=name,workflowid,workflowidunique,category,mode,primaryentity,statecode,statuscode`;
}

function buildKeyIdentifiers(group: AsyncOperationGroup): ExecutionInsightIdentifier[] {
  const correlationIds = uniqueStrings(group.signals.map((signal) => signal.correlationId));
  const requestIds = uniqueStrings(group.signals.map((signal) => signal.requestId));
  const asyncOperationIds = uniqueStrings(group.signals.map((signal) => signal.asyncOperationId));
  const workflowActivationIds = uniqueStrings(group.signals.map((signal) => signal.workflowActivationId));
  const identifiers: ExecutionInsightIdentifier[] = [];

  for (const value of correlationIds.slice(0, 3)) {
    identifiers.push({
      label: "CorrelationId",
      value,
      query: buildAsyncOperationCorrelationQuery(value)
    });
  }

  for (const value of requestIds.slice(0, 3)) {
    identifiers.push({
      label: "RequestId",
      value,
      query: buildAsyncOperationRequestQuery(value)
    });
  }

  for (const value of asyncOperationIds.slice(0, 5)) {
    identifiers.push({
      label: "AsyncOperationId",
      value,
      query: buildAsyncOperationRecordQuery(value)
    });
  }

  for (const value of workflowActivationIds.slice(0, 3)) {
    identifiers.push({
      label: "WorkflowActivationId",
      value,
      query: buildWorkflowRecordQuery(value)
    });
  }

  return identifiers;
}

function buildFollowUpQueries(group: AsyncOperationGroup): ExecutionInsightFollowUpQuery[] {
  const identifiers = buildKeyIdentifiers(group);
  const seen = new Set<string>();
  const preferredOrder = ["CorrelationId", "RequestId", "AsyncOperationId", "WorkflowActivationId"];
  const queries: ExecutionInsightFollowUpQuery[] = [];

  for (const label of preferredOrder) {
    const identifier = identifiers.find((item) => item.label === label && item.query && !seen.has(item.query));

    if (!identifier?.query) {
      continue;
    }

    seen.add(identifier.query);
    queries.push({
      label: `Query by ${identifier.label}`,
      query: identifier.query
    });
  }

  return queries.slice(0, 3);
}

interface AsyncOperationGroup {
  key: string;
  signals: AsyncOperationSignal[];
  failureSignal?: AsyncOperationSignal;
  waitingSignal?: AsyncOperationSignal;
  slowSignal?: AsyncOperationSignal;
  retrySignal?: AsyncOperationSignal;
  repeatCount: number;
  score: number;
}

interface AsyncOperationRepeatPattern {
  uniqueCorrelationIds: string[];
  uniqueRequestIds: string[];
  isCrossRequestRepetition: boolean;
  isSameRequestRepetition: boolean;
  hasMultipleRequests: boolean;
}

function classifyRepeatPattern(group: AsyncOperationGroup): AsyncOperationRepeatPattern {
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

function parseAsyncOperationTime(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function getAsyncOperationTimeSpanMs(signals: AsyncOperationSignal[]): number | undefined {
  const times = signals
    .map((signal) => parseAsyncOperationTime(signal.startedOn ?? signal.createdOn ?? signal.modifiedOn))
    .filter((time): time is number => typeof time === "number");

  if (times.length < 2) {
    return undefined;
  }

  return Math.max(...times) - Math.min(...times);
}

function isBenignHistoricalAsyncRepeat(group: AsyncOperationGroup): boolean {
  const spanMs = getAsyncOperationTimeSpanMs(group.signals);
  const isHistorical = typeof spanMs === "number" && spanMs > 60 * 60 * 1000;
  const allSucceeded = group.signals.every((signal) => {
    const combined = `${signal.stateLabel ?? ""} ${signal.statusLabel ?? ""}`.toLowerCase();
    return /completed|succeeded|success/.test(combined) && !/failed|cancel|suspend|waiting|wait/.test(combined);
  });
  const maxDurationMs = Math.max(...group.signals.map((signal) => signal.executionTimeMs ?? 0), 0);

  return group.repeatCount >= 2 &&
    isHistorical &&
    allSucceeded &&
    maxDurationMs < SLOW_ASYNC_OPERATION_MS &&
    !group.failureSignal &&
    !group.waitingSignal &&
    !group.retrySignal;
}

function buildSuggestion(args: {
  text: string;
  reason: string;
  confidence: number;
  payload: Record<string, unknown>;
}): BinderSuggestion {
  return {
    text: args.text,
    actionId: "requestExecutionInsights",
    confidence: args.confidence,
    reason: args.reason,
    source: "execution",
    tier: "external",
    canApply: false,
    applyLabel: "Get Execution Insights",
    payload: args.payload
  };
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function displayOperationName(signal: AsyncOperationSignal): string {
  return signal.name || signal.operationTypeLabel || signal.messageName || signal.asyncOperationId || "Async operation";
}

function isFailure(signal: AsyncOperationSignal): boolean {
  const combined = `${signal.stateLabel ?? ""} ${signal.statusLabel ?? ""}`.toLowerCase();
  return signal.severity === "high" || /failed|cancel/.test(combined) || typeof signal.errorCode === "number";
}

function isWaiting(signal: AsyncOperationSignal): boolean {
  const combined = `${signal.stateLabel ?? ""} ${signal.statusLabel ?? ""}`.toLowerCase();
  return /suspend|waiting|wait/.test(combined) || signal.isWaitingForEvent === true;
}

function scoreSignal(signal: AsyncOperationSignal): number {
  return (
    (isFailure(signal) ? 10_000 : 0) +
    (isWaiting(signal) ? 2_000 : 0) +
    (signal.executionTimeMs ?? 0) +
    (signal.retryCount ?? 0) * 500
  );
}

function chooseHighest<T extends AsyncOperationSignal>(signals: T[], score: (signal: T) => number): T | undefined {
  return [...signals].sort((a, b) => score(b) - score(a))[0];
}

function buildAsyncOperationGroups(signals: AsyncOperationSignal[]): AsyncOperationGroup[] {
  const map = new Map<string, AsyncOperationSignal[]>();

  for (const signal of signals) {
    const key = signal.name ?? signal.operationTypeLabel ?? signal.messageName ?? signal.asyncOperationId ?? "unknown async operation";
    const existing = map.get(key) ?? [];
    existing.push(signal);
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([key, groupSignals]) => {
      const failureSignal = chooseHighest(groupSignals.filter(isFailure), scoreSignal);
      const waitingSignal = chooseHighest(groupSignals.filter(isWaiting), scoreSignal);
      const slowSignal = chooseHighest(
        groupSignals.filter((signal) => typeof signal.executionTimeMs === "number" && signal.executionTimeMs >= SLOW_ASYNC_OPERATION_MS),
        (signal) => signal.executionTimeMs ?? 0
      );
      const retrySignal = chooseHighest(
        groupSignals.filter((signal) => (signal.retryCount ?? 0) > 0),
        (signal) => signal.retryCount ?? 0
      );
      const repeatCount = groupSignals.length;
      const score = Math.max(...groupSignals.map(scoreSignal), 0) + (repeatCount >= 2 ? repeatCount * 300 : 0);

      return {
        key,
        signals: [...groupSignals].sort((a, b) => scoreSignal(b) - scoreSignal(a)),
        failureSignal,
        waitingSignal,
        slowSignal,
        retrySignal,
        repeatCount,
        score
      };
    })
    .filter((group) => {
      if (isBenignHistoricalAsyncRepeat(group)) {
        return false;
      }

      const isVerySlow = (group.slowSignal?.executionTimeMs ?? 0) >= VERY_SLOW_ASYNC_OPERATION_MS;
      const hasConcreteSignal =
        !!group.failureSignal ||
        !!group.waitingSignal ||
        !!group.retrySignal ||
        group.repeatCount >= 2 ||
        isVerySlow;

      return hasConcreteSignal;
    })
    .sort((a, b) => b.score - a.score);
}

function buildRawDetails(group: AsyncOperationGroup): string[] {
  return group.signals.slice(0, 5).map((signal, index) => {
    const parts = [
      `#${index + 1}`,
      signal.asyncOperationId ? `asyncoperation=${signal.asyncOperationId}` : undefined,
      signal.correlationId ? `correlation=${signal.correlationId}` : undefined,
      signal.requestId ? `request=${signal.requestId}` : undefined,
      signal.workflowActivationId ? `workflowActivation=${signal.workflowActivationId}` : undefined,
      signal.statusLabel ? `status=${signal.statusLabel}` : undefined,
      signal.stateLabel ? `state=${signal.stateLabel}` : undefined,
      typeof signal.executionTimeMs === "number" ? `duration=${signal.executionTimeMs}ms` : undefined,
      typeof signal.retryCount === "number" ? `retry=${signal.retryCount}` : undefined
    ].filter((part): part is string => !!part);

    return parts.join(" · ");
  });
}

function buildNextSteps(group: AsyncOperationGroup, pattern: AsyncOperationRepeatPattern = classifyRepeatPattern(group)): string[] {
  const steps: string[] = [];

  if (group.failureSignal) {
    steps.push("Open the matching asyncoperation row and inspect message/error fields for the failure context.");
  }

  if (group.waitingSignal) {
    steps.push("Check whether this is waiting on an event, dependency, retry window, or locked/suspended background work.");
  }

  if ((group.slowSignal?.executionTimeMs ?? 0) >= VERY_SLOW_ASYNC_OPERATION_MS) {
    steps.push("Review related workflow/background work before assuming the foreground query is the bottleneck.");
  } else if (group.slowSignal) {
    steps.push("Record the observed duration and compare it with repeated runs before treating this as an optimisation candidate.");
  }

  if (group.retrySignal) {
    steps.push("Compare retry count and status history to determine whether this is transient or repeatedly failing background work.");
  }

  if (group.repeatCount >= 2) {
    if (pattern.isCrossRequestRepetition) {
      steps.push("Compare correlation/request ids and timestamps to confirm whether this is expected scheduled/batch behaviour or unintended repeated triggering.");
    } else if (pattern.isSameRequestRepetition) {
      steps.push("Compare rows with the same correlation/request id to confirm whether this is expected batching/retry behaviour or duplicate execution within one request.");
    } else {
      steps.push("Compare repeated asyncoperation rows by correlation/request id to confirm whether this is expected batching or duplicate execution.");
    }
  }

  return Array.from(new Set(steps)).slice(0, 4);
}

function buildDetectedSignals(group: AsyncOperationGroup): string[] {
  const detected: string[] = [];
  if (group.failureSignal) {
    const label = group.failureSignal.statusLabel ?? group.failureSignal.stateLabel ?? "failed/cancelled";
    detected.push(`failure/cancelled status: ${label}${group.failureSignal.message ? ` (${truncate(group.failureSignal.message, 100)})` : ""}`);
  }
  if (group.waitingSignal) {
    const label = group.waitingSignal.statusLabel ?? group.waitingSignal.stateLabel ?? "waiting/suspended";
    detected.push(`waiting/suspended state: ${label}`);
  }
  if (group.slowSignal?.executionTimeMs) {
    detected.push(`slow background execution: ${formatDuration(group.slowSignal.executionTimeMs) ?? `${group.slowSignal.executionTimeMs}ms`}`);
  }
  if (group.retrySignal?.retryCount) {
    detected.push(`retry count: ${group.retrySignal.retryCount}`);
  }
  if (group.repeatCount >= 2) {
    const pattern = classifyRepeatPattern(group);
    if (pattern.isCrossRequestRepetition) {
      detected.push(`repeated execution across requests: ${group.repeatCount} asyncoperation rows across ${pattern.uniqueCorrelationIds.length || pattern.uniqueRequestIds.length} request context${(pattern.uniqueCorrelationIds.length || pattern.uniqueRequestIds.length) === 1 ? "" : "s"}`);
    } else if (pattern.isSameRequestRepetition) {
      detected.push(`repeated execution within one request: ${group.repeatCount} asyncoperation rows share the same request context`);
    } else {
      detected.push(`repeated execution: ${group.repeatCount} asyncoperation rows in the bounded sample`);
    }
  }
  return detected;
}

function confidenceFor(severity: ExecutionSeverity): number {
  switch (severity) {
    case "high":
      return 0.95;
    case "medium":
      return 0.86;
    default:
      return 0.76;
  }
}

function buildConsolidatedAsyncOperationInsight(group: AsyncOperationGroup): BinderSuggestion {
  const primary = group.failureSignal ?? group.waitingSignal ?? group.slowSignal ?? group.retrySignal ?? group.signals[0];
  const severity: ExecutionSeverity = group.failureSignal
    ? "high"
    : group.waitingSignal || (group.slowSignal?.executionTimeMs ?? 0) >= VERY_SLOW_ASYNC_OPERATION_MS
      ? "medium"
      : "low";
  const displayName = primary ? displayOperationName(primary) : group.key;
  const repeatPattern = classifyRepeatPattern(group);
  const detectedSignals = buildDetectedSignals(group);
  const durationText = formatDuration(group.slowSignal?.executionTimeMs ?? primary?.executionTimeMs);
  const keyIdentifiers = buildKeyIdentifiers(group);
  const followUpQueries = buildFollowUpQueries(group);
  const impact = group.failureSignal
    ? "This background operation failed or was cancelled. It can explain downstream processing gaps, missing side effects, or delayed data updates."
    : group.waitingSignal
      ? "This background operation is waiting or suspended. It may explain delayed processing even when the original query succeeds."
      : (group.slowSignal?.executionTimeMs ?? 0) >= VERY_SLOW_ASYNC_OPERATION_MS
        ? `This run takes ${durationText ?? "a long time"}. If it repeats, it can increase background load and delay downstream processing. It may still be expected batch work.`
        : group.repeatCount >= 2 && repeatPattern.isCrossRequestRepetition
          ? `This operation appears across ${repeatPattern.uniqueCorrelationIds.length || repeatPattern.uniqueRequestIds.length} separate request context${(repeatPattern.uniqueCorrelationIds.length || repeatPattern.uniqueRequestIds.length) === 1 ? "" : "s"}. That points to repeated background triggering across requests rather than one retry loop.`
          : group.repeatCount >= 2 && repeatPattern.isSameRequestRepetition
            ? "This is often expected batching or retry behaviour within one request, but it can indicate duplicate or chained processing if the repeats were not expected."
            : group.repeatCount >= 2
              ? "This operation appears multiple times in the bounded asyncoperation sample. It may be expected batching, but the repeated rows are useful execution context."
              : "DV Quick Run found asyncoperation runtime context. Treat it as read-only execution evidence, not an optimisation recommendation.";
  const title = group.failureSignal
    ? `⭐ Failed/cancelled async operation: ${displayName}`
    : group.waitingSignal
      ? `⚠️ Waiting/suspended async operation: ${displayName}`
      : group.repeatCount >= 2 && repeatPattern.isCrossRequestRepetition
        ? `⚠️ Repeated background execution (${group.repeatCount} runs across requests): ${displayName}`
        : group.repeatCount >= 2 && repeatPattern.isSameRequestRepetition
          ? `⚠️ Repeated async work in one request (${group.repeatCount} runs): ${displayName}`
          : group.repeatCount >= 2
            ? `⚠️ Repeated async operation (${group.repeatCount} runs): ${displayName}`
            : group.slowSignal
          ? `⏱️ Slow async operation${durationText ? ` (${durationText})` : ""}: ${displayName}`
          : `Async operation context: ${displayName}`;

  return buildSuggestion({
    text: title,
    confidence: confidenceFor(severity),
    reason: `${displayName} has ${group.signals.length} asyncoperation row${group.signals.length === 1 ? "" : "s"} in the bounded sample. Use the identifiers and follow-up queries below to inspect the concrete records.`,
    payload: {
      kind: "asyncOperationExecutionSummary",
      severity,
      sourceType: "asyncOperation",
      displayOperationName: displayName,
      asyncOperationId: primary?.asyncOperationId,
      correlationId: primary?.correlationId,
      requestId: primary?.requestId,
      workflowActivationId: primary?.workflowActivationId,
      messageName: primary?.messageName,
      primaryEntityName: primary?.primaryEntityType,
      durationMs: group.slowSignal?.executionTimeMs ?? primary?.executionTimeMs,
      durationSeconds: group.slowSignal?.executionTimeSeconds ?? primary?.executionTimeSeconds,
      stateCode: primary?.stateCode,
      statusCode: primary?.statusCode,
      stateLabel: primary?.stateLabel,
      statusLabel: primary?.statusLabel,
      repeatCount: group.repeatCount,
      uniqueCorrelationIdCount: repeatPattern.uniqueCorrelationIds.length,
      uniqueRequestIdCount: repeatPattern.uniqueRequestIds.length,
      repeatPattern: repeatPattern.isCrossRequestRepetition
        ? "crossRequest"
        : repeatPattern.isSameRequestRepetition
          ? "sameRequest"
          : "sampleRepeated",
      asyncOperationTimeSpanMs: getAsyncOperationTimeSpanMs(group.signals),
      detectedSignals,
      signalSummary: detectedSignals.join(" · "),
      impact,
      keyIdentifiers,
      followUpQueries,
      nextSteps: buildNextSteps(group, repeatPattern),
      evidenceRefs: group.signals.map((signal) => signal.evidenceRef),
      rawSignals: group.signals,
      rawDetails: buildRawDetails(group),
      rawTraceActionLabel: "View raw asyncoperation details"
    }
  });
}

export function buildAsyncOperationInsightSuggestions(analysis: AsyncOperationAnalysisResult): BinderSuggestion[] {
  if (!analysis.signals.length) {
    const isUnavailable = analysis.status === "accessDenied" || analysis.status === "unavailable";
    const isError = analysis.status === "error" || analysis.status === "timeout";
    const kind = isUnavailable
      ? "asyncOperationUnavailable"
      : isError
        ? "asyncOperationLookupFailed"
        : "asyncOperationNoSignals";
    const text = isUnavailable
      ? "💡 Async operation insights unavailable"
      : analysis.status === "timeout"
        ? "💡 Async operation lookup timed out"
        : isError
          ? "💡 Async operation lookup failed"
          : "💡 No async operation warnings detected";

    return [buildSuggestion({
      text,
      confidence: isUnavailable ? 0.84 : isError ? 0.7 : 0.6,
      reason: analysis.message ?? "DV Quick Run inspected recent async operations using the current execution context. No failed, waiting, slow, retry, or repeated execution signals were detected.",
      payload: {
        kind,
        source: analysis.source,
        attemptedQuery: analysis.attemptedQuery,
        suppressExecutionInsights: isUnavailable,
        hideBinderButton: isUnavailable || isError || analysis.status === "empty"
      }
    })];
  }

  const groups = buildAsyncOperationGroups(analysis.signals);
  const suggestions = groups
    .map(buildConsolidatedAsyncOperationInsight)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_ASYNC_OPERATION_INSIGHTS);

  return suggestions.length ? suggestions : [];
}
