import type {
  ConfidenceLevel,
  ContributorReadinessV1,
  EvidenceReferenceV1,
  InvestigationReadinessRequestV1,
  InvestigationReadinessResponseV1,
  InvestigationReadinessResultV1,
  ReadonlyJsonObject
} from "./readinessContracts.js";
import { createReadinessError } from "./readinessContracts.js";
import { normalizeReadinessContributors } from "./contributorStateNormalizer.js";
import { evaluateReadinessGaps } from "./gaps/gapEvaluator.js";
import { resolveReadinessProfile } from "./readinessProfileResolver.js";
import { evaluateReadinessQuality } from "./quality/readinessQualityEvaluator.js";
import { resolveReadinessConfidence } from "./readinessConfidenceEffect.js";
import { validateReadinessResultInvariants } from "./readinessInvariantValidator.js";
import { resolveReadinessPosture } from "./readinessPostureResolver.js";
import { fingerprintReadinessRequest } from "./serialization/readinessCanonicalJson.js";
import { isJsonObject, ordinalCompare, readString, readStringArray, uniqueSorted } from "./readinessValueAccess.js";
import { buildReadinessRecommendations } from "../recommendations/readinessRecommendationRules.js";

const CONFIDENCE_LEVELS: readonly ConfidenceLevel[] = ["High", "Medium", "Low", "Unknown"];

export interface InvestigationReadinessService {
  assess(request: InvestigationReadinessRequestV1): InvestigationReadinessResponseV1;
}

function validDateTime(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function duplicateIds(values: readonly ReadonlyJsonObject[]): boolean {
  const ids = values.map((value) => readString(value.id)).filter((id): id is string => Boolean(id));
  return ids.length !== new Set(ids).size;
}

function validateRequest(requestValue: unknown): InvestigationReadinessResponseV1 | undefined {
  if (!isJsonObject(requestValue)) {
    return createReadinessError("InvalidInput", "The readiness request must be a plain serializable object.");
  }
  if (requestValue.contractVersion !== "investigation-readiness-request-v1") {
    return createReadinessError("InvalidInput", "Unsupported or missing readiness request contract version.");
  }
  if (!isJsonObject(requestValue.investigationInput)) {
    return createReadinessError("InvalidInput", "The readiness request must include investigationInput.");
  }
  if (requestValue.investigationInput.version !== "investigation-input-v1") {
    return createReadinessError("UnsupportedInputVersion", "Only investigation-input-v1 is supported.");
  }
  if (!isJsonObject(requestValue.understandingBundle) || requestValue.understandingBundle.version !== "understanding-bundle-v2") {
    return createReadinessError("UnsupportedInputVersion", "Only understanding-bundle-v2 is supported.");
  }
  if (!isJsonObject(requestValue.profile) || !readString(requestValue.profile.profileId) || !readString(requestValue.profile.version)) {
    return createReadinessError("InvalidInput", "A readiness profile ID and version are required.");
  }
  const input = requestValue.investigationInput;
  if (!readString(input.investigationId)) {
    return createReadinessError("InvalidInput", "investigationInput.investigationId is required.");
  }
  if (!["timeline", "cross-environment-diff"].includes(String(input.kind))) {
    return createReadinessError("InvalidInput", "The investigation kind is not supported.");
  }
  if (!isJsonObject(input.subject) || !isJsonObject(input.provenance)
    || !Array.isArray(input.evidence) || !input.evidence.every(isJsonObject)
    || !Array.isArray(input.contributors) || !input.contributors.every(isJsonObject)) {
    return createReadinessError("InvalidInput", "The canonical investigation input is structurally invalid.");
  }
  if (duplicateIds(input.contributors) || duplicateIds(input.evidence)) {
    return createReadinessError("InvalidInput", "Contributor and evidence identifiers must be unique.");
  }
  if (!validDateTime(requestValue.assessmentUtc) || !validDateTime(requestValue.generatedUtc)) {
    return createReadinessError("InvalidInput", "assessmentUtc and generatedUtc must be explicit valid timestamps.");
  }
  const baseConfidence = requestValue.understandingBundle.baseSynthesizedConfidence;
  if (typeof baseConfidence !== "string" || !CONFIDENCE_LEVELS.includes(baseConfidence as ConfidenceLevel)) {
    return createReadinessError("InvalidInput", "understandingBundle.baseSynthesizedConfidence is invalid.");
  }
  return undefined;
}

function publicContributor(contributor: ReturnType<typeof normalizeReadinessContributors>[number]): ContributorReadinessV1 {
  return {
    contributorId: contributor.contributorId,
    sourceContributorIds: contributor.sourceContributorIds,
    role: contributor.role,
    state: contributor.state,
    applicable: contributor.applicable,
    explanation: contributor.explanation,
    evidenceRefs: contributor.evidenceRefs,
    limitations: contributor.limitations
  };
}

function aggregateEvidenceReferences(contributors: readonly ContributorReadinessV1[]): EvidenceReferenceV1[] {
  const byId = new Map<string, EvidenceReferenceV1>();
  for (const reference of contributors.flatMap((contributor) => contributor.evidenceRefs)) {
    if (!byId.has(reference.id)) {byId.set(reference.id, reference);}
  }
  return [...byId.values()].sort((left, right) => ordinalCompare(left.id, right.id));
}

function summaryFor(posture: InvestigationReadinessResultV1["posture"]): string {
  switch (posture) {
    case "Ready": return "The supplied evidence is ready for bounded synthesis; readiness does not certify truth or root cause.";
    case "Conditional": return "The supplied evidence supports bounded synthesis with material qualifications that must remain visible.";
    case "Limited": return "The supplied evidence supports only a limited synthesis because one or more High-priority gaps remain.";
    case "NotAssessable": return "The supplied canonical input does not contain qualifying Primary evidence, so readiness cannot be assessed without inventing facts.";
  }
}

export function assessInvestigationReadiness(requestValue: InvestigationReadinessRequestV1): InvestigationReadinessResponseV1 {
  const validationError = validateRequest(requestValue);
  if (validationError) {
    return validationError;
  }
  const request = requestValue as InvestigationReadinessRequestV1;
  const profileResolution = resolveReadinessProfile(request.profile, request.investigationInput.kind);
  if (!profileResolution.ok) {
    return profileResolution.error;
  }

  try {
    const normalized = normalizeReadinessContributors(request, profileResolution.profile);
    const qualityDimensions = evaluateReadinessQuality(normalized, profileResolution.profile);
    const evaluatedGaps = evaluateReadinessGaps(request, profileResolution.profile, normalized);
    const posture = resolveReadinessPosture(normalized, evaluatedGaps);
    const baseConfidence = request.understandingBundle.baseSynthesizedConfidence as ConfidenceLevel;
    const confidence = resolveReadinessConfidence(posture, baseConfidence);
    const recommendationResult = buildReadinessRecommendations(evaluatedGaps);
    const contributorStates = normalized.map(publicContributor);
    const result: InvestigationReadinessResultV1 = {
      contractVersion: "investigation-readiness-v1",
      investigationId: request.investigationInput.investigationId as string,
      investigationKind: request.investigationInput.kind,
      profileId: profileResolution.profile.profileId,
      profileVersion: profileResolution.profile.version,
      posture,
      summary: summaryFor(posture),
      contributorStates,
      qualityDimensions,
      gaps: recommendationResult.gaps,
      recommendations: recommendationResult.recommendations,
      confidenceEffect: confidence.effect,
      baseSynthesizedConfidence: baseConfidence,
      effectiveSynthesizedConfidence: confidence.effectiveConfidence,
      confidenceLimitations: confidence.limitations,
      evidenceRefs: aggregateEvidenceReferences(contributorStates),
      limitations: uniqueSorted([
        ...readStringArray(request.understandingBundle.limitations),
        ...normalized.flatMap((contributor) => contributor.limitations),
        "Investigation readiness is advisory and does not certify truth, causality, completeness or remediation authority."
      ]),
      inputFingerprint: fingerprintReadinessRequest(request),
      assessmentUtc: request.assessmentUtc,
      generatedUtc: request.generatedUtc
    };
    const invariantErrors = validateReadinessResultInvariants(result);
    return invariantErrors.length === 0
      ? result
      : createReadinessError("ContractViolation", "The readiness result violated one or more canonical invariants.", invariantErrors);
  } catch (error) {
    return createReadinessError(
      "ContractViolation",
      "The readiness assessment could not produce a valid canonical result.",
      [error instanceof Error ? error.message : String(error)]
    );
  }
}

export const investigationReadinessService: InvestigationReadinessService = {
  assess: assessInvestigationReadiness
};
