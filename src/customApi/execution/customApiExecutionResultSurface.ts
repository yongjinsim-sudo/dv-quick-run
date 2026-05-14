import type { DataverseGetResult } from "../../services/dataverseClient.js";
import type { PreviewSurfaceSection } from "../../services/previewSurfaceTypes.js";
import type { CustomApiDefinition } from "../models/customApiTypes.js";
import type { CustomApiFunctionExecutionPlan, CustomApiFunctionParameterValues } from "./customApiFunctionExecution.js";
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

function buildRequestSummary(plan: CustomApiFunctionExecutionPlan): string {
  return [
    `Path: ${plan.path}`,
    "Method: GET",
    "Accept: application/json",
    "OData-Version: 4.0",
    "OData-MaxVersion: 4.0"
  ].join("\n");
}

function buildExecutionSummary(options: CustomApiExecutionResultSurfaceOptions): string {
  const context = options.result.executionContext;
  return [
    "Status: Completed",
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
    "- The Function was validated against the OData $metadata operation registry before execution.",
    "- A capability execution context has been captured as an investigation anchor.",
    "- This result is response inspection only; no follow-up diagnostics have been inferred yet."
  ];

  if (context.requestId || context.correlationId || context.operationId) {
    lines.push("- Request/correlation identifiers were captured for future execution diagnostics.");
  } else {
    lines.push("- No request/correlation identifiers were returned in response headers.");
  }

  return lines.join("\n");
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
      language: "text"
    },
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
    {
      title: "Capability execution context",
      content: buildCapabilityExecutionContextSection(capabilityExecutionContext),
      language: "json"
    },
    {
      title: "Raw execution context",
      content: stringifyJson(options.result.executionContext),
      language: "json"
    }
  ];
}

function parseStatusCode(errorMessage: string): string {
  const match = /Dataverse error\s+(\d+)/i.exec(errorMessage);
  return match?.[1] ?? "unknown";
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
        `HTTP status: ${parseStatusCode(options.errorMessage)}`,
        "Execution: Function invocation failed",
        "Result: Review the error payload and request shape below."
      ].join("\n"),
      language: "text"
    },
    {
      title: "Operation",
      content: buildOperationSummary(options.definition, options.environmentName),
      language: "text"
    },
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
      content: options.errorMessage,
      language: "text"
    },
    {
      title: "Diagnostics",
      content: [
        "- Execution was explicitly confirmed from the Custom API preview surface.",
        "- The request failed at Dataverse execution time.",
        "- A capability execution context has been captured as an investigation anchor.",
        "- This may indicate operation-specific validation, privilege, feature flag, route, or server-side implementation behaviour.",
        "- Future execution diagnostics can use this result as the starting evidence for trace/correlation lookup."
      ].join("\n"),
      language: "markdown"
    },
    {
      title: "Capability execution context",
      content: buildCapabilityExecutionContextSection(capabilityExecutionContext),
      language: "json"
    }
  ];
}
