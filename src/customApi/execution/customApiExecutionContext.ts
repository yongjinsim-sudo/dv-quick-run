import type { DataverseExecutionContext, DataverseGetResult } from "../../services/dataverseClient.js";
import type { InvestigationContextPatch } from "../../investigation/context/investigationContextTypes.js";
import type { CustomApiDefinition, CustomApiExecutionCapabilityMode, CustomApiExecutionEligibilityState, CustomApiOperationKind, CustomApiBindingKind } from "../models/customApiTypes.js";
import { buildAiExecutionAdvisoryLines, shouldShowAiExecutionAdvisory } from "./aiExecutionPolicy.js";
import type { CustomApiFunctionExecutionPlan, CustomApiFunctionParameterValues } from "./customApiFunctionExecution.js";

export type CapabilityExecutionKind = "customApiExecution";

export type CapabilityExecutionStatus = "previewed" | "completed" | "failed";

export type CapabilityExecutionMethod = "GET" | "POST";

export interface CapabilityExecutionContext {
  readonly kind: CapabilityExecutionKind;
  readonly source: "capabilityExplorer";
  readonly operationUniqueName: string;
  readonly operationDisplayName: string;
  readonly operationKind: CustomApiOperationKind;
  readonly bindingKind: CustomApiBindingKind;
  readonly boundEntityLogicalName?: string;
  readonly executionCapabilityMode?: CustomApiExecutionCapabilityMode;
  readonly executionEligibilityState?: CustomApiExecutionEligibilityState;
  readonly method: CapabilityExecutionMethod;
  readonly path?: string;
  readonly url?: string;
  readonly environmentName?: string;
  readonly status: CapabilityExecutionStatus;
  readonly statusCode?: number;
  readonly durationMs?: number;
  readonly executedAtUtc: string;
  readonly requestId?: string;
  readonly correlationId?: string;
  readonly operationId?: string;
  readonly parameterNames: readonly string[];
  readonly responsePropertyNames: readonly string[];
  readonly notes: readonly string[];
  readonly classification?: "ai-related";
  readonly trustModel?: "probabilistic-generated-content";
  readonly humanReviewRecommended?: boolean;
  readonly generatedContentWarning?: boolean;
  readonly externalProcessingPossible?: boolean;
}

export interface BuildCapabilityExecutionContextOptions {
  definition: CustomApiDefinition;
  status: CapabilityExecutionStatus;
  environmentName?: string;
  executionContext?: DataverseExecutionContext;
  executionPlan?: CustomApiFunctionExecutionPlan;
  values?: CustomApiFunctionParameterValues;
  errorMessage?: string;
  now?: () => string;
}

function buildDisplayName(definition: CustomApiDefinition): string {
  return definition.displayName || definition.uniqueName;
}

function buildMethod(definition: CustomApiDefinition): CapabilityExecutionMethod {
  return definition.operationKind === "Function" ? "GET" : "POST";
}

function buildNotes(options: BuildCapabilityExecutionContextOptions): string[] {
  const notes: string[] = [];

  notes.push("Captured as a capability execution investigation anchor.");

  if (options.definition.executionEligibility) {
    notes.push(`${options.definition.executionEligibility.label} — ${options.definition.executionEligibility.reason}`);
  }

  if (options.status === "previewed") {
    notes.push("Preview captured only. No Dataverse operation was executed from this context.");
  }

  if (options.status === "completed") {
    notes.push("Execution completed after explicit preview confirmation.");
  }

  if (options.status === "failed") {
    notes.push("Execution failed after explicit preview confirmation.");
  }

  if (options.executionContext?.requestId || options.executionContext?.correlationId || options.executionContext?.operationId) {
    notes.push("Execution identifiers are available for bounded runtime evidence lookup.");
  } else if (options.status !== "previewed") {
    notes.push("No request/correlation identifiers were captured. Future runtime linkage should use bounded fallback only.");
  }

  if (shouldShowAiExecutionAdvisory(options.definition.executionPolicy ?? options.definition.executionCapability?.executionPolicy)) {
    notes.push(...buildAiExecutionAdvisoryLines(options.definition.executionPolicy ?? options.definition.executionCapability?.executionPolicy));
  }

  if (options.errorMessage) {
    notes.push("Error payload is preserved separately by the execution result surface.");
  }

  return notes;
}

export function buildCapabilityExecutionContext(
  options: BuildCapabilityExecutionContextOptions
): CapabilityExecutionContext {
  const executionContext = options.executionContext;
  const plan = options.executionPlan;

  const executionPolicy = options.definition.executionPolicy ?? options.definition.executionCapability?.executionPolicy;
  const isAiAdvisory = shouldShowAiExecutionAdvisory(executionPolicy);

  return {
    kind: "customApiExecution",
    source: "capabilityExplorer",
    operationUniqueName: options.definition.uniqueName,
    operationDisplayName: buildDisplayName(options.definition),
    operationKind: options.definition.operationKind,
    bindingKind: options.definition.bindingKind,
    boundEntityLogicalName: options.definition.boundEntityLogicalName,
    executionCapabilityMode: options.definition.executionCapability?.mode,
    executionEligibilityState: options.definition.executionEligibility?.state,
    method: buildMethod(options.definition),
    path: executionContext?.path ?? plan?.path,
    url: executionContext?.url,
    environmentName: options.environmentName,
    status: options.status,
    statusCode: executionContext?.statusCode,
    durationMs: executionContext?.durationMs,
    executedAtUtc: executionContext?.timestamp ?? options.now?.() ?? new Date().toISOString(),
    requestId: executionContext?.requestId,
    correlationId: executionContext?.correlationId,
    operationId: executionContext?.operationId,
    parameterNames: Object.keys(options.values ?? {}),
    responsePropertyNames: options.definition.responseProperties.map((property) => property.uniqueName),
    notes: buildNotes(options),
    classification: isAiAdvisory ? "ai-related" : undefined,
    trustModel: isAiAdvisory ? "probabilistic-generated-content" : undefined,
    humanReviewRecommended: isAiAdvisory ? true : undefined,
    generatedContentWarning: isAiAdvisory ? true : undefined,
    externalProcessingPossible: isAiAdvisory ? true : undefined
  };
}

export function buildCapabilityExecutionContextFromResult(
  args: Omit<BuildCapabilityExecutionContextOptions, "status" | "executionContext"> & { result: DataverseGetResult<unknown> }
): CapabilityExecutionContext {
  return buildCapabilityExecutionContext({
    ...args,
    status: "completed",
    executionContext: args.result.executionContext
  });
}

export function buildCapabilityExecutionContextFromError(
  args: Omit<BuildCapabilityExecutionContextOptions, "status">
): CapabilityExecutionContext {
  return buildCapabilityExecutionContext({
    ...args,
    status: "failed"
  });
}

export function buildCapabilityExecutionContextFromPreview(
  args: Omit<BuildCapabilityExecutionContextOptions, "status">
): CapabilityExecutionContext {
  return buildCapabilityExecutionContext({
    ...args,
    status: "previewed"
  });
}


export function buildCapabilityExecutionInvestigationPatch(
  context: CapabilityExecutionContext,
  environmentUrl?: string
): InvestigationContextPatch {
  return {
    source: "capabilityExplorer",
    environmentName: context.environmentName,
    environmentUrl,
    currentEntity: context.boundEntityLogicalName
      ? {
        logicalName: context.boundEntityLogicalName
      }
      : undefined,
    runtime: {
      correlationId: context.correlationId,
      requestId: context.requestId,
      operationId: context.operationId,
      providerIds: context.requestId || context.correlationId || context.operationId
        ? ["capabilityExecution"]
        : []
    },
    capabilityExecution: {
      kind: context.kind,
      operationUniqueName: context.operationUniqueName,
      operationDisplayName: context.operationDisplayName,
      operationKind: context.operationKind,
      bindingKind: context.bindingKind,
      boundEntityLogicalName: context.boundEntityLogicalName,
      status: context.status,
      method: context.method,
      path: context.path,
      statusCode: context.statusCode,
      durationMs: context.durationMs,
      executedAtUtc: context.executedAtUtc
    },
    surfaceState: {
      executionInsightsOpen: false,
      recoverable: true
    }
  };
}
