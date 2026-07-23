import type {
  ConfidenceLevel,
  ContributorReadinessState,
  InvestigationReadinessResultV1
} from "./readinessContracts.js";
import { READINESS_GAP_RULES_V1 } from "./gaps/gapRuleRegistry.js";
import { compareReadinessGaps } from "./gaps/gapOrdering.js";
import { applyReadinessConfidenceEffect, defaultReadinessConfidenceEffect } from "./readinessConfidenceEffect.js";

const CONTRIBUTOR_STATES: readonly ContributorReadinessState[] = [
  "Available", "Partial", "PermissionLimited", "Missing", "NotConsulted", "Unsupported", "Stale"
];

function duplicates(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const duplicateValues = new Set<string>();
  for (const value of values) {
    if (seen.has(value)) {duplicateValues.add(value);}
    seen.add(value);
  }
  return [...duplicateValues];
}

function confidenceRank(confidence: ConfidenceLevel): number {
  return confidence === "High" ? 3 : confidence === "Medium" ? 2 : confidence === "Low" ? 1 : 0;
}

export function validateReadinessResultInvariants(result: InvestigationReadinessResultV1): string[] {
  const errors: string[] = [];
  const registry = new Map(READINESS_GAP_RULES_V1.map((rule) => [rule.ruleId, rule]));
  if (result.contractVersion !== "investigation-readiness-v1") {errors.push("Unexpected readiness result contract version.");}
  if (result.profileVersion !== "1.0") {errors.push("Unexpected readiness profile version.");}
  if ("score" in result) {errors.push("Numeric readiness scores are prohibited.");}

  for (const duplicate of duplicates(result.contributorStates.map((item) => item.contributorId))) {
    errors.push(`Duplicate contributor ID: ${duplicate}.`);
  }
  for (const contributor of result.contributorStates) {
    if (!CONTRIBUTOR_STATES.includes(contributor.state)) {errors.push(`Invalid contributor state for ${contributor.contributorId}.`);}
    if (duplicates(contributor.evidenceRefs.map((reference) => reference.id)).length > 0) {
      errors.push(`Duplicate evidence reference on contributor ${contributor.contributorId}.`);
    }
  }
  for (const duplicate of duplicates(result.gaps.map((gap) => gap.id))) {errors.push(`Duplicate gap ID: ${duplicate}.`);}
  for (const duplicate of duplicates(result.recommendations.map((item) => item.id))) {errors.push(`Duplicate recommendation ID: ${duplicate}.`);}

  for (const gap of result.gaps) {
    const rule = registry.get(gap.ruleId);
    if (!rule) {
      errors.push(`Unregistered gap rule: ${gap.ruleId}.`);
      continue;
    }
    if (gap.category !== rule.category || gap.priority !== rule.priority) {
      errors.push(`Gap ${gap.id} does not preserve registry category and priority.`);
    }
    for (const recommendationId of gap.recommendationIds) {
      const recommendation = result.recommendations.find((item) => item.id === recommendationId);
      if (!recommendation || !recommendation.gapIds.includes(gap.id)) {
        errors.push(`Gap ${gap.id} has an invalid recommendation reference.`);
      }
    }
  }
  for (let index = 1; index < result.gaps.length; index += 1) {
    if (compareReadinessGaps(result.gaps[index - 1], result.gaps[index]) > 0) {
      errors.push("Gaps are not in canonical order.");
      break;
    }
  }

  for (const recommendation of result.recommendations) {
    if (!registry.has(recommendation.ruleId)) {errors.push(`Recommendation uses unregistered rule ${recommendation.ruleId}.`);}
    if (/\b(?:repair|deploy|approve|execute|apply|blame|certify)\b/i.test(recommendation.action)) {
      errors.push(`Recommendation ${recommendation.id} contains prohibited remediation or execution wording.`);
    }
    for (const gapId of recommendation.gapIds) {
      const gap = result.gaps.find((item) => item.id === gapId);
      if (!gap || !gap.recommendationIds.includes(recommendation.id)) {
        errors.push(`Recommendation ${recommendation.id} has an invalid gap reference.`);
      }
    }
  }

  const expectedEffect = defaultReadinessConfidenceEffect(result.posture);
  if (result.confidenceEffect !== expectedEffect) {errors.push("Confidence effect does not match the conservative posture default.");}
  const expectedConfidence = applyReadinessConfidenceEffect(result.baseSynthesizedConfidence, result.confidenceEffect);
  if (result.effectiveSynthesizedConfidence !== expectedConfidence) {errors.push("Effective synthesized confidence does not match the transition matrix.");}
  if (result.baseSynthesizedConfidence === "Unknown" && result.effectiveSynthesizedConfidence !== "Unknown") {
    errors.push("Readiness cannot make Unknown synthesized confidence known.");
  }
  if (result.baseSynthesizedConfidence !== "Unknown"
    && result.effectiveSynthesizedConfidence !== "Unknown"
    && confidenceRank(result.effectiveSynthesizedConfidence) > confidenceRank(result.baseSynthesizedConfidence)) {
    errors.push("Readiness raised synthesized confidence.");
  }
  if (result.confidenceEffect !== "Withhold"
    && result.baseSynthesizedConfidence !== "Unknown"
    && result.effectiveSynthesizedConfidence === "Unknown") {
    errors.push("Only Withhold may convert known synthesized confidence to Unknown.");
  }
  return errors;
}
