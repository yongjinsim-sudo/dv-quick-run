import type { DvqrScoreBand } from "./dvqrScoreTypes.js";

export function bandDvqrScore(displayScore: number): DvqrScoreBand {
  if (displayScore >= 86) {
    return "Very High";
  }
  if (displayScore >= 61) {
    return "High";
  }
  if (displayScore >= 41) {
    return "Moderate";
  }
  if (displayScore >= 21) {
    return "Low";
  }
  return "Minimal";
}
