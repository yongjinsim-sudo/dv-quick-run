import type { DvqrScoreBand, DvqrScoreFactor } from "./dvqrScoreTypes.js";

export const DVQR_SCORE_EXPLANATION_VERSION = "v1";

export const DVQR_SCORE_EVIDENCE_PRINCIPLE = "Observed evidence → bounded interpretation → guided investigation";

export const DVQR_SCORE_METHODOLOGY = [
  "DVQR Score is generated from observable metadata and operational participation signals.",
  "It combines relationship fanout, plugin/runtime participation, workflow/orchestration participation, column density, ownership model evidence, and solution participation where available.",
  "The score is used for operational density / contextual complexity orientation only. It is not risk, health, quality, security severity, or root-cause proof."
].join(" ");

export function buildDvqrScoreSummary(displayScore: number, band: DvqrScoreBand, factors: readonly DvqrScoreFactor[]): string {
  if (displayScore === 0) {
    return "DVQR Score shows minimal operational density from the available bounded evidence.";
  }

  const topFactors = factors
    .filter((factor) => factor.weightedContribution > 0)
    .sort((left, right) => right.weightedContribution - left.weightedContribution)
    .slice(0, 3)
    .map((factor) => factor.label.toLowerCase());

  const factorText = topFactors.length ? ` Primary contributors: ${topFactors.join(", ")}.` : "";
  return `DVQR Score indicates ${band.toLowerCase()} operational density / contextual complexity from the available evidence.${factorText}`;
}
