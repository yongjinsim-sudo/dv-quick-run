import type { FieldDef } from "../../../../../../services/entityFieldMetadataService.js";
import { isChoiceAttributeType, isLookupLikeAttributeType } from "../../../../../../metadata/metadataModel.js";
import { getBusinessSemanticBoost, getBaseFieldLogicalName, isLookupBackingField } from "../../intelligence/classification/fieldSemantics.js";
import { toConfidenceBand } from "../../intelligence/scoring/confidenceBanding.js";
import type { ExecutionFieldObservation } from "../executionEvidence.js";
import type { RankedResultInsightCandidate, ResultInsightContext, ResultInsightSuggestionTier } from "./resultInsightTypes.js";

function fieldTypeScore(field?: FieldDef): number {
  if (!field?.attributeType) {
    return 0;
  }

  const attributeType = field.attributeType.trim().toLowerCase();

  if (attributeType === "status" || attributeType === "state") {
    return 4.0;
  }

  if (attributeType === "picklist" || attributeType === "multipicklist" || attributeType === "multiselectpicklist") {
    return 3.4;
  }

  if (attributeType === "boolean") {
    return 2.0;
  }

  if (attributeType === "lookup" || attributeType === "customer" || attributeType === "owner") {
    return -0.6;
  }

  if (attributeType === "string") {
    return 0.4;
  }

  return 0;
}

function choiceCardinalityScore(observation: ExecutionFieldObservation, field?: FieldDef): number {
  if (!field || !isChoiceAttributeType(field.attributeType) || observation.kind !== "categorical") {
    return 0;
  }

  if (observation.distinctCount >= 2 && observation.distinctCount <= 8) {
    return 1.8;
  }

  if (observation.distinctCount <= 12) {
    return 0.9;
  }

  return -0.5;
}

function sparsityPenalty(observation: ExecutionFieldObservation, totalRows: number): number {
  if (observation.kind === "categorical" && observation.distinctCount >= 2) {
    return 0;
  }

  const nonNullRatio = observation.nonNullCount / totalRows;

  if (nonNullRatio <= 0.01 || nonNullRatio >= 0.99) {
    return 3.5;
  }

  if (nonNullRatio <= 0.03 || nonNullRatio >= 0.97) {
    return 2.4;
  }

  if (nonNullRatio <= 0.08 || nonNullRatio >= 0.92) {
    return 1.2;
  }

  return 0;
}

function distributionScore(observation: ExecutionFieldObservation, totalRows: number): number {
  const nonNullRatio = observation.nonNullCount / totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const presenceBalance = observation.nullCount > 0 ? 1 - Math.abs(nonNullRatio - 0.5) * 2 : 0;
  const categoricalBalance = observation.kind === "categorical" ? 1 - dominanceRatio : 0;
  return (presenceBalance * 2.2) + (categoricalBalance * 2.4);
}

function lookupBackingPenalty(observation: ExecutionFieldObservation, field?: FieldDef): number {
  if (isLookupBackingField(observation.field)) {
    return 3.2;
  }

  if (field && isLookupLikeAttributeType(field.attributeType)) {
    return 1.4;
  }

  return 0;
}

function determineTier(observation: ExecutionFieldObservation, field: FieldDef | undefined, score: number): ResultInsightSuggestionTier {
  if (score < 1.2) {
    return "secondary";
  }

  if (isLookupBackingField(observation.field)) {
    return "secondary";
  }

  if (field && isLookupLikeAttributeType(field.attributeType)) {
    return score >= 3 ? "recommended" : "secondary";
  }

  if (field && isChoiceAttributeType(field.attributeType) && observation.kind === "categorical" && observation.distinctCount >= 2) {
    return "recommended";
  }

  return "recommended";
}

export function isMeaningfulResultInsightCandidate(
  observation: ExecutionFieldObservation,
  context: ResultInsightContext,
  field?: FieldDef
): boolean {
  const baseFieldName = getBaseFieldLogicalName(observation.field);
  if (context.filterFieldNames.includes(observation.field) || context.filterFieldNames.includes(baseFieldName)) {
    return false;
  }

  const nonNullRatio = observation.nonNullCount / context.totalRows;
  const dominanceRatio = observation.nonNullCount > 0 ? observation.mostCommonCount / observation.nonNullCount : 1;
  const hasMeaningfulPresenceSplit = observation.nullCount >= 3 && observation.nonNullCount >= 3 && nonNullRatio <= 0.98;
  const hasMeaningfulCategoricalSplit = observation.kind === "categorical"
    && observation.distinctCount >= 2
    && observation.distinctCount <= Math.min(12, Math.max(2, context.totalRows - 1))
    && dominanceRatio < 0.97
    && observation.topValues.some((item) => item.count >= 2);

  const isBusinessChoiceField = Boolean(field && isChoiceAttributeType(field.attributeType))
    || getBusinessSemanticBoost(observation.field) >= 2.2;
  const hasUsefulChoiceSignal = observation.kind === "categorical"
    && isBusinessChoiceField
    && observation.distinctCount >= 2
    && observation.topValues.some((item) => item.count >= 2);

  return hasMeaningfulPresenceSplit || hasMeaningfulCategoricalSplit || hasUsefulChoiceSignal;
}

export function scoreResultInsightCandidate(
  observation: ExecutionFieldObservation,
  context: ResultInsightContext,
  field?: FieldDef
): RankedResultInsightCandidate {
  const rawScore = distributionScore(observation, context.totalRows)
    + fieldTypeScore(field)
    + getBusinessSemanticBoost(observation.field)
    + choiceCardinalityScore(observation, field)
    - lookupBackingPenalty(observation, field)
    - sparsityPenalty(observation, context.totalRows);

  const score = field && isChoiceAttributeType(field.attributeType) && observation.kind === "categorical" && observation.distinctCount >= 2
    ? rawScore + 1.8
    : rawScore;

  const tier = determineTier(observation, field, score);

  const reasons = [
    { code: "distribution", message: `distribution score ${distributionScore(observation, context.totalRows).toFixed(2)}` },
    { code: "semantic", message: `business semantic boost ${getBusinessSemanticBoost(observation.field).toFixed(2)}` }
  ];

  if (field?.attributeType) {
    reasons.push({ code: "attributeType", message: `attribute type ${field.attributeType}` });
  }

  if (isLookupBackingField(observation.field)) {
    reasons.push({ code: "lookupBacking", message: "lookup-backing field penalty applied" });
  }

  return {
    item: {
      observation,
      field,
      tier
    },
    score,
    confidence: toConfidenceBand(score),
    reasons
  };
}
