export interface CapabilityRunEnvironmentLockInput {
  readonly capturedEnvironmentUrl?: string;
  readonly activeEnvironmentUrl?: string;
  readonly capturedEnvironmentName?: string;
  readonly activeEnvironmentName?: string;
}

export interface CapabilityRunEnvironmentLockResult {
  readonly isLocked: boolean;
  readonly reason?: string;
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
      reason: "Capability execution is locked because the active Dataverse environment could not be verified. Refresh Capability Explorer before running."
    };
  }

  if (capturedUrl !== activeUrl) {
    const capturedLabel = input.capturedEnvironmentName || input.capturedEnvironmentUrl || "the original environment";
    const activeLabel = input.activeEnvironmentName || input.activeEnvironmentUrl || "the active environment";

    return {
      isLocked: true,
      reason: `Capability execution is locked because the active environment changed from ${capturedLabel} to ${activeLabel}. Refresh Capability Explorer before running.`
    };
  }

  return { isLocked: false };
}
