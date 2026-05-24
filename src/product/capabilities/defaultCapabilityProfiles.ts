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
    },
    comparison: {
      canRunCrossEnvironmentDiff: false,
      canExportComparison: false,
      showWhatIsComingTeaser: true
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
    },
    comparison: {
      canRunCrossEnvironmentDiff: true,
      canExportComparison: true,
      showWhatIsComingTeaser: false
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
    },
    comparison: {
      canRunCrossEnvironmentDiff: true,
      canExportComparison: true,
      showWhatIsComingTeaser: false
    }
  }
};
