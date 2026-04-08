export type ConfidenceBand = "high" | "medium" | "low";

export function toConfidenceBand(score: number): ConfidenceBand {
  if (score >= 6) {
    return "high";
  }

  if (score >= 2.5) {
    return "medium";
  }

  return "low";
}
