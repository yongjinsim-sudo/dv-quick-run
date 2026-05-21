import type { OperationalProfileModel } from "../product/operationalProfile/operationalProfileTypes.js";
import { bandDvqrScore } from "./dvqrScoreBanding.js";
import { DVQR_SCORE_EVIDENCE_PRINCIPLE, DVQR_SCORE_EXPLANATION_VERSION, DVQR_SCORE_METHODOLOGY, buildDvqrScoreSummary } from "./dvqrScoreExplanationBuilder.js";
import { normaliseDvqrDisplayScore, normaliseDvqrPrimitive } from "./dvqrScoreNormalizer.js";
import { calculateDvqrScorePrimitives } from "./dvqrScorePrimitiveCalculator.js";
import type { DvqrScoreFactor, DvqrScoreModel } from "./dvqrScoreTypes.js";
import { DVQR_SCORE_NORMALIZATION_VERSION, DVQR_SCORE_PRIMITIVES } from "./dvqrScoreWeighting.js";

export function buildDvqrScore(profile: OperationalProfileModel): DvqrScoreModel {
  const primitiveValues = calculateDvqrScorePrimitives(profile);
  const contributingFactors: DvqrScoreFactor[] = DVQR_SCORE_PRIMITIVES.map((primitive) => {
    const rawValue = primitiveValues[primitive.key as keyof typeof primitiveValues] ?? 0;
    const weightedContribution = Number(normaliseDvqrPrimitive(rawValue, primitive.softCap, primitive.maxContribution).toFixed(2));
    const normalizedRatio = primitive.maxContribution > 0
      ? Number((weightedContribution / primitive.maxContribution).toFixed(4))
      : 0;

    return {
      key: primitive.key,
      label: primitive.label,
      rawValue,
      softCap: primitive.softCap,
      normalizedRatio,
      weightedContribution,
      maxContribution: primitive.maxContribution,
      formula: `min(${primitive.maxContribution}, ${primitive.maxContribution} × ln(${rawValue} + 1) / ln(${primitive.softCap} + 1))`,
      explanation: primitive.explanation
    };
  });

  const rawDensityIndex = Number(contributingFactors.reduce((total, factor) => total + factor.weightedContribution, 0).toFixed(2));
  const displayScore = normaliseDvqrDisplayScore(rawDensityIndex);
  const band = bandDvqrScore(displayScore);

  return {
    rawDensityIndex,
    displayScore,
    band,
    contributingFactors,
    summary: buildDvqrScoreSummary(displayScore, band, contributingFactors),
    normalizationVersion: DVQR_SCORE_NORMALIZATION_VERSION,
    explanationVersion: DVQR_SCORE_EXPLANATION_VERSION,
    evidencePrinciple: DVQR_SCORE_EVIDENCE_PRINCIPLE,
    methodology: DVQR_SCORE_METHODOLOGY
  };
}
