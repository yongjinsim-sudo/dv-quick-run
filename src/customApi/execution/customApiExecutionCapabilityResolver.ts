import type { CustomApiDefinition, CustomApiExecutionCapability } from "../models/customApiTypes.js";

function hasPreviewReadyParameters(definition: CustomApiDefinition): boolean {
  return definition.executionReadiness === "preview-ready"
    && definition.requestParameters.every((parameter) => parameter.executionSupport === "preview-ready");
}

function canExecuteUnboundFunction(definition: CustomApiDefinition): boolean {
  return definition.operationKind === "Function"
    && definition.bindingKind === "Unbound"
    && hasPreviewReadyParameters(definition)
    && definition.executionEligibility?.state === "executable";
}

export function resolveCustomApiExecutionCapability(definition: CustomApiDefinition): CustomApiExecutionCapability {
  if (canExecuteUnboundFunction(definition)) {
    return {
      mode: "executable",
      label: "Preview / run Function",
      reason: "This unbound Function is preview-ready and was validated against the OData operation surface for the active environment.",
      canPreview: true,
      canExecute: true,
      executionMethod: "GET",
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind
    };
  }

  if (definition.executionEligibility?.state === "unknown-validation-unavailable") {
    return {
      mode: "validation-unavailable",
      label: "Preview request only",
      reason: definition.executionEligibility.reason,
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind
    };
  }

  if (definition.executionReadiness === "partial" || definition.executionReadiness === "inspect-only") {
    return {
      mode: "inspect-only",
      label: "Inspect metadata / preview request",
      reason: definition.executionReadinessReason || "This operation has parameters that need manual inspection before execution support is enabled.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind
    };
  }

  if (definition.operationKind === "Action") {
    return {
      mode: "preview-only",
      label: "Preview request only",
      reason: "Action execution is intentionally not enabled. DV Quick Run can inspect the metadata and request shape without executing a POST operation.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind
    };
  }

  if (definition.bindingKind === "Bound") {
    return {
      mode: "preview-only",
      label: "Preview request only",
      reason: "Bound execution needs selected row/entity context and remains preview-only.",
      canPreview: true,
      canExecute: false,
      operationKind: definition.operationKind,
      bindingKind: definition.bindingKind
    };
  }
  return {
    mode: "preview-only",
    label: "Preview request only",
    reason: definition.executionEligibility?.reason || "This operation is discoverable, but execution is not enabled for this operation shape.",
    canPreview: true,
    canExecute: false,
    operationKind: definition.operationKind,
    bindingKind: definition.bindingKind
  };
}

export function canExecuteCustomApiDefinition(definition: CustomApiDefinition): boolean {
  return resolveCustomApiExecutionCapability(definition).canExecute === true;
}

export function withCustomApiExecutionCapability(definition: CustomApiDefinition): CustomApiDefinition {
  return {
    ...definition,
    executionCapability: resolveCustomApiExecutionCapability(definition)
  };
}
