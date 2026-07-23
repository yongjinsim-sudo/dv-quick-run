import type {
  ContributorReadinessState,
  ContributorReadinessV1,
  EvidenceQualityDimension,
  EvidenceQualityState,
  EvidenceReferenceV1,
  InvestigationReadinessRequestV1,
  ReadonlyJsonObject
} from "./readinessContracts.js";
import { buildReadinessConditionContext, evaluateReadinessCondition } from "./readinessConditionEvaluator.js";
import type { InvestigationReadinessProfileV1, ReadinessContributorRuleV1 } from "./readinessProfile.js";
import {
  isJsonObject,
  ordinalCompare,
  readBoolean,
  readContributorState,
  readQualityState,
  readString,
  readStringArray,
  uniqueSorted
} from "./readinessValueAccess.js";

const QUALITY_DIMENSIONS: readonly EvidenceQualityDimension[] = [
  "Provenance", "Coverage", "Freshness", "Scope", "Repeatability", "Consistency"
];

export interface NormalizedReadinessContributorV1 extends ContributorReadinessV1 {
  readonly qualityStates: Readonly<Partial<Record<EvidenceQualityDimension, EvidenceQualityState>>>;
  readonly freshnessRuleId?: string;
  readonly explicitFreshnessRule: boolean;
}

function inputEvidenceById(request: InvestigationReadinessRequestV1): Map<string, ReadonlyJsonObject> {
  const evidenceById = new Map<string, ReadonlyJsonObject>();
  for (const evidence of request.investigationInput.evidence) {
    if (!isJsonObject(evidence)) {
      continue;
    }
    const id = readString(evidence.id);
    if (id && !evidenceById.has(id)) {
      evidenceById.set(id, evidence);
    }
  }
  return evidenceById;
}

function environmentLabel(request: InvestigationReadinessRequestV1): string | undefined {
  const subject = request.investigationInput.subject;
  return readString(subject.environmentLabel)
    ?? readString(subject.sourceEnvironmentLabel)
    ?? readString(subject.targetEnvironmentLabel);
}

function referenceFromObject(
  value: ReadonlyJsonObject,
  fallbackId: string,
  fallbackSource: string,
  request: InvestigationReadinessRequestV1
): EvidenceReferenceV1 {
  const optionalValue = readString(value.value);
  const providerId = readString(value.providerId);
  const sourceArtifactId = readString(value.sourceArtifactId) ?? readString(request.investigationInput.provenance.sourceArtifactId);
  const referenceEnvironmentLabel = readString(value.environmentLabel) ?? environmentLabel(request);
  const capturedUtc = readString(value.capturedUtc) ?? readString(value.generatedAtIso);
  return {
    id: readString(value.id) ?? fallbackId,
    label: readString(value.label) ?? readString(value.title) ?? fallbackId,
    source: readString(value.source) ?? readString(value.providerTitle) ?? fallbackSource,
    ...(optionalValue ? { value: optionalValue } : {}),
    ...(providerId ? { providerId } : {}),
    ...(sourceArtifactId ? { sourceArtifactId } : {}),
    ...(referenceEnvironmentLabel ? { environmentLabel: referenceEnvironmentLabel } : {}),
    ...(capturedUtc ? { capturedUtc } : {})
  };
}

function normalizeEvidenceReferences(
  contributor: ReadonlyJsonObject,
  request: InvestigationReadinessRequestV1,
  evidenceById: ReadonlyMap<string, ReadonlyJsonObject>
): EvidenceReferenceV1[] {
  const contributorId = readString(contributor.id) ?? "unknown-contributor";
  const rawReferences = Array.isArray(contributor.evidenceRefs) ? contributor.evidenceRefs : [];
  const byId = new Map<string, EvidenceReferenceV1>();
  for (const rawReference of rawReferences) {
    let reference: EvidenceReferenceV1 | undefined;
    if (typeof rawReference === "string" && rawReference.trim().length > 0) {
      const evidence = evidenceById.get(rawReference);
      reference = evidence
        ? referenceFromObject(evidence, rawReference, contributorId, request)
        : (() => {
          const sourceArtifactId = readString(request.investigationInput.provenance.sourceArtifactId);
          const referenceEnvironmentLabel = environmentLabel(request);
          return {
          id: rawReference,
          label: rawReference,
          source: contributorId,
          value: rawReference,
            ...(sourceArtifactId ? { sourceArtifactId } : {}),
            ...(referenceEnvironmentLabel ? { environmentLabel: referenceEnvironmentLabel } : {})
          };
        })();
    } else if (isJsonObject(rawReference)) {
      const fallbackId = readString(rawReference.value) ?? `${contributorId}:evidence`;
      reference = referenceFromObject(rawReference, fallbackId, contributorId, request);
    }
    if (reference && !byId.has(reference.id)) {
      byId.set(reference.id, reference);
    }
  }
  return [...byId.values()].sort((left, right) => ordinalCompare(left.id, right.id));
}

function explicitStaleState(
  contributor: ReadonlyJsonObject,
  request: InvestigationReadinessRequestV1
): { readonly stale: boolean; readonly ruleId?: string; readonly explicit: boolean } {
  const ruleId = readString(contributor.freshnessRuleId);
  const validUntilUtc = readString(contributor.validUntilUtc);
  const sourceInputIdentity = readString(contributor.sourceInputIdentity);
  const expectedInputIdentity = readString(request.understandingBundle.sourceInputIdentity);
  const assessmentTime = Date.parse(request.assessmentUtc);
  const validityTime = validUntilUtc ? Date.parse(validUntilUtc) : Number.NaN;
  const expired = Boolean(validUntilUtc) && Number.isFinite(validityTime) && validityTime < assessmentTime;
  const mismatchedInput = Boolean(sourceInputIdentity && expectedInputIdentity && sourceInputIdentity !== expectedInputIdentity);
  return {
    stale: readContributorState(contributor.state) === "Stale" ? Boolean(ruleId || expired || mismatchedInput) : expired || mismatchedInput,
    ruleId: ruleId ?? (expired ? "provider-valid-until" : mismatchedInput ? "source-input-identity" : undefined),
    explicit: Boolean(ruleId || validUntilUtc || sourceInputIdentity)
  };
}

function normalizedKnownState(
  contributor: ReadonlyJsonObject | undefined,
  applicable: boolean,
  evidenceRefs: readonly EvidenceReferenceV1[],
  request: InvestigationReadinessRequestV1
): { readonly state: ContributorReadinessState; readonly freshnessRuleId?: string; readonly explicitFreshnessRule: boolean; readonly limitations: string[] } {
  if (!contributor) {
    return {
      state: "NotConsulted",
      explicitFreshnessRule: false,
      limitations: applicable ? ["The applicable contributor was not supplied or consulted."] : []
    };
  }

  const suppliedState = readContributorState(contributor.state) ?? "Unsupported";
  const freshness = explicitStaleState(contributor, request);
  const limitations = readStringArray(contributor.limitations);
  if (freshness.stale) {
    return { state: "Stale", freshnessRuleId: freshness.ruleId, explicitFreshnessRule: true, limitations };
  }
  if (suppliedState === "Stale") {
    return {
      state: evidenceRefs.length > 0 ? "Available" : "Partial",
      explicitFreshnessRule: false,
      limitations: [...limitations, "A Stale state was not applied because no explicit freshness rule or provider validity was supplied."]
    };
  }
  if (suppliedState === "Available" && evidenceRefs.length === 0) {
    return {
      state: "Partial",
      explicitFreshnessRule: freshness.explicit,
      limitations: [...limitations, "Available was reduced to Partial because no qualifying evidence reference was supplied."]
    };
  }
  return { state: suppliedState, freshnessRuleId: freshness.ruleId, explicitFreshnessRule: freshness.explicit, limitations };
}

function qualityStates(contributor: ReadonlyJsonObject | undefined): Partial<Record<EvidenceQualityDimension, EvidenceQualityState>> {
  if (!contributor) {
    return {};
  }
  const states = Object.fromEntries(
    QUALITY_DIMENSIONS
      .map((dimension) => [dimension, readQualityState(contributor, dimension)] as const)
      .filter((entry): entry is readonly [EvidenceQualityDimension, EvidenceQualityState] => Boolean(entry[1]))
  ) as Partial<Record<EvidenceQualityDimension, EvidenceQualityState>>;
  if (readBoolean(contributor.conflict) === true) {
    states.Consistency = "Limited";
  }
  if (readBoolean(contributor.scopeMismatch) === true) {
    states.Scope = "Limited";
  }
  if (readBoolean(contributor.repeatabilityLimited) === true) {
    states.Repeatability = "Limited";
  }
  return states;
}

function explanationFor(
  rule: ReadinessContributorRuleV1,
  state: ContributorReadinessState,
  applicable: boolean
): string {
  if (!applicable) {
    return `${rule.contributorId} is not applicable to the structured investigation intent.`;
  }
  switch (state) {
    case "Available": return `${rule.contributorId} supplied qualifying evidence.`;
    case "Partial": return `${rule.contributorId} supplied incomplete qualifying evidence.`;
    case "PermissionLimited": return `${rule.contributorId} was relevant, but access constraints limited evidence retrieval.`;
    case "Missing": return `${rule.contributorId} was expected, but no qualifying evidence was supplied.`;
    case "NotConsulted": return `${rule.contributorId} was not consulted for this investigation.`;
    case "Unsupported": return `${rule.contributorId} is not supported by the supplied input or capability context.`;
    case "Stale": return `${rule.contributorId} evidence is outside an explicit freshness or input-validity rule.`;
  }
}

export function normalizeReadinessContributors(
  request: InvestigationReadinessRequestV1,
  profile: InvestigationReadinessProfileV1
): NormalizedReadinessContributorV1[] {
  const rawContributors = request.investigationInput.contributors.filter(isJsonObject);
  const rawById = new Map<string, ReadonlyJsonObject>();
  for (const contributor of rawContributors) {
    const id = readString(contributor.id);
    if (id && !rawById.has(id)) {
      rawById.set(id, contributor);
    }
  }
  const evidenceById = inputEvidenceById(request);
  const conditionContext = buildReadinessConditionContext(request.investigationInput);
  const normalized = profile.contributorRules.map((rule): NormalizedReadinessContributorV1 => {
    const raw = rawById.get(rule.contributorId);
    const applicable = evaluateReadinessCondition(rule.appliesWhen, conditionContext);
    const evidenceRefs = raw ? normalizeEvidenceReferences(raw, request, evidenceById) : [];
    const stateResult = normalizedKnownState(raw, applicable, evidenceRefs, request);
    return {
      contributorId: rule.contributorId,
      sourceContributorIds: uniqueSorted(raw ? [readString(raw.id) ?? rule.contributorId, ...readStringArray(raw.sourceContributorIds)] : []),
      role: rule.role,
      state: stateResult.state,
      applicable,
      explanation: explanationFor(rule, stateResult.state, applicable),
      evidenceRefs,
      limitations: uniqueSorted(stateResult.limitations),
      qualityStates: qualityStates(raw),
      freshnessRuleId: stateResult.freshnessRuleId,
      explicitFreshnessRule: stateResult.explicitFreshnessRule
    };
  });

  const knownIds = new Set(profile.contributorRules.map((rule) => rule.contributorId));
  const unknown = rawContributors
    .filter((raw) => {
      const id = readString(raw.id);
      return Boolean(id && !knownIds.has(id));
    })
    .sort((left, right) => ordinalCompare(readString(left.id) ?? "", readString(right.id) ?? ""))
    .map((raw): NormalizedReadinessContributorV1 => {
      const id = readString(raw.id) ?? "unknown-contributor";
      return {
        contributorId: id,
        sourceContributorIds: uniqueSorted([id, ...readStringArray(raw.sourceContributorIds)]),
        role: "Optional",
        state: "Unsupported",
        applicable: false,
        explanation: `${id} is preserved as an unmapped contributor and cannot acquire a profile role.`,
        evidenceRefs: normalizeEvidenceReferences(raw, request, evidenceById),
        limitations: uniqueSorted(["Unknown contributor ID; no readiness role or semantics were inferred.", ...readStringArray(raw.limitations)]),
        qualityStates: qualityStates(raw),
        explicitFreshnessRule: false
      };
    });

  return [...normalized, ...unknown];
}
