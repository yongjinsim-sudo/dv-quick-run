import type { CustomApiDefinition } from "../models/customApiTypes.js";
import { resolveCustomApiExecutionCapability } from "./customApiExecutionCapabilityResolver.js";

export interface CapabilityRunEnvironmentLockInput {
  readonly capturedEnvironmentUrl?: string;
  readonly activeEnvironmentUrl?: string;
  readonly capturedEnvironmentName?: string;
  readonly activeEnvironmentName?: string;
}

export interface CapabilityRunEnvironmentLockResult {
  readonly isLocked: boolean;
  readonly state?: "stale" | "denied";
  readonly reason?: string;
  readonly recovery?: string;
}

export interface CapabilityExecutionSafetyLockInput extends CapabilityRunEnvironmentLockInput {
  readonly definition: CustomApiDefinition;
  readonly expectedMethod: "GET" | "POST";
}

function normalizeEnvironmentUrl(value: string | undefined): string {
  return (value ?? "").trim().replace(/\/+$/, "").toLowerCase();
}

export function resolveCapabilityRunEnvironmentLock(
  input: CapabilityRunEnvironmentLockInput
): CapabilityRunEnvironmentLockResult {
  const capturedUrl = normalizeEnvironmentUrl(input.capturedEnvironmentUrl);
  const activeUrl = normalizeEnvironmentUrl(input.activeEnvironmentUrl);

  if (!capturedUrl || !activeUrl) {
    return {
      isLocked: true,
      state: "denied",
      reason: "Capability execution is denied because the active Dataverse environment could not be verified.",
      recovery: "Refresh Capability Explorer in the active environment before running this capability."
    };
  }

  if (capturedUrl !== activeUrl) {
    const capturedLabel = input.capturedEnvironmentName || input.capturedEnvironmentUrl || "the original environment";
    const activeLabel = input.activeEnvironmentName || input.activeEnvironmentUrl || "the active environment";

    return {
      isLocked: true,
      state: "stale",
      reason: `Capability execution is stale because the active environment changed from ${capturedLabel} to ${activeLabel}.`,
      recovery: "Refresh Capability Explorer in the active environment to regenerate executable authority."
    };
  }

  return { isLocked: false };
}

export function resolveCapabilityExecutionSafetyLock(
  input: CapabilityExecutionSafetyLockInput
): CapabilityRunEnvironmentLockResult {
  const environmentLock = resolveCapabilityRunEnvironmentLock(input);
  if (environmentLock.isLocked) {
    return environmentLock;
  }

  const capability = input.definition.executionCapability || resolveCustomApiExecutionCapability(input.definition);
  if (!capability.canExecute || capability.executionMethod !== input.expectedMethod) {
    return {
      isLocked: true,
      state: "denied",
      reason: `Capability execution is denied because this ${input.definition.operationKind} is ${capability.state}, not executable via ${input.expectedMethod}.`,
      recovery: "Review capability eligibility and refresh Capability Explorer before running this capability."
    };
  }

  return { isLocked: false };
}
