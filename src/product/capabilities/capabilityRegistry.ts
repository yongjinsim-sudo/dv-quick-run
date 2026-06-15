import { capabilityIds, type CapabilityId } from "./capabilityIds.js";

export interface CapabilityDefinition {
  id: CapabilityId;
  title: string;
  description: string;
  defaultFreeEnabled: boolean;
  defaultProEnabled: boolean;
}

const capabilityDefinitions: Record<CapabilityId, CapabilityDefinition> = {
  queryDoctorInsights: {
    id: "queryDoctorInsights",
    title: "Query Doctor insights",
    description: "Metadata-aware query explanation and diagnostic orientation.",
    defaultFreeEnabled: true,
    defaultProEnabled: true
  },
  actionableInsightApply: {
    id: "actionableInsightApply",
    title: "Apply actionable insight",
    description: "Preview-first application of actionable query guidance.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  traversalBatch: {
    id: "traversalBatch",
    title: "Traversal batch",
    description: "Bounded traversal batch execution.",
    defaultFreeEnabled: true,
    defaultProEnabled: true
  },
  traversalOptimizedBatch: {
    id: "traversalOptimizedBatch",
    title: "Optimized traversal batch",
    description: "Accelerated traversal batch execution.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  crossEnvironmentDiff: {
    id: "crossEnvironmentDiff",
    title: "Cross-Environment Diff",
    description: "Real operational comparison across environment snapshots.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  timelineDiff: {
    id: "timelineDiff",
    title: "Timeline Diff",
    description: "Real operational comparison across same-environment snapshots.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  comparisonReportExport: {
    id: "comparisonReportExport",
    title: "Comparison report export",
    description: "Export real operational comparison reports.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  investigationHandoffExport: {
    id: "investigationHandoffExport",
    title: "Investigation Handoff export",
    description: "Export real investigation handoff reports.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  snapshotReplay: {
    id: "snapshotReplay",
    title: "Snapshot replay",
    description: "Replay real operational comparison continuity.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  runtimeBehaviourDrift: {
    id: "runtimeBehaviourDrift",
    title: "Runtime Behaviour Drift",
    description: "Compare plugin and workflow runtime behaviour drift.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  identityParticipationDrift: {
    id: "identityParticipationDrift",
    title: "Identity Participation Drift",
    description: "Compare identity participation drift.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  },
  exportDvburArtifact: {
    id: "exportDvburArtifact",
    title: "Export Upsert Artifact (DVBUR)",
    description: "Export a metadata-aware upsert artifact for DV Bulk Upsert Runner from Result Viewer evidence.",
    defaultFreeEnabled: false,
    defaultProEnabled: true
  }
};

export function getCapabilityDefinition(capabilityId: CapabilityId): CapabilityDefinition {
  return capabilityDefinitions[capabilityId];
}

export function getAllCapabilityDefinitions(): CapabilityDefinition[] {
  return capabilityIds.map((capabilityId) => capabilityDefinitions[capabilityId]);
}

export function getDefaultEnabledCapabilityIds(plan: "free" | "pro"): CapabilityId[] {
  return getAllCapabilityDefinitions()
    .filter((definition) => plan === "pro" ? definition.defaultProEnabled : definition.defaultFreeEnabled)
    .map((definition) => definition.id);
}
