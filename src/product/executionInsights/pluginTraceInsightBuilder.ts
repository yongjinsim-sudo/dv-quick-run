import type { BinderSuggestion } from "../binder/binderTypes.js";
import type { PluginTraceAnalysisResult, PluginTraceSignal } from "./pluginTraceTypes.js";

const SLOW_PLUGIN_MS = 1000;
const STRONG_SLOW_PLUGIN_MS = 2000;
const MAX_EXECUTION_INSIGHTS = 3;

interface PluginGroup {
  plugin: string;
  signals: PluginTraceSignal[];
  exceptionSignal?: PluginTraceSignal;
  slowSignal?: PluginTraceSignal;
  depthSignal?: PluginTraceSignal;
  repeatCount: number;
  score: number;
}

type ExecutionSeverity = "high" | "medium" | "low";

interface ExecutionSummary {
  severity: ExecutionSeverity;
  title: string;
  displayPluginName: string;
  detectedSignals: string[];
  signalSummary: string;
  impact: string;
  nextSteps: string[];
  rawDetails: string[];
}

function stageLabel(stage?: number): string | undefined {
  switch (stage) {
    case 10:
      return "PreValidation";
    case 20:
      return "PreOperation";
    case 40:
      return "PostOperation";
    default:
      return typeof stage === "number" ? `Stage ${stage}` : undefined;
  }
}

function modeLabel(mode?: number): string | undefined {
  switch (mode) {
    case 0:
      return "synchronous";
    case 1:
      return "asynchronous";
    default:
      return typeof mode === "number" ? `mode ${mode}` : undefined;
  }
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

function scoreSignal(signal: PluginTraceSignal): number {
  return (
    (signal.exceptionMessage ? 10_000 : 0) +
    (signal.durationMs ?? 0) +
    (signal.depth ?? 0) * 500
  );
}

function chooseHighest<T extends PluginTraceSignal>(signals: T[], score: (signal: T) => number): T | undefined {
  return [...signals].sort((a, b) => score(b) - score(a))[0];
}

function buildPluginGroups(signals: PluginTraceSignal[]): PluginGroup[] {
  const map = new Map<string, PluginTraceSignal[]>();

  for (const signal of signals) {
    const key = signal.typeName ?? signal.pluginTraceLogId ?? "unknown plugin";
    const existing = map.get(key) ?? [];
    existing.push(signal);
    map.set(key, existing);
  }

  return Array.from(map.entries())
    .map(([plugin, groupSignals]) => {
      const exceptionSignal = chooseHighest(
        groupSignals.filter((signal) => !!signal.exceptionMessage),
        scoreSignal
      );
      const slowSignal = chooseHighest(
        groupSignals.filter((signal) => typeof signal.durationMs === "number" && signal.durationMs >= SLOW_PLUGIN_MS),
        (signal) => signal.durationMs ?? 0
      );
      const depthSignal = chooseHighest(
        groupSignals.filter((signal) => typeof signal.depth === "number" && signal.depth >= 2),
        (signal) => signal.depth ?? 0
      );
      const repeatCount = groupSignals.length;
      const score = Math.max(...groupSignals.map(scoreSignal), 0) + (repeatCount >= 2 ? repeatCount * 300 : 0);

      return {
        plugin,
        signals: [...groupSignals].sort((a, b) => scoreSignal(b) - scoreSignal(a)),
        exceptionSignal,
        slowSignal,
        depthSignal,
        repeatCount,
        score
      };
    })
    .filter((group) => !!group.exceptionSignal || !!group.slowSignal || !!group.depthSignal || group.repeatCount >= 2)
    .sort((a, b) => b.score - a.score);
}

function truncate(value: string, maxLength: number): string {
  return value.length > maxLength ? `${value.slice(0, maxLength - 3)}...` : value;
}

function displayPluginName(typeName: string): string {
  const withoutAssembly = typeName.split(",")[0]?.trim() || typeName;
  const parts = withoutAssembly.split(".").filter(Boolean);
  const lastPart = parts.at(-1) ?? withoutAssembly;
  return lastPart || withoutAssembly;
}

function parseTime(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const time = Date.parse(value);
  return Number.isFinite(time) ? time : undefined;
}

function getCreatedOnSpanMs(signals: PluginTraceSignal[]): number | undefined {
  const times = signals
    .map((signal) => parseTime(signal.createdOn))
    .filter((time): time is number => typeof time === "number");

  if (times.length < 2) {
    return undefined;
  }

  return Math.max(...times) - Math.min(...times);
}

function hasHistoricalRepeatedTracePattern(group: PluginGroup): boolean {
  const spanMs = getCreatedOnSpanMs(group.signals);
  return group.repeatCount >= 2 && typeof spanMs === "number" && spanMs > 60 * 60 * 1000;
}

function hasSameCorrelationId(group: PluginGroup): boolean {
  const correlationIds = Array.from(new Set(group.signals.map((signal) => signal.correlationId).filter(Boolean)));
  return correlationIds.length === 1;
}


function buildRawDetails(group: PluginGroup): string[] {
  return group.signals.slice(0, 5).map((signal, index) => {
    const parts = [
      `#${index + 1}`,
      signal.pluginTraceLogId ? `trace=${signal.pluginTraceLogId}` : undefined,
      signal.correlationId ? `correlation=${signal.correlationId}` : undefined,
      signal.messageName ? `message=${signal.messageName}` : undefined,
      signal.entityName ? `entity=${signal.entityName}` : undefined,
      typeof signal.durationMs === "number" ? `duration=${signal.durationMs}ms` : undefined,
      typeof signal.depth === "number" ? `depth=${signal.depth}` : undefined,
      stageLabel(signal.stage),
      modeLabel(signal.mode)
    ].filter((part): part is string => !!part);

    return parts.join(" · ");
  });
}

function buildNextSteps(group: PluginGroup): string[] {
  const steps: string[] = [];

  if (group.exceptionSignal) {
    steps.push("Open the matching plugin trace row and inspect exceptiondetails for the full stack/error context.");
    steps.push("Review the plugin step and dependencies involved in this message/entity path.");
  }

  if ((group.slowSignal?.durationMs ?? 0) >= STRONG_SLOW_PLUGIN_MS) {
    steps.push("Check whether the plugin performs external API calls, expensive Dataverse queries, or repeated updates.");
  } else if (group.slowSignal) {
    steps.push("Monitor this plugin if the same operation is repeated under load or inside $batch.");
  }

  if ((group.depthSignal?.depth ?? 0) >= 2) {
    steps.push("Check for cascading updates or plugin chains that retrigger the same operation.");
  }

  if (group.repeatCount >= 2) {
    if (hasHistoricalRepeatedTracePattern(group)) {
      steps.push("Compare createdOn timestamps first. These traces span separate times, so treat them as historical/recurring activity before assuming duplicate execution.");
    } else if (hasSameCorrelationId(group)) {
      steps.push("Compare rows with the same correlation/request id to confirm whether this is expected batching/retry behaviour or duplicate execution inside one request.");
    } else {
      steps.push("Compare the repeated trace rows by correlation/request id to confirm whether this is expected batching or duplicate execution.");
    }
  }

  return Array.from(new Set(steps)).slice(0, 4);
}

function buildExecutionSummary(group: PluginGroup): ExecutionSummary {
  const hasException = !!group.exceptionSignal;
  const slowestDuration = group.slowSignal?.durationMs ?? 0;
  const maxDepth = group.depthSignal?.depth ?? 0;
  const hasStrongSlow = slowestDuration >= STRONG_SLOW_PLUGIN_MS;
  const hasSlow = slowestDuration >= SLOW_PLUGIN_MS;
  const hasNested = maxDepth >= 2;
  const hasRepeated = group.repeatCount >= 2;
  const severity: ExecutionSeverity = hasException || hasStrongSlow
    ? "high"
    : hasSlow || hasNested || hasRepeated
      ? "medium"
      : "low";

  const detected: string[] = [];
  if (hasException) {
    const message = group.exceptionSignal?.exceptionMessage
      ? `exception: ${truncate(group.exceptionSignal.exceptionMessage, 140)}`
      : "exception";
    detected.push(message);
  }
  if (hasSlow) {
    const context = [stageLabel(group.slowSignal?.stage), modeLabel(group.slowSignal?.mode)]
      .filter((part): part is string => !!part)
      .join(", ");
    detected.push(`slow execution: ${slowestDuration}ms${context ? ` (${context})` : ""}`);
  }
  if (hasNested) {
    detected.push(`nested execution depth: ${maxDepth}`);
  }
  if (hasRepeated) {
    if (hasHistoricalRepeatedTracePattern(group)) {
      detected.push(`historical repeated traces: ${group.repeatCount} traces across separate timestamps`);
    } else if (hasSameCorrelationId(group)) {
      detected.push(`same-request repeated traces: ${group.repeatCount} traces share one correlation id`);
    } else {
      detected.push(`repeated execution: ${group.repeatCount} traces in the bounded sample`);
    }
  }

  const impact = hasException
    ? "This plugin produced an exception in the sampled traces. It may be causing failed or partially failed Dataverse operations."
    : hasStrongSlow
      ? "This plugin is materially increasing request latency and may be noticeable for users, APIs, or $batch workloads."
      : hasSlow
        ? "This plugin is adding measurable execution time. It may become a bottleneck under load."
        : hasNested || hasRepeated
          ? hasRepeated && hasHistoricalRepeatedTracePattern(group)
            ? "These traces occur across separate timestamps. Treat this as historical/recurring plugin activity before assuming duplicate execution inside one request."
            : "The execution pattern suggests chained or repeated plugin work. This can increase latency and make failures harder to diagnose."
          : "DV Quick Run found runtime trace signals, but none currently indicate a high-impact issue.";

  const displayName = displayPluginName(group.plugin);

  return {
    severity,
    title: severity === "high"
      ? `⭐ Execution issue detected: ${displayName}`
      : hasRepeated && hasHistoricalRepeatedTracePattern(group)
        ? `Repeated historical traces: ${displayName}`
        : `Review plugin execution: ${displayName}`,
    displayPluginName: displayName,
    detectedSignals: detected,
    signalSummary: detected.join(" · "),
    impact,
    nextSteps: buildNextSteps(group),
    rawDetails: buildRawDetails(group)
  };
}

function confidenceFor(summary: ExecutionSummary): number {
  switch (summary.severity) {
    case "high":
      return 0.97;
    case "medium":
      return 0.88;
    default:
      return 0.78;
  }
}

function buildConsolidatedPluginInsight(group: PluginGroup): BinderSuggestion {
  const summary = buildExecutionSummary(group);
  const primary = group.exceptionSignal ?? group.slowSignal ?? group.depthSignal ?? group.signals[0];
  const hasRepeated = group.repeatCount >= 2;

  return buildSuggestion({
    text: summary.title,
    confidence: confidenceFor(summary),
    reason: `${summary.displayPluginName} has ${group.signals.length} runtime trace signal${group.signals.length === 1 ? "" : "s"} in the bounded sample. Review the summary first, then open raw trace details if deeper investigation is needed.`,
    payload: {
      kind: "pluginTraceExecutionSummary",
      severity: summary.severity,
      displayPluginName: summary.displayPluginName,
      fullTypeName: group.plugin,
      typeName: summary.displayPluginName,
      pluginTraceLogId: primary?.pluginTraceLogId,
      correlationId: primary?.correlationId,
      requestId: primary?.requestId,
      messageName: primary?.messageName,
      entityName: primary?.entityName,
      durationMs: group.slowSignal?.durationMs,
      depth: group.depthSignal?.depth,
      repeatCount: group.repeatCount,
      createdOnSpanMs: getCreatedOnSpanMs(group.signals),
      repeatedTracePattern: hasRepeated && hasHistoricalRepeatedTracePattern(group)
        ? "historical"
        : hasRepeated && hasSameCorrelationId(group)
          ? "sameCorrelation"
          : hasRepeated
            ? "sampleRepeated"
            : undefined,
      hasException: !!group.exceptionSignal,
      detectedSignals: summary.detectedSignals,
      signalSummary: summary.signalSummary,
      impact: summary.impact,
      nextSteps: summary.nextSteps,
      rawSignals: group.signals,
      rawDetails: summary.rawDetails,
      rawTraceActionLabel: "View raw trace details"
    }
  });
}

export function buildPluginTraceInsightSuggestions(analysis: PluginTraceAnalysisResult): BinderSuggestion[] {
  if (!analysis.signals.length) {
    const isUnavailable = analysis.status === "accessDenied" || analysis.status === "unavailable";
    const isError = analysis.status === "error" || analysis.status === "timeout";
    const kind = isUnavailable
      ? "pluginTraceUnavailable"
      : isError
        ? "pluginTraceLookupFailed"
        : "pluginTraceNoSignals";
    const text = isUnavailable
      ? "💡 Execution Insights unavailable"
      : analysis.status === "timeout"
        ? "💡 Execution Insights lookup timed out"
        : isError
          ? "💡 Execution Insights lookup failed"
          : "💡 Execution Insights: no plugin trace signals found";

    return [buildSuggestion({
      text,
      confidence: isUnavailable ? 0.86 : 0.78,
      reason: analysis.message ?? "DV Quick Run did not find exception, duration, depth, or repeated plugin trace signals in the bounded lookup.",
      payload: {
        kind,
        source: analysis.source,
        attemptedQuery: analysis.attemptedQuery,
        suppressExecutionInsights: isUnavailable,
        hideBinderButton: isUnavailable || isError || analysis.status === "empty"
      }
    })];
  }

  const groups = buildPluginGroups(analysis.signals);
  const suggestions = groups
    .map(buildConsolidatedPluginInsight)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_EXECUTION_INSIGHTS);

  return suggestions.length ? suggestions : [buildSuggestion({
    text: "💡 Execution Insights: plugin trace sample inspected",
    confidence: 0.78,
    reason: `DV Quick Run inspected ${analysis.signals.length} plugin trace signal${analysis.signals.length === 1 ? "" : "s"}, but did not find high-confidence exception, slow execution, repeated execution, or nested-depth warnings.`,
    payload: {
      kind: "pluginTraceSampleInspected",
      source: analysis.source,
      signalCount: analysis.signals.length
    }
  })];
}
