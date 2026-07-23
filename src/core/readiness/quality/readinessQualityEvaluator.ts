import type {
  EvidenceQualityDimension,
  EvidenceQualityDimensionV1,
  EvidenceQualityState,
  EvidenceReferenceV1
} from "../readinessContracts.js";
import type { NormalizedReadinessContributorV1 } from "../contributorStateNormalizer.js";
import type { InvestigationReadinessProfileV1 } from "../readinessProfile.js";
import { ordinalCompare, uniqueSorted } from "../readinessValueAccess.js";

const DIMENSION_ORDER: readonly EvidenceQualityDimension[] = [
  "Provenance", "Coverage", "Freshness", "Scope", "Repeatability", "Consistency"
];

function applicableContributors(
  contributors: readonly NormalizedReadinessContributorV1[]
): NormalizedReadinessContributorV1[] {
  return contributors.filter((contributor) =>
    contributor.applicable && (contributor.role !== "Optional" || contributor.evidenceRefs.length > 0)
  );
}

function evidenceBearing(
  contributors: readonly NormalizedReadinessContributorV1[]
): NormalizedReadinessContributorV1[] {
  return contributors.filter((contributor) =>
    contributor.evidenceRefs.length > 0
    && ["Available", "Partial", "Stale"].includes(contributor.state)
  );
}

function explicitState(
  contributors: readonly NormalizedReadinessContributorV1[],
  dimension: EvidenceQualityDimension
): EvidenceQualityState | undefined {
  const states = contributors
    .map((contributor) => contributor.qualityStates[dimension])
    .filter((state): state is EvidenceQualityState => Boolean(state));
  if (states.includes("Limited")) {
    return "Limited";
  }
  if (states.includes("Unknown")) {
    return "Unknown";
  }
  if (states.includes("Sufficient")) {
    return "Sufficient";
  }
  return states.length > 0 ? "NotApplicable" : undefined;
}

function evaluateDimensionState(
  dimension: EvidenceQualityDimension,
  contributors: readonly NormalizedReadinessContributorV1[]
): EvidenceQualityState {
  const applicable = applicableContributors(contributors);
  const withEvidence = evidenceBearing(applicable);
  const explicit = explicitState(applicable, dimension);
  if (explicit === "Limited") {
    return "Limited";
  }

  switch (dimension) {
    case "Coverage":
      if (applicable.length === 0) {
        return "NotApplicable";
      }
      return applicable.some((contributor) => contributor.state !== "Available") ? "Limited" : "Sufficient";
    case "Freshness":
      if (withEvidence.length === 0) {
        return "NotApplicable";
      }
      if (withEvidence.some((contributor) => contributor.state === "Stale")) {
        return "Limited";
      }
      return explicit ?? "Unknown";
    case "Provenance":
      if (withEvidence.length === 0) {
        return "Unknown";
      }
      if (explicit) {
        return explicit;
      }
      return withEvidence.every((contributor) => contributor.evidenceRefs.length > 0) ? "Sufficient" : "Unknown";
    case "Scope":
      if (withEvidence.length === 0) {
        return "Unknown";
      }
      return explicit ?? "Sufficient";
    case "Repeatability":
      if (withEvidence.length === 0) {
        return "Unknown";
      }
      if (applicable.some((contributor) => contributor.contributorId === "query.evidence" && contributor.state === "Partial")) {
        return "Limited";
      }
      return explicit ?? "Sufficient";
    case "Consistency":
      if (withEvidence.length === 0) {
        return "Unknown";
      }
      return explicit ?? "Sufficient";
  }
}

function referencesFor(
  contributors: readonly NormalizedReadinessContributorV1[]
): EvidenceReferenceV1[] {
  const byId = new Map<string, EvidenceReferenceV1>();
  for (const reference of contributors.flatMap((contributor) => contributor.evidenceRefs)) {
    if (!byId.has(reference.id)) {
      byId.set(reference.id, reference);
    }
  }
  return [...byId.values()].sort((left, right) => ordinalCompare(left.id, right.id));
}

function explanation(dimension: EvidenceQualityDimension, state: EvidenceQualityState): string {
  if (dimension === "Freshness" && state === "Unknown") {
    return "No explicit provider validity or profile threshold establishes freshness; no global TTL was invented.";
  }
  if (state === "NotApplicable") {
    return `${dimension} is not applicable to the supplied qualifying evidence.`;
  }
  if (state === "Limited") {
    return `${dimension} is materially limited by one or more applicable contributors.`;
  }
  if (state === "Sufficient") {
    return `${dimension} is sufficient for this bounded readiness assessment.`;
  }
  return `${dimension} cannot be established from the supplied canonical evidence.`;
}

export function evaluateReadinessQuality(
  contributors: readonly NormalizedReadinessContributorV1[],
  profile: InvestigationReadinessProfileV1
): EvidenceQualityDimensionV1[] {
  return DIMENSION_ORDER.map((dimension): EvidenceQualityDimensionV1 => {
    const relevant = applicableContributors(contributors);
    const state = evaluateDimensionState(dimension, contributors);
    const qualityRule = profile.qualityRules.find((rule) => rule.dimension === dimension);
    const ruleIds = [qualityRule?.ruleId];
    if (dimension === "Freshness") {
      ruleIds.push(...profile.freshnessRules
        .filter((rule) => relevant.some((contributor) => rule.contributorIds.includes(contributor.contributorId)))
        .map((rule) => rule.ruleId));
    }
    return {
      dimension,
      state,
      explanation: explanation(dimension, state),
      ruleIds: uniqueSorted(ruleIds.filter((ruleId): ruleId is string => Boolean(ruleId))),
      contributorIds: uniqueSorted(relevant.map((contributor) => contributor.contributorId)),
      evidenceRefs: referencesFor(relevant)
    };
  }).sort((left, right) => DIMENSION_ORDER.indexOf(left.dimension) - DIMENSION_ORDER.indexOf(right.dimension));
}
