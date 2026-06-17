import type { ComparisonSnapshotRegistryEntry } from "./comparisonSnapshotRegistry.js";

export type SnapshotSelectionMode = "none" | "compare" | "timelineReady";

export interface SnapshotSelectionDescriptor {
  readonly selectedSnapshotIds: readonly string[];
  readonly selectedSnapshots: readonly ComparisonSnapshotRegistryEntry[];
  readonly mode: SnapshotSelectionMode;
  readonly canCompare: boolean;
  readonly canBuildTimeline: boolean;
  readonly message: string;
}

export function resolveSnapshotSelection(
  entries: readonly ComparisonSnapshotRegistryEntry[],
  selectedSnapshotIds: readonly string[]
): SnapshotSelectionDescriptor {
  const byId = new Map(entries.map((entry) => [entry.snapshotId, entry]));
  const uniqueIds = Array.from(new Set(selectedSnapshotIds)).filter((id) => byId.has(id));
  const selectedSnapshots = uniqueIds.map((id) => byId.get(id)).filter((entry): entry is ComparisonSnapshotRegistryEntry => Boolean(entry));

  if (selectedSnapshots.length === 0) {
    return {
      selectedSnapshotIds: uniqueIds,
      selectedSnapshots,
      mode: "none",
      canCompare: false,
      canBuildTimeline: false,
      message: "Select two snapshots to compare. Select three or more to prepare timeline reconstruction."
    };
  }

  if (selectedSnapshots.length === 1) {
    return {
      selectedSnapshotIds: uniqueIds,
      selectedSnapshots,
      mode: "none",
      canCompare: false,
      canBuildTimeline: false,
      message: "One snapshot selected. Select one more snapshot to compare."
    };
  }

  if (selectedSnapshots.length === 2) {
    const [source, target] = selectedSnapshots;
    const sameEnvironment = source?.environmentLabel === target?.environmentLabel;
    return {
      selectedSnapshotIds: uniqueIds,
      selectedSnapshots,
      mode: "compare",
      canCompare: true,
      canBuildTimeline: false,
      message: sameEnvironment
        ? "Two snapshots selected. Compare Selected will open Timeline Diff."
        : "Two snapshots selected. Compare Selected will open Cross-Environment Diff."
    };
  }

  return {
    selectedSnapshotIds: uniqueIds,
    selectedSnapshots,
    mode: "timelineReady",
    canCompare: false,
    canBuildTimeline: true,
    message: `${selectedSnapshots.length} snapshots selected. Timeline reconstruction is coming in v0.13.x.`
  };
}
