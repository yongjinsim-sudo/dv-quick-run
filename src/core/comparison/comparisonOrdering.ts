import type { ComparisonDriftGroup, ComparisonOperationalSignificance } from "./comparisonTypes.js";

const significanceRank: Record<ComparisonOperationalSignificance, number> = {
  High: 0,
  Medium: 1,
  Low: 2
};

export function compareOperationalSignificance(
  left: ComparisonOperationalSignificance,
  right: ComparisonOperationalSignificance
): number {
  return significanceRank[left] - significanceRank[right];
}

export function sortComparisonGroups(groups: readonly ComparisonDriftGroup[]): readonly ComparisonDriftGroup[] {
  return [...groups].sort((left, right) => {
    const significanceComparison = compareOperationalSignificance(left.significance, right.significance);
    if (significanceComparison !== 0) {
      return significanceComparison;
    }

    return left.title.localeCompare(right.title);
  });
}
