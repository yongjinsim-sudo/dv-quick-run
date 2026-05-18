import type { CustomApiBoundTargetKind, CustomApiDefinition } from "../models/customApiTypes.js";

export type BoundActionTargetValidationReasonCode =
  | "BoundEntityAction"
  | "BoundCollectionActionDeferred"
  | "BoundTargetRequired"
  | "BoundTargetEntityMismatch"
  | "BoundTargetInvalidGuid"
  | "BoundRouteUnavailable"
  | "BoundTargetEnvironmentMismatch";

export interface BoundActionTargetValidationRequest {
  definition: CustomApiDefinition;
  rowId?: unknown;
  targetEntityLogicalName?: string;
  capturedEnvironmentUrl?: string;
  activeEnvironmentUrl?: string;
}

export interface BoundActionTargetValidationResult {
  valid: boolean;
  normalizedRowId?: string;
  entityLogicalName: string;
  entitySetName: string;
  bindingKind: CustomApiBoundTargetKind;
  reasonCodes: BoundActionTargetValidationReasonCode[];
  label: string;
  reason: string;
}

const ENTITY_SET_UNRESOLVED = "<entity-set-unresolved>";
const GUID_PATTERN = /^\{?([0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12})\}?$/;

function normalizeGuid(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const match = value.trim().match(GUID_PATTERN);
  return match?.[1].toLowerCase();
}

function normalizeEnvironmentUrl(value: string | undefined): string {
  return value?.trim().replace(/\/+$/, "").toLowerCase() ?? "";
}

function resolveBoundTargetKind(definition: CustomApiDefinition): CustomApiBoundTargetKind {
  return definition.boundTargetKind || definition.executionEligibility?.odataBoundTargetKind || "unknown";
}

function resolveBoundEntityLogicalName(definition: CustomApiDefinition): string {
  return definition.boundEntityLogicalName || definition.executionEligibility?.odataBoundEntityLogicalName || "";
}

function resolveBoundEntitySetName(definition: CustomApiDefinition): string {
  return definition.boundEntitySetName || definition.executionEligibility?.odataBoundEntitySetName || "";
}

function fail(args: {
  entityLogicalName: string;
  entitySetName: string;
  bindingKind: CustomApiBoundTargetKind;
  reasonCodes: BoundActionTargetValidationReasonCode[];
  label: string;
  reason: string;
}): BoundActionTargetValidationResult {
  return {
    valid: false,
    ...args
  };
}

export function validateBoundActionTarget(
  request: BoundActionTargetValidationRequest
): BoundActionTargetValidationResult {
  const { definition } = request;
  const bindingKind = resolveBoundTargetKind(definition);
  const entityLogicalName = resolveBoundEntityLogicalName(definition);
  const entitySetName = resolveBoundEntitySetName(definition);
  const normalizedRowId = normalizeGuid(request.rowId);
  const targetEntityLogicalName = request.targetEntityLogicalName?.trim().toLowerCase();
  const expectedEntityLogicalName = entityLogicalName.trim().toLowerCase();

  if (bindingKind === "collection") {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundCollectionActionDeferred"],
      label: "Inspect only — collection-bound Action deferred",
      reason: "Collection-bound Action execution is deferred and does not accept a target row id."
    });
  }

  if (bindingKind !== "entity") {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundTargetRequired"],
      label: "Inspect only — unsupported bound target",
      reason: "Bound Action target metadata is unavailable or unsupported."
    });
  }

  if (targetEntityLogicalName && expectedEntityLogicalName && targetEntityLogicalName !== expectedEntityLogicalName) {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundTargetEntityMismatch"],
      label: "Inspect only — target entity mismatch",
      reason: `This Action is bound to ${entityLogicalName}, but the supplied target entity is ${request.targetEntityLogicalName}.`
    });
  }

  if (!normalizedRowId) {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundTargetInvalidGuid"],
      label: "Inspect only — invalid target row id",
      reason: "Enter a valid target row GUID before generating a bound Action preview."
    });
  }

  if (!entitySetName || entitySetName === ENTITY_SET_UNRESOLVED) {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundRouteUnavailable"],
      label: "Inspect only — bound route unavailable",
      reason: "The bound entity set could not be resolved from metadata, so DV Quick Run cannot create an executable bound route."
    });
  }

  const capturedEnvironment = normalizeEnvironmentUrl(request.capturedEnvironmentUrl);
  const activeEnvironment = normalizeEnvironmentUrl(request.activeEnvironmentUrl);
  if (capturedEnvironment && activeEnvironment && capturedEnvironment !== activeEnvironment) {
    return fail({
      entityLogicalName,
      entitySetName,
      bindingKind,
      reasonCodes: ["BoundTargetEnvironmentMismatch"],
      label: "Stale context",
      reason: "The active environment changed after this bound Action context was created. Refresh Capability Explorer and generate a fresh preview."
    });
  }

  return {
    valid: true,
    normalizedRowId,
    entityLogicalName,
    entitySetName,
    bindingKind,
    reasonCodes: ["BoundEntityAction"],
    label: "Bound target valid",
    reason: "The target row id, binding entity, entity set, and active environment are valid for a bound Action preview."
  };
}
