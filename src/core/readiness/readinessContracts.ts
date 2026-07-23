export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | ReadonlyJsonObject | readonly JsonValue[];

export interface ReadonlyJsonObject {
  readonly [key: string]: JsonValue | undefined;
}

export type InvestigationReadinessRequestVersion = "investigation-readiness-request-v1";
export type InvestigationReadinessResultVersion = "investigation-readiness-v1";
export type InvestigationReadinessErrorVersion = "investigation-readiness-error-v1";
export type InvestigationReadinessProfileVersion = "1.0";
export type InvestigationInputVersion = "investigation-input-v1";
export type UnderstandingBundleVersion = "understanding-bundle-v2";

export type InvestigationKind = "timeline" | "cross-environment-diff";

export type InvestigationReadinessPosture =
  | "Ready"
  | "Conditional"
  | "Limited"
  | "NotAssessable";

export type ContributorReadinessState =
  | "Available"
  | "Partial"
  | "PermissionLimited"
  | "Missing"
  | "NotConsulted"
  | "Unsupported"
  | "Stale";

export type ReadinessContributorRole =
  | "Primary"
  | "Required"
  | "Recommended"
  | "Optional";

export type EvidenceQualityDimension =
  | "Provenance"
  | "Coverage"
  | "Freshness"
  | "Scope"
  | "Repeatability"
  | "Consistency";

export type EvidenceQualityState =
  | "Sufficient"
  | "Limited"
  | "Unknown"
  | "NotApplicable";

export type InvestigationGapCategory =
  | "Coverage"
  | "Permission"
  | "Provenance"
  | "Freshness"
  | "Scope"
  | "Repeatability"
  | "Conflict"
  | "ContributorUnavailable";

export type InvestigationGapPriority = "High" | "Medium" | "Low";

export type ReadinessConfidenceEffect =
  | "Preserve"
  | "Qualify"
  | "Dampen"
  | "Withhold";

export type ConfidenceLevel = "High" | "Medium" | "Low" | "Unknown";

export interface InvestigationInputContractViewV1 extends ReadonlyJsonObject {
  readonly version: InvestigationInputVersion;
  readonly investigationId?: string;
  readonly kind: InvestigationKind;
  readonly subject: ReadonlyJsonObject;
  readonly provenance: ReadonlyJsonObject;
  readonly evidence: readonly ReadonlyJsonObject[];
  readonly contributors: readonly ReadonlyJsonObject[];
  readonly notes?: readonly string[];
  readonly intent?: ReadonlyJsonObject;
}

export interface UnderstandingBundleContractViewV2 extends ReadonlyJsonObject {
  readonly version: UnderstandingBundleVersion;
}

export interface InvestigationReadinessProfileReferenceV1 {
  readonly profileId: string;
  readonly version: InvestigationReadinessProfileVersion;
}

export interface InvestigationReadinessRequestV1 {
  readonly contractVersion: InvestigationReadinessRequestVersion;
  readonly investigationInput: InvestigationInputContractViewV1;
  readonly understandingBundle: UnderstandingBundleContractViewV2;
  readonly profile: InvestigationReadinessProfileReferenceV1;
  readonly assessmentUtc: string;
  readonly generatedUtc: string;
}

export interface EvidenceReferenceV1 {
  readonly id: string;
  readonly label: string;
  readonly source: string;
  readonly value?: string;
  readonly providerId?: string;
  readonly sourceArtifactId?: string;
  readonly environmentLabel?: string;
  readonly capturedUtc?: string;
}

export interface ContributorReadinessV1 {
  readonly contributorId: string;
  readonly sourceContributorIds: readonly string[];
  readonly role: ReadinessContributorRole;
  readonly state: ContributorReadinessState;
  readonly applicable: boolean;
  readonly explanation: string;
  readonly evidenceRefs: readonly EvidenceReferenceV1[];
  readonly limitations: readonly string[];
}

export interface EvidenceQualityDimensionV1 {
  readonly dimension: EvidenceQualityDimension;
  readonly state: EvidenceQualityState;
  readonly explanation: string;
  readonly ruleIds: readonly string[];
  readonly contributorIds: readonly string[];
  readonly evidenceRefs: readonly EvidenceReferenceV1[];
}

export interface InvestigationGapV1 {
  readonly id: string;
  readonly ruleId: string;
  readonly category: InvestigationGapCategory;
  readonly priority: InvestigationGapPriority;
  readonly title: string;
  readonly explanation: string;
  readonly contributorIds: readonly string[];
  readonly evidenceRefs: readonly EvidenceReferenceV1[];
  readonly recommendationIds: readonly string[];
  readonly limitations: readonly string[];
}

export interface EvidenceRecommendationV1 {
  readonly id: string;
  readonly ruleId: string;
  readonly priority: InvestigationGapPriority;
  readonly action: string;
  readonly reason: string;
  readonly gapIds: readonly string[];
  readonly evidenceRefs: readonly EvidenceReferenceV1[];
  readonly limitations: readonly string[];
}

export interface InvestigationReadinessResultV1 {
  readonly contractVersion: InvestigationReadinessResultVersion;
  readonly investigationId: string;
  readonly investigationKind: InvestigationKind;
  readonly profileId: string;
  readonly profileVersion: InvestigationReadinessProfileVersion;
  readonly posture: InvestigationReadinessPosture;
  readonly summary: string;
  readonly contributorStates: readonly ContributorReadinessV1[];
  readonly qualityDimensions: readonly EvidenceQualityDimensionV1[];
  readonly gaps: readonly InvestigationGapV1[];
  readonly recommendations: readonly EvidenceRecommendationV1[];
  readonly confidenceEffect: ReadinessConfidenceEffect;
  readonly baseSynthesizedConfidence: ConfidenceLevel;
  readonly effectiveSynthesizedConfidence: ConfidenceLevel;
  readonly confidenceLimitations: readonly string[];
  readonly evidenceRefs: readonly EvidenceReferenceV1[];
  readonly limitations: readonly string[];
  readonly inputFingerprint: string;
  readonly assessmentUtc: string;
  readonly generatedUtc: string;
}

export type InvestigationReadinessErrorCode =
  | "InvalidInput"
  | "UnsupportedInputVersion"
  | "UnsupportedProfileVersion"
  | "ContractViolation";

export interface InvestigationReadinessErrorV1 {
  readonly contractVersion: InvestigationReadinessErrorVersion;
  readonly code: InvestigationReadinessErrorCode;
  readonly message: string;
  readonly limitations: readonly string[];
}

export type InvestigationReadinessResponseV1 =
  | InvestigationReadinessResultV1
  | InvestigationReadinessErrorV1;

export function createReadinessError(
  code: InvestigationReadinessErrorCode,
  message: string,
  limitations: readonly string[] = []
): InvestigationReadinessErrorV1 {
  return {
    contractVersion: "investigation-readiness-error-v1",
    code,
    message,
    limitations: [...limitations]
  };
}
