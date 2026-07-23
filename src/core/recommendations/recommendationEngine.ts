export interface RankedRecommendation {
  readonly id: string;
  readonly rank: number;
}

export function buildStableRecommendationId(namespace: string, ruleId: string, semanticKey: string): string {
  const normalized = semanticKey
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 72);
  return `${namespace}:${ruleId}:${normalized || "query"}`;
}

export function dedupeAndRankRecommendations<T extends RankedRecommendation>(items: readonly T[]): T[] {
  const byId = new Map<string, T>();
  for (const item of items) {
    const existing = byId.get(item.id);
    if (!existing || item.rank > existing.rank) {
      byId.set(item.id, item);
    }
  }
  return [...byId.values()].sort((left, right) =>
    right.rank - left.rank || (left.id < right.id ? -1 : left.id > right.id ? 1 : 0)
  );
}
