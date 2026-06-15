export const capabilityIds = [
  "queryDoctorInsights",
  "actionableInsightApply",
  "traversalBatch",
  "traversalOptimizedBatch",
  "crossEnvironmentDiff",
  "timelineDiff",
  "comparisonReportExport",
  "investigationHandoffExport",
  "snapshotReplay",
  "runtimeBehaviourDrift",
  "identityParticipationDrift",
  "exportDvburArtifact"
] as const;

export type CapabilityId = (typeof capabilityIds)[number];

export function isCapabilityId(value: string): value is CapabilityId {
  return capabilityIds.includes(value as CapabilityId);
}
