import type {
  CapabilityContextRequirement,
  CapabilityContextState,
  CapabilityInfo,
  InvestigationContinuationAction,
  InvestigationContinuationItem,
  InvestigationContinuationModel,
  InvestigationTimelineStep,
  InvestigationTrustState
} from "./dvQuickRunHubTypes.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";
import { formatInvestigationContextSummary } from "../../investigation/context/investigationContextFormatter.js";

function hasMeaningfulContext(context: InvestigationContext): boolean {
  return Boolean(
    context.environmentName
    || context.currentEntity?.logicalName
    || context.currentQuery?.queryText
    || context.currentQuery?.queryType
    || context.selectedRecord?.id
    || context.traversal?.sourceEntity
    || context.traversal?.targetEntity
    || context.runtime?.correlationId
    || context.runtime?.requestId
    || context.runtime?.providerIds?.length
    || context.capabilityExecution?.operationUniqueName
    || context.batch?.activeItemKey
    || context.batch?.activeEntityLogicalName
  );
}

function hasRequirementContext(requirement: CapabilityContextRequirement | undefined, context: InvestigationContext): boolean {
  if (!requirement) {
    return false;
  }

  switch (requirement.kind) {
    case "selfContained":
      return true;
    case "query":
      return Boolean(context.currentQuery?.queryText || context.currentQuery?.queryType);
    case "resultViewer":
      return context.source === "resultViewer" || Boolean(context.currentQuery?.queryText || context.currentEntity?.logicalName);
    case "selectedRow":
      return Boolean(context.selectedRecord?.id);
    case "runtimeEvidence":
      return Boolean(
        context.runtime?.correlationId
        || context.runtime?.requestId
        || context.runtime?.providerIds?.length
        || context.capabilityExecution?.operationUniqueName
      );
    case "entity":
      return Boolean(context.batch?.activeEntityLogicalName || context.currentEntity?.logicalName || context.selectedRecord?.entityLogicalName);
    case "editorSelection":
      return false;
    default:
      return false;
  }
}

export function buildCapabilityContextState(capability: CapabilityInfo, context: InvestigationContext): CapabilityContextState {
  const requirement = capability.contextRequirement;

  if (!requirement) {
    return {
      kind: "informational",
      label: "Available",
      detail: "Available as part of the normal DV Quick Run workflow.",
      launchable: Boolean(capability.commandId)
    };
  }

  if (requirement.kind === "selfContained") {
    return {
      kind: "launchable",
      label: requirement.label,
      detail: capability.launchNote ?? requirement.unavailableReason,
      recommendedSurface: requirement.recommendedSurface,
      launchable: Boolean(capability.commandId)
    };
  }

  if (hasRequirementContext(requirement, context)) {
    return {
      kind: "availableInContext",
      label: "Context available",
      detail: `Current session context may support this workflow from ${requirement.recommendedSurface}.`,
      recommendedSurface: requirement.recommendedSurface,
      launchable: false
    };
  }

  return {
    kind: "requiresContext",
    label: requirement.label,
    detail: requirement.unavailableReason,
    recommendedSurface: requirement.recommendedSurface,
    launchable: false
  };
}

export function applyCapabilityContextStates(
  capabilities: readonly CapabilityInfo[],
  context: InvestigationContext
): CapabilityInfo[] {
  return capabilities.map((capability) => ({
    ...capability,
    contextState: buildCapabilityContextState(capability, context)
  }));
}

function pushIfValue(items: InvestigationContinuationItem[], label: string, value: string | undefined): void {
  if (value && value.trim().length > 0) {
    items.push({ label, value });
  }
}

function deriveInvestigationTrustState(context: InvestigationContext, hasContext: boolean): InvestigationTrustState {
  if (!hasContext) {
    return {
      kind: "empty",
      label: "No active context",
      detail: "Run a query, open a Result Viewer, or start Guided Traversal to establish context."
    };
  }

  if (context.surfaceState?.expired) {
    return {
      kind: "stale",
      label: "Stale context",
      detail: context.surfaceState.staleReason
        ? `The previous investigation context is no longer live because ${context.surfaceState.staleReason}.`
        : "The previous investigation context is no longer live."
    };
  }

  if (context.surfaceState?.resultViewerOpen === false && context.surfaceState.recoverable) {
    return {
      kind: "recoverable",
      label: "Recoverable context",
      detail: "The live Result Viewer surface is closed, but the investigation surface can be reopened."
    };
  }

  if (context.surfaceState?.resultViewerOpen === true) {
    return {
      kind: "active",
      label: "Active context",
      detail: "The current investigation surface is open and context-aware actions are live."
    };
  }

  return {
    kind: "historical",
    label: "Historical context",
    detail: "Context is available for orientation, but no live surface state is currently known."
  };
}

function buildContinuationActions(context: InvestigationContext): InvestigationContinuationAction[] {
  const actions: InvestigationContinuationAction[] = [];

  if (context.surfaceState?.expired && context.surfaceState?.resultViewerOpen === false) {
    actions.unshift({
      label: "Restore live investigation context",
      detail: context.surfaceState.staleReason
        ? `The previous Result Viewer context expired because ${context.surfaceState.staleReason}. Re-run the query to restore live context.`
        : "The previous Result Viewer context expired. Re-run the query to restore live context.",
      surface: "Editor / Result Viewer",
      actionLabel: "Re-run query to restore live context"
    });
  } else if (context.surfaceState?.recoverable && context.surfaceState?.resultViewerOpen === false) {
    actions.unshift({
      label: "Recover investigation surface",
      detail: "Reopen the last Result Viewer investigation context.",
      surface: "Result Viewer",
      commandId: "dvQuickRun.reopenLastResultViewer",
      actionLabel: "Reopen last Result Viewer"
    });
  }

  if (context.currentQuery?.queryText || context.currentQuery?.queryType) {
    actions.push({
      label: "Continue from query context",
      detail: "Use Explain, Query Doctor, Result Viewer actions, or refinement flows from the active query surface.",
      surface: "Editor / Result Viewer"
    });
  }

  const entityLogicalName = context.batch?.activeEntityLogicalName || context.currentEntity?.logicalName || context.selectedRecord?.entityLogicalName;
  const entityDisplayName = context.batch?.activeEntityDisplayName || context.currentEntity?.displayName || entityLogicalName;

  if (entityLogicalName) {
    actions.push({
      label: "Continue from entity context",
      detail: context.batch?.activeLabel
        ? `Use entity-scoped pivots for the selected batch result: ${context.batch.activeLabel}.`
        : "Use entity-scoped pivots such as Operational Profile, metadata inspection, or relationship traversal.",
      surface: "Result Viewer / Operational Profile",
      commandId: "dvQuickRun.openOperationalProfileSurface",
      commandArgs: [entityLogicalName],
      actionLabel: "Open Operational Profile"
    });

    actions.push({
      label: "Export entity context",
      detail: context.batch?.activeLabel
        ? `Create a document-style Operational Profile snapshot for the selected batch result: ${context.batch.activeLabel}.`
        : "Create a document-style Operational Profile snapshot for sharing, review, or archival handoff.",
      surface: "Markdown Preview",
      commandId: "dvQuickRun.exportOperationalProfileSnapshot",
      commandArgs: [entityLogicalName],
      actionLabel: "Export Profile Snapshot"
    });
  }

  if (context.traversal?.sourceEntity || context.traversal?.targetEntity || context.traversal?.selectedRouteId) {
    actions.push({
      label: "Continue traversal investigation",
      detail: "Use traversal controls to continue, go back, change route, or recover from a no-result branch.",
      surface: "Guided Traversal / Result Viewer",
      commandId: "dvQuickRun.findPathToTable",
      actionLabel: "Start Guided Traversal"
    });
  }

  if (context.capabilityExecution?.operationUniqueName) {
    actions.push({
      label: "Continue from capability execution",
      detail: "Use the Custom API execution context as an investigation anchor for bounded runtime evidence review.",
      surface: "Capability Explorer / Execution Insights",
      commandId: "dvQuickRun.openCapabilityExplorer",
      actionLabel: "Open Capability Explorer"
    });

    actions.push({
      label: "Review linked execution evidence",
      detail: "Run bounded Execution Insight providers from the captured Custom API execution anchors.",
      surface: "Execution Insights",
      commandId: "dvQuickRun.openCapabilityExecutionInsights",
      actionLabel: "Open Execution Insights"
    });
  }

  if (context.runtime?.correlationId || context.runtime?.requestId || context.runtime?.providerIds?.length) {
    actions.push({
      label: "Continue runtime evidence review",
      detail: "Inspect bounded provider evidence and raw details without treating signals as root-cause proof.",
      surface: "Execution Insights",
      commandId: context.capabilityExecution?.operationUniqueName ? "dvQuickRun.openCapabilityExecutionInsights" : undefined,
      actionLabel: context.capabilityExecution?.operationUniqueName ? "Open Execution Insights" : undefined
    });
  }

  return actions;
}


function buildTimeline(context: InvestigationContext): InvestigationTimelineStep[] {
  const timeline: InvestigationTimelineStep[] = [];
  const entityDisplayName = context.batch?.activeEntityDisplayName || context.currentEntity?.displayName || context.currentEntity?.logicalName || context.selectedRecord?.entityLogicalName;

  if (context.currentQuery?.queryType) {
    timeline.push({
      label: context.currentQuery.queryType === "batch" ? "Batch Query" : "Editor Query",
      detail: `Started from ${context.currentQuery.queryType} query context.`
    });
  }

  if (context.batch?.activeLabel) {
    timeline.push({
      label: "Selected batch result",
      detail: `Focused on ${context.batch.activeLabel}${entityDisplayName ? ` for ${entityDisplayName}` : ""}.`
    });
  }

  if (context.source === "resultViewer" || context.currentEntity?.logicalName || context.batch?.activeEntityLogicalName) {
    timeline.push({
      label: "Result Viewer",
      detail: "Operational rows, columns, and pivots inspected from the current investigation surface."
    });
  }

  if (context.capabilityExecution?.operationUniqueName) {
    timeline.push({
      label: "Capability Execution",
      detail: `${context.capabilityExecution.operationUniqueName} captured as a ${context.capabilityExecution.status ?? "previewed"} execution-understanding context.`
    });
  }

  if (context.runtime?.correlationId || context.runtime?.providerIds?.length) {
    timeline.push({
      label: "Execution Insights",
      detail: "Runtime evidence became available for bounded provider inspection."
    });
  }

  if (context.batch?.activeEntityLogicalName || context.currentEntity?.logicalName || context.selectedRecord?.entityLogicalName) {
    timeline.push({
      label: "Operational Profile",
      detail: "Entity-scoped operational participation context available."
    });
  }

  if (context.traversal?.sourceEntity || context.traversal?.targetEntity) {
    timeline.push({
      label: "Guided Traversal",
      detail: "Relationship investigation route established."
    });
  }

  return timeline;
}
export function buildInvestigationContinuationModel(context: InvestigationContext): InvestigationContinuationModel {
  const items: InvestigationContinuationItem[] = [];

  pushIfValue(items, "Environment", context.environmentName);
  pushIfValue(items, "Last surface", context.source && context.source !== "unknown" ? context.source : undefined);
  pushIfValue(items, "Entity", context.batch?.activeEntityDisplayName ?? context.currentEntity?.displayName ?? context.currentEntity?.logicalName ?? context.selectedRecord?.entityLogicalName);
  pushIfValue(items, "Query", context.currentQuery?.queryType);
  pushIfValue(items, "Selected batch result", context.batch?.activeLabel);
  if (typeof context.batch?.activeRowCount === "number") {
    items.push({ label: "Selected batch rows", value: String(context.batch.activeRowCount) });
  }
  pushIfValue(items, "Selected record", context.selectedRecord?.displayLabel ?? context.selectedRecord?.id);
  pushIfValue(items, "Capability execution", context.capabilityExecution?.operationDisplayName ?? context.capabilityExecution?.operationUniqueName);
  pushIfValue(items, "Capability status", context.capabilityExecution?.status);
  pushIfValue(items, "Capability method", context.capabilityExecution?.method);
  if (typeof context.capabilityExecution?.statusCode === "number") {
    items.push({ label: "Capability HTTP status", value: String(context.capabilityExecution.statusCode) });
  }

  if (context.traversal?.sourceEntity || context.traversal?.targetEntity) {
    const source = context.traversal.sourceEntity ?? "unknown source";
    const target = context.traversal.targetEntity ?? "unknown target";
    items.push({ label: "Traversal", value: `${source} → ${target}` });
  }

  pushIfValue(items, "Correlation", context.runtime?.correlationId);
  pushIfValue(items, "Request", context.runtime?.requestId);
  pushIfValue(items, "Operation", context.runtime?.operationId);

  if (context.surfaceState?.resultViewerOpen === true) {
    items.push({ label: "Result Viewer status", value: "Open" });
  } else if (context.surfaceState?.expired) {
    items.push({
      label: "Result Viewer status",
      value: context.surfaceState.staleReason
        ? `Closed (expired: ${context.surfaceState.staleReason})`
        : "Closed (expired)"
    });
  } else if (context.surfaceState?.resultViewerOpen === false) {
    items.push({
      label: "Result Viewer status",
      value: context.surfaceState.recoverable
        ? "Closed (recoverable)"
        : "Closed"
    });
  }

  if (context.runtime?.providerIds?.length) {
    items.push({ label: "Runtime providers", value: context.runtime.providerIds.join(", ") });
  }

  const hasContext = hasMeaningfulContext(context);
  const trustState = deriveInvestigationTrustState(context, hasContext);
  const fallbackSummary = "No active investigation context yet. Run a query, open a Result Viewer, or start Guided Traversal to establish context.";

  return {
    hasContext,
    trustState,
    title: hasContext ? "Continue Investigation" : "No active investigation context",
    summary: hasContext ? formatInvestigationContextSummary(context) : fallbackSummary,
    items,
    actions: hasContext ? buildContinuationActions(context) : [],
    timeline: hasContext ? buildTimeline(context) : [],
    context
  };
}
