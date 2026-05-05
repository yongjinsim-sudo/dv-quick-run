import type { BinderSuggestion } from "../binder/binderTypes.js";
import type { FlowSessionAnalysisResult, FlowSessionSignal } from "./flowSessionTypes.js";
import { buildFlowSessionRecordQuery } from "./flowSessionQueryBuilder.js";

const MAX_FLOW_SESSION_INSIGHTS = 2;

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

function buildFlowSessionKeyIdentifiers(signal: FlowSessionSignal): Array<{ label: string; value: string; query?: string }> {
  const identifiers: Array<{ label: string; value: string; query?: string }> = [];

  if (signal.flowSessionId) {
    identifiers.push({
      label: "FlowSessionId",
      value: signal.flowSessionId,
      query: buildFlowSessionRecordQuery(signal.flowSessionId)
    });
  }

  if (signal.flowId) {
    identifiers.push({
      label: "FlowId",
      value: signal.flowId
    });
  }

  if (signal.runId) {
    identifiers.push({
      label: "RunId",
      value: signal.runId
    });
  }

  if (signal.environmentId) {
    identifiers.push({
      label: "EnvironmentId",
      value: signal.environmentId
    });
  }

  if (signal.correlationId) {
    identifiers.push({
      label: "CorrelationId",
      value: signal.correlationId
    });
  }

  return identifiers;
}

function buildFollowUpQueries(signal: FlowSessionSignal): Array<{ label: string; query: string }> {
  const query = signal.flowSessionId ? buildFlowSessionRecordQuery(signal.flowSessionId) : undefined;
  return query ? [{ label: "Query by FlowSessionId", query }] : [];
}

function displayFlowSessionName(signal: FlowSessionSignal): string {
  return signal.name || signal.flowSessionId || signal.runId || "Linked flow run";
}

function buildDetectedSignals(signal: FlowSessionSignal): string[] {
  return [
    signal.status ? `status: ${signal.status}` : undefined,
    signal.statusLabel ? `status: ${signal.statusLabel}` : undefined,
    signal.stateLabel ? `state: ${signal.stateLabel}` : undefined,
    signal.startedOn ? `started: ${signal.startedOn}` : undefined,
    signal.completedOn ? `completed: ${signal.completedOn}` : undefined,
    signal.flowRunUrl ? "Power Automate run URL available" : undefined,
    signal.errorMessage ? `error: ${signal.errorMessage.slice(0, 160)}` : undefined
  ].filter((part): part is string => !!part);
}

function buildRawDetails(signal: FlowSessionSignal): string[] {
  return [
    signal.flowSessionId ? `flowSession=${signal.flowSessionId}` : undefined,
    signal.flowId ? `flow=${signal.flowId}` : undefined,
    signal.runId ? `run=${signal.runId}` : undefined,
    signal.environmentId ? `environment=${signal.environmentId}` : undefined,
    signal.correlationId ? `correlation=${signal.correlationId}` : undefined,
    signal.requestId ? `request=${signal.requestId}` : undefined,
    signal.statusLabel ? `status=${signal.statusLabel}` : undefined,
    signal.flowRunUrl ? `url=${signal.flowRunUrl}` : undefined
  ].filter((part): part is string => !!part);
}

function buildExternalActions(signal: FlowSessionSignal): Array<{ label: string; url: string; copyLabel?: string }> {
  if (!signal.flowRunUrl) {
    return [];
  }

  return [{
    label: "Open Flow Run",
    url: signal.flowRunUrl,
    copyLabel: "Copy Run URL"
  }];
}

function buildFlowSessionInsight(signal: FlowSessionSignal): BinderSuggestion {
  const displayName = displayFlowSessionName(signal);
  const detectedSignals = buildDetectedSignals(signal);
  const externalActions = buildExternalActions(signal);
  return buildSuggestion({
    text: `Related Power Automate run: ${displayName}`,
    confidence: signal.flowRunUrl ? 0.88 : 0.78,
    reason: "FlowSession details are shown only because asyncoperation or flowsession evidence linked to this flow run. Treat this as a navigation bridge, not a root-cause claim.",
    payload: {
      kind: "flowSessionExecutionMetadata",
      severity: signal.errorMessage ? "medium" : "low",
      sourceType: "flowSession",
      displayFlowSessionName: displayName,
      flowSessionId: signal.flowSessionId,
      flowId: signal.flowId,
      runId: signal.runId,
      environmentId: signal.environmentId,
      flowRunUrl: signal.flowRunUrl,
      status: signal.status,
      stateCode: signal.stateCode,
      statusCode: signal.statusCode,
      stateLabel: signal.stateLabel,
      statusLabel: signal.statusLabel,
      detectedSignals,
      signalSummary: detectedSignals.join(" · "),
      keyIdentifiers: buildFlowSessionKeyIdentifiers(signal),
      followUpQueries: buildFollowUpQueries(signal),
      externalActions,
      impact: signal.flowRunUrl
        ? "This flow run may contain the detailed Power Automate failure or run history screen for the linked Dataverse background work."
        : "This flowsession is linked to execution evidence, but DV Quick Run could not build a Power Automate run URL from the available fields.",
      nextSteps: externalActions.length
        ? [
          "Open the Power Automate run to inspect the flow error screen and action-level failure details.",
          "Copy the run URL when sharing the investigation with another developer."
        ]
        : [
          "Query the flowsession row and confirm whether environment, flow, and run identifiers are available.",
          "Inspect the linked asyncoperation first when diagnosing Dataverse-side failure or waiting states."
        ],
      evidenceRefs: [signal.evidenceRef],
      rawSignals: [signal],
      rawDetails: buildRawDetails(signal),
      rawTraceActionLabel: "View raw flow session details"
    }
  });
}

export function buildFlowSessionInsightSuggestions(analysis: FlowSessionAnalysisResult): BinderSuggestion[] {
  if (!analysis.signals.length) {
    return [];
  }

  return analysis.signals
    .map(buildFlowSessionInsight)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_FLOW_SESSION_INSIGHTS);
}
