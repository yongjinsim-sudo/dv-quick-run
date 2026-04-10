import type { CapabilityProfile } from "./capabilityTypes.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export const defaultCapabilityProfiles: Record<EntitlementPlan, CapabilityProfile> = {
  free: {
    queryDoctor: {
      insightLevel: 1,
      canApplyFix: false
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: false
    }
  },
  pro: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  team: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  enterprise: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  dev: {
    queryDoctor: {
      insightLevel: 3,
      canApplyFix: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  }
};
