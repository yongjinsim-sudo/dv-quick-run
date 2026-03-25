import type { CapabilitySet } from "./capabilityTypes.js";
import type { EntitlementContext } from "./entitlementTypes.js";
import { capabilityProfiles } from "./defaultCapabilityProfiles.js";

export function resolveCapabilities(entitlement: EntitlementContext): CapabilitySet {
  return capabilityProfiles[entitlement.plan];
}
