import type { CapabilityProfile } from "./capabilityTypes.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export const defaultCapabilityProfiles: Record<EntitlementPlan, CapabilityProfile> = {
  free: {
    queryDoctor: {
      insightLevel: 1
    },
    actionableInsights: {
      canApply: false
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: false
    }
  },
  pro: {
    queryDoctor: {
      insightLevel: 3
    },
    actionableInsights: {
      canApply: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  team: {
    queryDoctor: {
      insightLevel: 3
    },
    actionableInsights: {
      canApply: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  enterprise: {
    queryDoctor: {
      insightLevel: 3
    },
    actionableInsights: {
      canApply: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  },
  dev: {
    queryDoctor: {
      insightLevel: 3
    },
    actionableInsights: {
      canApply: true
    },
    traversal: {
      canRunBatch: true,
      canRunOptimizedBatch: true
    }
  }
};
