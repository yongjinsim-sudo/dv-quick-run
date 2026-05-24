export type CapabilityLevel = 0 | 1 | 2 | 3;

export interface ActionableInsightCapabilityProfile {
  canApply: boolean;
}

export interface QueryDoctorCapabilityProfile {
  insightLevel: CapabilityLevel;

  /**
   * Legacy compatibility only. New code should use actionableInsights.canApply
   * through canApplyActionableInsight().
   */
  canApplyFix?: boolean;
}

export interface TraversalCapabilityProfile {
  canRunBatch: boolean;
  canRunOptimizedBatch: boolean;
}

export interface ComparisonCapabilityProfile {
  canRunCrossEnvironmentDiff: boolean;
  canExportComparison: boolean;
  showWhatIsComingTeaser: boolean;
}

export interface CapabilityProfile {
  queryDoctor: QueryDoctorCapabilityProfile;
  actionableInsights: ActionableInsightCapabilityProfile;
  traversal: TraversalCapabilityProfile;
  comparison: ComparisonCapabilityProfile;
}
