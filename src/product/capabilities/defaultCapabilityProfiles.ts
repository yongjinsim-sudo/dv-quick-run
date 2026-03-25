import type { CapabilitySet } from "./capabilityTypes.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export const capabilityProfiles: Record<EntitlementPlan, CapabilitySet> = {
  free: {
    queryDoctor: 1,
    investigationDepth: 1,
    traversalDepth: 0
  },
  pro: {
    queryDoctor: 3,
    investigationDepth: 2,
    traversalDepth: 1
  },
  team: {
    queryDoctor: 3,
    investigationDepth: 3,
    traversalDepth: 2
  },
  enterprise: {
    queryDoctor: 3,
    investigationDepth: 3,
    traversalDepth: 3
  },
  dev: {
    queryDoctor: 3,
    investigationDepth: 3,
    traversalDepth: 3
  }
};
