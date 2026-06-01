import * as vscode from "vscode";
import type { ComparisonSnapshotRegistryEntry } from "../index.js";

const RECENT_COMPARISONS_KEY = "dvQuickRun.comparison.recentComparisons.v1";
export const MAX_RECENT_COMPARISONS = 12;

export interface RecentComparisonEntry {
  readonly comparisonId: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly sourceLabel: string;
  readonly targetLabel: string;
  readonly sourceEnvironmentLabel: string;
  readonly targetEnvironmentLabel: string;
  readonly subjectLabel: string;
  readonly generatedAtIso: string;
  readonly differenceCount: number;
  readonly highCount: number;
  readonly mediumCount: number;
  readonly lowCount: number;
  readonly unalignedSubjects?: boolean;
}

export function getRecentComparisons(context: vscode.ExtensionContext): readonly RecentComparisonEntry[] {
  const entries = context.globalState.get<readonly RecentComparisonEntry[]>(RECENT_COMPARISONS_KEY, []);
  return entries
    .filter((entry: RecentComparisonEntry) => Boolean(entry.sourceSnapshotId && entry.targetSnapshotId && entry.generatedAtIso))
    .sort((left: RecentComparisonEntry, right: RecentComparisonEntry) => right.generatedAtIso.localeCompare(left.generatedAtIso));
}

export async function recordRecentComparison(
  context: vscode.ExtensionContext,
  entry: RecentComparisonEntry
): Promise<void> {
  const current = getRecentComparisons(context)
    .filter((candidate) => !(candidate.sourceSnapshotId === entry.sourceSnapshotId && candidate.targetSnapshotId === entry.targetSnapshotId));
  await context.globalState.update(RECENT_COMPARISONS_KEY, [entry, ...current].slice(0, MAX_RECENT_COMPARISONS));
}

export async function removeRecentComparison(
  context: vscode.ExtensionContext,
  comparisonId: string
): Promise<void> {
  const current = getRecentComparisons(context)
    .filter((candidate) => candidate.comparisonId !== comparisonId);
  await context.globalState.update(RECENT_COMPARISONS_KEY, current);
}

export function getVisibleRecentComparisons(
  recentComparisons: readonly RecentComparisonEntry[],
  entries: readonly ComparisonSnapshotRegistryEntry[],
  isProPreview: boolean
): readonly RecentComparisonEntry[] {
  if (!isProPreview) {
    return recentComparisons;
  }

  const visibleSnapshotIds = new Set(entries.map((entry) => entry.snapshotId));
  return recentComparisons.filter((entry) =>
    visibleSnapshotIds.has(entry.sourceSnapshotId) && visibleSnapshotIds.has(entry.targetSnapshotId)
  );
}
