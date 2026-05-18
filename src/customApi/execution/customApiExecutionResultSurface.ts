import type { DataverseGetResult } from "../../services/dataverseClient.js";
import type { PreviewSurfaceSection } from "../../services/previewSurfaceTypes.js";
import type { CustomApiDefinition } from "../models/customApiTypes.js";
import type { CustomApiFunctionExecutionPlan, CustomApiFunctionParameterValues } from "./customApiFunctionExecution.js";
import { buildAiExecutionAdvisoryLines, shouldShowAiExecutionAdvisory } from "./aiExecutionPolicy.js";
import {
  buildCapabilityExecutionContextFromError,
  buildCapabilityExecutionContextFromResult,
  type CapabilityExecutionContext
} from "./customApiExecutionContext.js";

export interface CustomApiExecutionResultSurfaceOptions {
  definition: CustomApiDefinition;
  executionPlan: CustomApiFunctionExecutionPlan;
  values: CustomApiFunctionParameterValues;
  result: DataverseGetResult<unknown>;
  environmentName?: string;
}

export interface CustomApiExecutionErrorSurfaceOptions {
  definition: CustomApiDefinition;
  executionPlan: CustomApiFunctionExecutionPlan;
  values: CustomApiFunctionParameterValues;
  errorMessage: string;
  environmentName?: string;
}

function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function buildDisplayName(definition: CustomApiDefinition): string {
  return definition.displayName || definition.uniqueName;
}

function buildOperationSummary(definition: CustomApiDefinition, environmentName: string | undefined): string {
  return [
    `Display name: ${buildDisplayName(definition)}`,
    `Unique name: ${definition.uniqueName}`,
    `Kind: ${definition.operationKind}`,
    `Method: ${definition.operationKind === "Function" ? "GET" : "POST"}`,
    `Binding: ${definition.bindingKind}`,
    `Bound entity: ${definition.boundEntityLogicalName || "—"}`,
    `Environment: ${environmentName || "—"}`,
    `OData: ${definition.executionEligibility?.odataName || "—"}`,
    `Invocation route: ${definition.executionEligibility?.odataInvocationName || definition.uniqueName}`
  ].join("\n");
}

function compactActionReasonCode(reasonCode: string): string {
  const labels: Record<string, string> = {
    PublicODataAction: "Metadata-valid",
    SimplePreviewReadyParameters: "Preview-ready",
    GeneratedContentAdvisoryRequired: "AI advisory",
    PotentialDestructiveOperation: "Destructive signal",
    PotentialBusinessStateChange: "Business-state signal",
    PotentialExternalSideEffect: "External side-effect signal",
    AiPolicyDenied: "AI policy denied"
  };

  return labels[reasonCode] ?? reasonCode;
}

function compactActionReasonCodes(reasonCodes: readonly string[] | undefined): string {
  if (!reasonCodes || reasonCodes.length === 0) {
    return "—";
  }

  return reasonCodes.map(compactActionReasonCode).join(" • ");
}

function buildActionTrustContext(definition: CustomApiDefinition): string | undefined {
  const actionReadiness = definition.actionReadiness ?? definition.executionCapability?.actionReadiness;
  if (!actionReadiness) {
    return undefined;
  }

  return [
    `Readiness: ${actionReadiness.label}`,
    `Review level: ${actionReadiness.caution ? "Caution" : "Standard"}`,
    `Signals: ${compactActionReasonCodes(actionReadiness.reasonCodes)}`,
    `Typed confirmation: ${actionReadiness.requiresTypedConfirmation ? `Required (${actionReadiness.confirmationPhrase})` : "Not required"}`
  ].join("\n");
}

function buildRequestSummary(plan: CustomApiFunctionExecutionPlan): string {
  const lines = [
    `Path: ${plan.path}`,
    `Method: ${plan.method}`,
    "Accept: application/json",
    ...(plan.method === "POST" ? ["Content-Type: application/json"] : []),
    "OData-Version: 4.0",
    "OData-MaxVersion: 4.0"
  ];

  return lines.join("\n");
}

function buildExecutionSummary(options: CustomApiExecutionResultSurfaceOptions): string {
  const context = options.result.executionContext;
  return [
    "Status: Completed",
    "Execution state: completed",
    `HTTP status: ${context.statusCode ?? "unknown"}`,
    `Duration: ${context.durationMs ?? 0}ms`,
    `Executed at: ${context.timestamp}`,
    `Request ID: ${context.requestId || "—"}`,
    `Correlation ID: ${context.correlationId || "—"}`,
    `Operation ID: ${context.operationId || "—"}`
  ].join("\n");
}

function buildCapabilityExecutionContextSection(context: CapabilityExecutionContext): string {
  return stringifyJson(context);
}

function buildDiagnostics(options: CustomApiExecutionResultSurfaceOptions): string {
  const context = options.result.executionContext;
  const lines = [
    "- Execution was explicitly confirmed from the Custom API preview surface.",
    `- The ${options.definition.operationKind} was validated against the OData $metadata operation registry before execution.`,
    "- The execution context was captured as an investigation anchor.",
    "- This result is response inspection only; no follow-up diagnostics have been inferred yet."
  ];

  if (options.definition.actionReadiness?.caution || options.definition.executionCapability?.actionReadiness?.caution) {
    lines.push("- Caution classification was captured separately as Action trust context.");
  }

  if (context.requestId || context.correlationId || context.operationId) {
    lines.push("- Request/correlation identifiers were captured for future execution diagnostics.");
  } else {
    lines.push("- No request/correlation identifiers were returned in response headers.");
  }

  return lines.join("\n");
}

function buildAiAdvisorySection(definition: CustomApiDefinition): PreviewSurfaceSection | undefined {
  const lines = buildAiExecutionAdvisoryLines(definition.executionPolicy ?? definition.executionCapability?.executionPolicy);
  if (lines.length === 0) {
    return undefined;
  }

  return {
    title: "AI-generated content advisory",
    content: [
      "Generated output may be inaccurate, incomplete, or non-deterministic.",
      ...lines.filter((line) => !line.startsWith("Generated responses may")),
      "Human validation is recommended before operational use."
    ].join("\n"),
    language: "text"
  };
}

export function buildCustomApiExecutionResultSurfaceSections(
  options: CustomApiExecutionResultSurfaceOptions
): PreviewSurfaceSection[] {
  const capabilityExecutionContext = buildCapabilityExecutionContextFromResult({
    definition: options.definition,
    executionPlan: options.executionPlan,
    values: options.values,
    result: options.result,
    environmentName: options.environmentName
  });

  return [
    {
      title: "Summary",
      content: buildExecutionSummary(options),
      language: "text"
    },
    {
      title: "Operation",
      content: buildOperationSummary(options.definition, options.environmentName),
      language: "text",
      defaultCollapsed: true
    },
    ...(() => {
      const actionTrustContext = buildActionTrustContext(options.definition);
      return actionTrustContext ? [{ title: "Action trust context", content: actionTrustContext, language: "text" as const }] : [];
    })(),
    {
      title: "Request",
      content: buildRequestSummary(options.executionPlan),
      language: "http"
    },
    {
      title: "Execution values",
      content: stringifyJson(options.values),
      language: "json"
    },
    {
      title: "Response payload",
      content: stringifyJson(options.result.data),
      language: "json"
    },
    {
      title: "Diagnostics",
      content: buildDiagnostics(options),
      language: "markdown"
    },
    ...(() => {
      const advisory = buildAiAdvisorySection(options.definition);
      return advisory ? [advisory] : [];
    })(),
    {
      title: "Capability execution context",
      content: buildCapabilityExecutionContextSection(capabilityExecutionContext),
      language: "json",
      defaultCollapsed: true
    },
    {
      title: "Raw execution context",
      content: stringifyJson(options.result.executionContext),
      language: "json",
      defaultCollapsed: true
    }
  ];
}

function parseStatusCode(errorMessage: string): string {
  const match = /Dataverse error\s+(\d+)/i.exec(errorMessage);
  return match?.[1] ?? "unknown";
}

function buildErrorPayloadSummary(options: CustomApiExecutionErrorSurfaceOptions): string {
  const status = parseStatusCode(options.errorMessage);
  return [
    `Dataverse returned HTTP ${status} for the executed ${options.definition.operationKind} request.`,
    "",
    options.errorMessage
  ].join("\n");
}

export function buildCustomApiExecutionErrorSurfaceSections(
  options: CustomApiExecutionErrorSurfaceOptions
): PreviewSurfaceSection[] {
  const capabilityExecutionContext = buildCapabilityExecutionContextFromError({
    definition: options.definition,
    executionPlan: options.executionPlan,
    values: options.values,
    errorMessage: options.errorMessage,
    environmentName: options.environmentName
  });

  return [
    {
      title: "Summary",
      content: [
        "Status: Failed",
        "Execution state: failed",
        `HTTP status: ${parseStatusCode(options.errorMessage)}`,
        `Execution: ${options.definition.operationKind} invocation failed`,
        "Result: Review the error payload and request shape below.",
        `Action readiness: ${options.definition.actionReadiness?.label || options.definition.executionCapability?.actionReadiness?.label || "—"}`
      ].join("\n"),
      language: "text"
    },
    {
      title: "Operation",
      content: buildOperationSummary(options.definition, options.environmentName),
      language: "text",
      defaultCollapsed: true
    },
    ...(() => {
      const actionTrustContext = buildActionTrustContext(options.definition);
      return actionTrustContext ? [{ title: "Action trust context", content: actionTrustContext, language: "text" as const }] : [];
    })(),
    {
      title: "Request",
      content: buildRequestSummary(options.executionPlan),
      language: "http"
    },
    {
      title: "Execution values",
      content: stringifyJson(options.values),
      language: "json"
    },
    {
      title: "Error payload",
      content: buildErrorPayloadSummary(options),
      language: "text"
    },
    {
      title: "Diagnostics",
      content: [
        "- Execution was explicitly confirmed from the Custom API preview surface.",
        "- The request failed at Dataverse execution time.",
        "- The execution context was captured as an investigation anchor.",
        "- This may indicate operation-specific validation, privilege, feature flag, route, or server-side implementation behaviour.",
        "- Future execution diagnostics can use this result as the starting evidence for runtime evidence lookup.",
        "- Failed execution is an investigation signal, not root-cause proof.",
        ...(shouldShowAiExecutionAdvisory(options.definition.executionPolicy ?? options.definition.executionCapability?.executionPolicy) ? [
          "- This failed operation was classified as AI-related; advisory context is captured separately."
        ] : [])
      ].join("\n"),
      language: "markdown"
    },
    ...(() => {
      const advisory = buildAiAdvisorySection(options.definition);
      return advisory ? [advisory] : [];
    })(),
    {
      title: "Capability execution context",
      content: buildCapabilityExecutionContextSection(capabilityExecutionContext),
      language: "json",
      defaultCollapsed: true
    }
  ];
}
