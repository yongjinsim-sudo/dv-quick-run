import type { BinderSuggestion } from "../binder/binderTypes.js";
import type { WorkflowAnalysisResult, WorkflowSignal } from "./workflowTypes.js";

const MAX_WORKFLOW_INSIGHTS = 2;

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


function buildWorkflowRecordQuery(workflowId: string): string {
  return `/workflows(${workflowId})?$select=name,workflowid,workflowidunique,category,mode,primaryentity,statecode,statuscode`;
}

function buildWorkflowKeyIdentifiers(signal: WorkflowSignal): Array<{ label: string; value: string; query?: string }> {
  const identifiers: Array<{ label: string; value: string; query?: string }> = [];

  if (signal.workflowId) {
    identifiers.push({
      label: "WorkflowId",
      value: signal.workflowId,
      query: buildWorkflowRecordQuery(signal.workflowId)
    });
  }

  if (signal.workflowIdUnique) {
    identifiers.push({
      label: "WorkflowIdUnique",
      value: signal.workflowIdUnique
    });
  }

  if (signal.activeWorkflowId) {
    identifiers.push({
      label: "ActiveWorkflowId",
      value: signal.activeWorkflowId,
      query: buildWorkflowRecordQuery(signal.activeWorkflowId)
    });
  }

  return identifiers;
}

function buildWorkflowFollowUpQueries(signal: WorkflowSignal): Array<{ label: string; query: string }> {
  return buildWorkflowKeyIdentifiers(signal)
    .filter((identifier): identifier is { label: string; value: string; query: string } => !!identifier.query)
    .map((identifier) => ({
      label: `Query by ${identifier.label}`,
      query: identifier.query
    }));
}

function displayWorkflowName(signal: WorkflowSignal): string {
  return signal.name || signal.workflowId || "Linked workflow";
}

function buildDetectedSignals(signal: WorkflowSignal): string[] {
  return [
    signal.categoryLabel ? `category: ${signal.categoryLabel}` : undefined,
    signal.modeLabel ? `mode: ${signal.modeLabel}` : undefined,
    signal.primaryEntity ? `primary entity: ${signal.primaryEntity}` : undefined,
    signal.statusLabel ? `status: ${signal.statusLabel}` : undefined,
    signal.stateLabel ? `state: ${signal.stateLabel}` : undefined
  ].filter((part): part is string => !!part);
}

function buildRawDetails(signal: WorkflowSignal): string[] {
  return [
    signal.workflowId ? `workflow=${signal.workflowId}` : undefined,
    signal.workflowIdUnique ? `workflowUnique=${signal.workflowIdUnique}` : undefined,
    signal.activeWorkflowId ? `activeWorkflow=${signal.activeWorkflowId}` : undefined,
    signal.categoryLabel ? `category=${signal.categoryLabel}` : undefined,
    signal.modeLabel ? `mode=${signal.modeLabel}` : undefined,
    signal.primaryEntity ? `primaryEntity=${signal.primaryEntity}` : undefined,
    signal.statusLabel ? `status=${signal.statusLabel}` : undefined
  ].filter((part): part is string => !!part);
}

function buildWorkflowInsight(signal: WorkflowSignal): BinderSuggestion {
  const displayName = displayWorkflowName(signal);
  const detectedSignals = buildDetectedSignals(signal);
  return buildSuggestion({
    text: `Related workflow context: ${displayName}`,
    confidence: 0.82,
    reason: "Workflow details are shown because asyncoperation evidence linked to this workflow. Treat this as related context, not a root-cause claim.",
    payload: {
      kind: "workflowExecutionMetadata",
      severity: "low",
      sourceType: "workflow",
      displayWorkflowName: displayName,
      workflowId: signal.workflowId,
      workflowIdUnique: signal.workflowIdUnique,
      activeWorkflowId: signal.activeWorkflowId,
      category: signal.category,
      categoryLabel: signal.categoryLabel,
      mode: signal.mode,
      modeLabel: signal.modeLabel,
      primaryEntityName: signal.primaryEntity,
      stateCode: signal.stateCode,
      statusCode: signal.statusCode,
      stateLabel: signal.stateLabel,
      statusLabel: signal.statusLabel,
      detectedSignals,
      signalSummary: detectedSignals.join(" · "),
      keyIdentifiers: buildWorkflowKeyIdentifiers(signal),
      followUpQueries: buildWorkflowFollowUpQueries(signal),
      impact: "This workflow is linked to the asyncoperation evidence. It can explain where background work may be coming from, but DV Quick Run is not assigning root cause in this release.",
      nextSteps: [
        "Use the workflow name, category, mode, and primary entity to confirm whether this background work is expected.",
        "Inspect the linked asyncoperation first when diagnosing failures or waiting states."
      ],
      evidenceRefs: [signal.evidenceRef],
      rawSignals: [signal],
      rawDetails: buildRawDetails(signal),
      rawTraceActionLabel: "View raw workflow details"
    }
  });
}

export function buildWorkflowInsightSuggestions(analysis: WorkflowAnalysisResult): BinderSuggestion[] {
  if (!analysis.signals.length) {
    return [];
  }

  return analysis.signals
    .map(buildWorkflowInsight)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_WORKFLOW_INSIGHTS);
}
