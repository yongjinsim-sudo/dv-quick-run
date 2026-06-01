import type { ComparisonEnvironmentRef } from "../../../core/comparison/index.js";

export interface CloneableComparisonSnapshotFile {
  readonly environment?: ComparisonEnvironmentRef;
}

export function cloneSnapshotsForComparison<TSnapshot extends CloneableComparisonSnapshotFile>(
  snapshots: readonly TSnapshot[],
  label: string
): readonly TSnapshot[] {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    environment: {
      ...snapshot.environment,
      label
    }
  }));
}

