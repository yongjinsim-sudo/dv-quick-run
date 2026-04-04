import type { CapabilityProfile } from "./capabilityTypes.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export const defaultCapabilityProfiles: Record<EntitlementPlan, CapabilityProfile> = {
  free: {
    queryDoctor: {
      insightLevel: 1,
      canApplyFix: false
    }
  },
  pro: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    }
  },
  team: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    }
  },
  enterprise: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    }
  },
  dev: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    }
  }
};
