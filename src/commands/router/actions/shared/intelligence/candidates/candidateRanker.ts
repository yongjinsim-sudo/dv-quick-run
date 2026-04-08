export function rankCandidatesByScore<T extends { score: number; sortKey?: string }>(items: T[]): T[] {
  return [...items].sort((left, right) => {
    const byScore = right.score - left.score;
    if (byScore !== 0) {
      return byScore;
    }

    return (left.sortKey ?? "").localeCompare(right.sortKey ?? "");
  });
}
