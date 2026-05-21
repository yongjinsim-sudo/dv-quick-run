export type DvqrScoreBand = "Minimal" | "Low" | "Moderate" | "High" | "Very High";

export interface DvqrScoreFactor {
  key: string;
  label: string;
  rawValue: number;
  softCap: number;
  normalizedRatio: number;
  weightedContribution: number;
  maxContribution: number;
  formula: string;
  explanation: string;
}

export interface DvqrScoreModel {
  rawDensityIndex: number;
  displayScore: number;
  band: DvqrScoreBand;
  contributingFactors: DvqrScoreFactor[];
  summary: string;
  normalizationVersion: string;
  explanationVersion: string;
  evidencePrinciple: string;
  methodology: string;
}
