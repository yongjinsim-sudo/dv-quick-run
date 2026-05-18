import type { CustomApiDefinition, CustomApiExecutionCapability } from "../models/customApiTypes.js";
import { evaluateAiExecutionPolicy, type AiExecutionPolicyOptions } from "./aiExecutionPolicy.js";
import { resolveActionExecutionReadiness } from "./actionExecutionReadiness.js";

export interface CustomApiExecutionCapabilityResolverOptions extends AiExecutionPolicyOptions {}

function hasPreviewReadyParameters(definition: CustomApiDefinition): boolean {
  return definition.executionReadiness === "preview-ready"
    && definition.requestParameters.every((parameter) => parameter.executionSupport === "preview-ready");
}

function isODataValidatedUnboundFunction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Function"
    && definition.bindingKind === "Unbound"
    && hasPreviewReadyParameters(definition)
    && definition.executionEligibility?.state === "executable";
}

function isODataValidatedUnboundAction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Action"
    && definition.bindingKind === "Unbound"
    && definition.isPrivate !== true
    && hasPreviewReadyParameters(definition)
    && definition.executionEligibility?.state === "executable";
}

function withPolicy(capability: CustomApiExecutionCapability, definition: CustomApiDefinition, options: CustomApiExecutionCapabilityResolverOptions): CustomApiExecutionCapability {
  const executionPolicy = evaluateAiExecutionPolicy(definition, options);
  const actionReadiness = definition.operationKind === "Action"
    ? resolveActionExecutionReadiness({ ...definition, executionCapability: capability, executionPolicy }, options)
    : undefined;

  if (capability.canExecute && !executionPolicy.allowed) {
    return {
      mode: "preview-only",
      state: "denied",
      label: "AI execution blocked by policy",
      reason: executionPolicy.reason,
      canPreview: capability.canPreview,
      canExecute: false,
      operationKind: capability.operationKind,
      bindingKind: capability.bindingKind,
      boundTargetKind: capability.boundTargetKind,
      boundTargetLabel: capability.boundTargetLabel,
      boundTargetReason: capability.boundTargetReason,
      executionPolicy,
      actionReadiness
    };
  }

  if (actionReadiness?.state === "readyWithCaution") {
    return {
      ...capability,
      label: "Run with caution",
      reason: `${capability.reason} ${actionReadiness.reason}`,
      executionPolicy,
      actionReadiness
    };
  }

  return {
    ...capability,
    executionPolicy,
    actionReadiness
  };
}

export function resolveCustomApiExecutionCapability(
  definition: CustomApiDefinition,
  options: CustomApiExecutionCapabilityResolverOptions = {}
): CustomApiExecutionCapability {
  let capability: CustomApiExecutionCapability;

  if (isODataValidatedUnboundFunction(definition)) {
    capability = {
      mode: "executable",
      state: "executable",
      label: "Preview and execute Function",
      reason: "This Function was validated against the active environment OData operation surface and is eligible for execution.",
      canPreview: true,
      canExecute: true,
      executionMethod: "GET",
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  if (definition.executionEligibility?.state === "unknown-validation-unavailable") {
    capability = {
      mode: "validation-unavailable",
      state: "denied",
      label: "Preview request only",
      reason: definition.executionEligibility.reason,
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  if (definition.executionReadiness === "partial" || definition.executionReadiness === "inspect-only") {
    capability = {
      mode: "inspect-only",
      state: definition.executionReadiness === "partial" ? "partially-preview-ready" : "preview-only",
      label: "Inspect metadata / preview request",
      reason: definition.executionReadinessReason || "This operation has parameters that need manual inspection before execution support is enabled.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  if (isODataValidatedUnboundAction(definition)) {
    capability = {
      mode: "executable",
      state: "executable",
      label: "Ready to run",
      reason: "This unbound public Action is preview-ready and matched an ActionImport in the active environment. POST execution runs only after explicit preview confirmation.",
      canPreview: true,
      canExecute: true,
      executionMethod: "POST",
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  if (definition.operationKind === "Action") {
    capability = {
      mode: "preview-only",
      state: "preview-only",
      label: "Preview request only",
      reason: definition.executionEligibility?.reason || "Action execution requires public, unbound, OData-exposed metadata before POST execution can be enabled.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  if (definition.bindingKind === "Bound") {
    capability = {
      mode: "preview-only",
      state: "preview-only",
      label: "Preview request only",
      reason: "Bound execution needs selected row/entity context and remains preview-only.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind,
      boundTargetKind: definition.boundTargetKind,
      boundTargetLabel: definition.boundTargetLabel,
      boundTargetReason: definition.boundTargetReason
    };
    return withPolicy(capability, definition, options);
  }

  capability = {
    mode: "preview-only",
    state: "preview-only",
    label: "Preview request only",
    reason: definition.executionEligibility?.reason || "This operation is discoverable, but execution is not enabled for this operation shape.",
    canPreview: true,
    canExecute: false,
    operationKind: definition.operationKind,
    bindingKind: definition.bindingKind,
    boundTargetKind: definition.boundTargetKind,
    boundTargetLabel: definition.boundTargetLabel,
    boundTargetReason: definition.boundTargetReason
  };
  return withPolicy(capability, definition, options);
}

export function canExecuteCustomApiDefinition(definition: CustomApiDefinition): boolean {
  return (definition.executionCapability ?? resolveCustomApiExecutionCapability(definition)).canExecute === true;
}

export function canExecuteCustomApiFunctionDefinition(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Function"
    && (definition.executionCapability ?? resolveCustomApiExecutionCapability(definition)).canExecute === true;
}

export function canExecuteCustomApiActionDefinition(definition: CustomApiDefinition): boolean {
  const capability = definition.executionCapability ?? resolveCustomApiExecutionCapability(definition);
  return definition.operationKind === "Action"
    && capability.canExecute === true
    && capability.executionMethod === "POST";
}

export function withCustomApiExecutionCapability(
  definition: CustomApiDefinition,
  options: CustomApiExecutionCapabilityResolverOptions = {}
): CustomApiDefinition {
  const executionCapability = resolveCustomApiExecutionCapability(definition, options);
  return {
    ...definition,
    executionCapability,
    executionPolicy: executionCapability.executionPolicy,
    actionReadiness: executionCapability.actionReadiness
  };
}
