import type {
  ContributorReadinessState,
  EvidenceQualityDimension,
  EvidenceQualityState,
  InvestigationGapCategory,
  InvestigationGapPriority,
  InvestigationKind,
  InvestigationReadinessProfileVersion,
  ReadinessContributorRole
} from "./readinessContracts.js";

export type InvestigationIntentFlagV1 =
  | "auditRequested"
  | "actorOrChangeTimeRequested"
  | "identityParticipationInScope"
  | "relationshipBehaviourInScope"
  | "configurationInScope"
  | "environmentDriftLinked"
  | "temporalProgressionRequested"
  | "runtimeConfirmationAttached"
  | "metadataContextAttached"
  | "metadataOwnedByAnotherContributor";

export type InvestigationFindingFamilyV1 =
  | "relationship"
  | "metadata"
  | "configuration"
  | "identity";

export type DeterministicConditionV1 =
  | { readonly kind: "always" }
  | { readonly kind: "intent-flag"; readonly flag: InvestigationIntentFlagV1; readonly equals: boolean }
  | { readonly kind: "finding-family"; readonly families: readonly InvestigationFindingFamilyV1[]; readonly mode: "any" }
  | { readonly kind: "any"; readonly conditions: readonly DeterministicConditionV1[] }
  | { readonly kind: "all"; readonly conditions: readonly DeterministicConditionV1[] };

export interface ReadinessContributorRuleV1 {
  readonly contributorId: string;
  readonly role: ReadinessContributorRole;
  readonly appliesWhen: DeterministicConditionV1;
  readonly absenceBehavior: string;
}

export type ReadinessFreshnessOwnerV1 = "Provider" | "Profile" | "ProviderOrProfile";

export interface ReadinessFreshnessRuleV1 {
  readonly ruleId: string;
  readonly evidenceFamily: string;
  readonly contributorIds: readonly string[];
  readonly owner: ReadinessFreshnessOwnerV1;
  readonly evaluation: string;
  readonly withoutExplicitThreshold: "Unknown" | "NotApplicable";
}

export interface ReadinessQualityRuleV1 {
  readonly ruleId: string;
  readonly dimension: EvidenceQualityDimension;
  readonly defaultState: EvidenceQualityState;
  readonly explanation: string;
}

export interface InvestigationReadinessProfileV1 {
  readonly profileId: string;
  readonly version: InvestigationReadinessProfileVersion;
  readonly investigationKind: InvestigationKind;
  readonly contributorRules: readonly ReadinessContributorRuleV1[];
  readonly freshnessRules: readonly ReadinessFreshnessRuleV1[];
  readonly qualityRules: readonly ReadinessQualityRuleV1[];
  readonly gapRuleIds: readonly string[];
}

export interface InvestigationGapRuleDescriptorV1 {
  readonly ruleId: string;
  readonly category: InvestigationGapCategory;
  readonly priority: InvestigationGapPriority;
  readonly trigger: string;
  readonly recommendationFamily: string;
  readonly conditionKind:
    | "NoQualifyingPrimaryEvidence"
    | "ContributorState"
    | "EvidenceQuality"
    | "ScopeMismatch"
    | "RepeatabilityLimited"
    | "EvidenceConflict";
  readonly sourceRoles: readonly ReadinessContributorRole[];
  readonly sourceStates: readonly ContributorReadinessState[];
  readonly qualityDimension?: EvidenceQualityDimension;
  readonly expectedPostureCeiling: "Ready" | "Conditional" | "Limited" | "NotAssessable";
}
