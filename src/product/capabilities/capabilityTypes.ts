export type CapabilityLevel = 0 | 1 | 2 | 3;

export interface QueryDoctorCapabilityProfile {
  insightLevel: CapabilityLevel;
  canApplyFix: boolean;
}

export interface TraversalCapabilityProfile {
  canRunBatch: boolean;
  canRunOptimizedBatch: boolean;
}

export interface CapabilityProfile {
  queryDoctor: QueryDoctorCapabilityProfile;
  traversal: TraversalCapabilityProfile;
}
