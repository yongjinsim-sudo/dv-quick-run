import type { CapabilityId } from "./capabilityIds.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export type CapabilitySource = "default-free" | "entitlement" | "default-pro";

export interface CapabilityGrant {
  capabilityId: CapabilityId;
  enabled: boolean;
  source: CapabilitySource;
}

export interface CapabilityManifest {
  edition: EntitlementPlan;
  grants: readonly CapabilityGrant[];
}

export function createCapabilityManifest(edition: EntitlementPlan, enabledCapabilities: readonly CapabilityId[], source: CapabilitySource): CapabilityManifest {
  return {
    edition,
    grants: enabledCapabilities.map((capabilityId) => ({
      capabilityId,
      enabled: true,
      source
    }))
  };
}
