import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";
import type { BinderSuggestion } from "../../product/binder/binderTypes.js";
import type { PreviewSurfaceSection } from "../../services/previewSurfaceTypes.js";

export type CapabilityExecutionInsightLinkStrength = "direct" | "nearby" | "none";

export interface CapabilityExecutionInsightLinkContext {
  readonly operationUniqueName: string;
  readonly operationDisplayName?: string;
  readonly status?: "previewed" | "completed" | "failed";
  readonly method?: "GET" | "POST";
  readonly path?: string;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly executedAtUtc?: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly operationId?: string;
  readonly environmentName?: string;
}

export interface CapabilityExecutionInsightLinkSummary {
  readonly strength: CapabilityExecutionInsightLinkStrength;
  readonly label: string;
  readonly detail: string;
  readonly anchorDescription: string;
}

export function buildCapabilityExecutionInsightLinkContext(
  context: InvestigationContext
): CapabilityExecutionInsightLinkContext | undefined {
  const capabilityExecution = context.capabilityExecution;
  if (!capabilityExecution?.operationUniqueName) {
    return undefined;
  }

  return {
    operationUniqueName: capabilityExecution.operationUniqueName,
    operationDisplayName: capabilityExecution.operationDisplayName,
    status: capabilityExecution.status,
    method: capabilityExecution.method,
    path: capabilityExecution.path,
    statusCode: capabilityExecution.statusCode,
    durationMs: capabilityExecution.durationMs,
    executedAtUtc: capabilityExecution.executedAtUtc,
    requestId: context.runtime?.requestId,
    correlationId: context.runtime?.correlationId,
    operationId: context.runtime?.operationId,
    environmentName: context.environmentName
  };
}

export function deriveCapabilityExecutionInsightLinkSummary(
  context: CapabilityExecutionInsightLinkContext
): CapabilityExecutionInsightLinkSummary {
  if (context.correlationId || context.requestId || context.operationId) {
    return {
      strength: "direct",
      label: "Direct execution anchors available",
      detail: "Runtime providers can use captured request, correlation, or operation identifiers for bounded evidence lookup.",
      anchorDescription: "request/correlation/operation id"
    };
  }

  if (context.status === "completed" || context.status === "failed") {
    return {
      strength: "nearby",
      label: "No direct execution identifiers captured",
      detail: "Runtime providers should only use conservative nearby evidence if a future provider explicitly supports bounded fallback.",
      anchorDescription: "bounded fallback only"
    };
  }

  return {
    strength: "none",
    label: "No runtime lookup anchor",
    detail: "Preview-only capability context does not represent a Dataverse execution, so runtime evidence lookup is not available.",
    anchorDescription: "preview only"
  };
}

function formatValue(value: unknown): string {
  if (typeof value === "number") {
    return String(value);
  }

  const text = String(value ?? "").trim();
  return text.length ? text : "—";
}

function formatInsightSuggestion(suggestion: BinderSuggestion, index: number): string {
  return [
    `${index + 1}. ${suggestion.text}`,
    `   Source: ${suggestion.source}`,
    `   Reason: ${suggestion.reason}`,
    `   Action: ${suggestion.applyLabel ?? suggestion.actionId}`
  ].join("\n");
}

export function buildCapabilityExecutionInsightSections(args: {
  context: CapabilityExecutionInsightLinkContext;
  suggestions: readonly BinderSuggestion[];
  shouldSuppressExecutionInsights?: boolean;
}): PreviewSurfaceSection[] {
  const linkSummary = deriveCapabilityExecutionInsightLinkSummary(args.context);
  const suggestionContent = args.suggestions.length
    ? args.suggestions.map(formatInsightSuggestion).join("\n\n")
    : "No bounded runtime evidence was returned for this capability execution yet.";

  return [
    {
      title: "Capability execution anchor",
      language: "text",
      content: [
        `Operation: ${formatValue(args.context.operationDisplayName ?? args.context.operationUniqueName)}`,
        `Unique name: ${formatValue(args.context.operationUniqueName)}`,
        `Environment: ${formatValue(args.context.environmentName)}`,
        `Status: ${formatValue(args.context.status)}`,
        `Method: ${formatValue(args.context.method)}`,
        `HTTP status: ${formatValue(args.context.statusCode)}`,
        `Duration: ${formatValue(args.context.durationMs)}ms`,
        `Executed at: ${formatValue(args.context.executedAtUtc)}`,
        `Path: ${formatValue(args.context.path)}`
      ].join("\n")
    },
    {
      title: "Execution evidence linkage",
      language: "markdown",
      content: [
        `- **Evidence linkage:** ${linkSummary.strength}`,
        `- **Execution context:** ${linkSummary.label}`,
        `- **Captured anchors:** ${linkSummary.anchorDescription}`,
        `- **Provider scope:** ${linkSummary.detail}`,
        "- Runtime evidence is an investigation signal, not root-cause proof.",
        args.shouldSuppressExecutionInsights
          ? "- Some runtime providers were unavailable or access denied, so unsupported provider evidence was suppressed."
          : "- Provider evidence remains bounded to the captured execution anchors."
      ].join("\n")
    },
    {
      title: "Captured execution identifiers",
      language: "text",
      content: [
        `Correlation ID: ${formatValue(args.context.correlationId)}`,
        `Request ID: ${formatValue(args.context.requestId)}`,
        `Operation ID: ${formatValue(args.context.operationId)}`
      ].join("\n")
    },
    {
      title: "Bounded provider findings",
      language: "markdown",
      content: suggestionContent
    }
  ];
}
