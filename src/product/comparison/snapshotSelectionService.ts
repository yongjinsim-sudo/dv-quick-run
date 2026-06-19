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
    const sameEnvironment = getSnapshotEnvironmentKey(source) === getSnapshotEnvironmentKey(target);
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

  const sameTimelineEnvironment = hasSingleSnapshotEnvironment(selectedSnapshots);
  const sameTimelineSubject = hasSingleSnapshotSubject(selectedSnapshots);
  const canBuildTimeline = sameTimelineEnvironment && sameTimelineSubject;
  const message = !sameTimelineSubject
    ? "Timeline reconstruction requires snapshots for the same subject. Select one entity or subject only."
    : !sameTimelineEnvironment
      ? "Timeline reconstruction requires same-environment snapshots. Use Cross-Environment Diff for environment comparison."
      : `${selectedSnapshots.length} compatible snapshots selected. Ready to reconstruct an operational timeline.`;

  return {
    selectedSnapshotIds: uniqueIds,
    selectedSnapshots,
    mode: canBuildTimeline ? "timelineReady" : "none",
    canCompare: false,
    canBuildTimeline,
    message
  };
}

function getSnapshotEnvironmentKey(entry: ComparisonSnapshotRegistryEntry | undefined): string | undefined {
  const value = entry?.environmentUrl ?? entry?.environmentLabel;
  return value?.trim().toLowerCase();
}

function getSnapshotSubjectKey(entry: ComparisonSnapshotRegistryEntry | undefined): string | undefined {
  const value = entry?.entityLogicalName ?? entry?.entityDisplayName ?? entry?.label;
  return value?.trim().toLowerCase();
}

function hasSingleSnapshotEnvironment(entries: readonly ComparisonSnapshotRegistryEntry[]): boolean {
  const first = getSnapshotEnvironmentKey(entries[0]);
  return Boolean(first) && entries.every((entry) => getSnapshotEnvironmentKey(entry) === first);
}

function hasSingleSnapshotSubject(entries: readonly ComparisonSnapshotRegistryEntry[]): boolean {
  const first = getSnapshotSubjectKey(entries[0]);
  return Boolean(first) && entries.every((entry) => getSnapshotSubjectKey(entry) === first);
}
