import type { ExplainConfidenceLevel } from "./explainEngineTypes.js";

const confidenceRank: Record<ExplainConfidenceLevel, number> = {
  high: 3,
  medium: 2,
  low: 1,
  unknown: 0
};

export function fromNumericConfidence(value: number | undefined): ExplainConfidenceLevel {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "unknown";
  }

  if (value >= 0.8) {
    return "high";
  }

  if (value >= 0.55) {
    return "medium";
  }

  if (value > 0) {
    return "low";
  }

  return "unknown";
}

export function combineConfidence(levels: ExplainConfidenceLevel[]): ExplainConfidenceLevel {
  const known = levels.filter((level) => level !== "unknown");
  if (!known.length) {
    return "unknown";
  }

  const lowest = known.reduce((current, next) => confidenceRank[next] < confidenceRank[current] ? next : current, known[0]);
  return lowest;
}
