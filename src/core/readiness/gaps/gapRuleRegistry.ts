import type { InvestigationGapRuleDescriptorV1 } from "../readinessProfile.js";

export const READINESS_GAP_RULES_V1: readonly InvestigationGapRuleDescriptorV1[] = [
  {
    ruleId: "GAP-COVERAGE-001",
    category: "Coverage",
    priority: "High",
    trigger: "No qualifying Primary evidence.",
    recommendationFamily: "Acquire canonical Primary evidence",
    conditionKind: "NoQualifyingPrimaryEvidence",
    sourceRoles: ["Primary"],
    sourceStates: ["Missing", "NotConsulted", "Unsupported"],
    expectedPostureCeiling: "NotAssessable"
  },
  {
    ruleId: "GAP-COVERAGE-002",
    category: "Coverage",
    priority: "High",
    trigger: "An applicable Required contributor is Missing.",
    recommendationFamily: "Acquire missing required evidence",
    conditionKind: "ContributorState",
    sourceRoles: ["Required"],
    sourceStates: ["Missing"],
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-COVERAGE-003",
    category: "Coverage",
    priority: "Medium",
    trigger: "An applicable Required contributor is Partial.",
    recommendationFamily: "Complete required evidence coverage",
    conditionKind: "ContributorState",
    sourceRoles: ["Required"],
    sourceStates: ["Partial"],
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-COVERAGE-004",
    category: "Coverage",
    priority: "Medium",
    trigger: "An applicable Recommended contributor is Missing, Partial or NotConsulted.",
    recommendationFamily: "Consult or complete recommended evidence",
    conditionKind: "ContributorState",
    sourceRoles: ["Recommended"],
    sourceStates: ["Missing", "Partial", "NotConsulted"],
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-PERMISSION-001",
    category: "Permission",
    priority: "High",
    trigger: "An applicable Required contributor is PermissionLimited.",
    recommendationFamily: "Retry through an authorised evidence-acquisition path",
    conditionKind: "ContributorState",
    sourceRoles: ["Required"],
    sourceStates: ["PermissionLimited"],
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-PERMISSION-002",
    category: "Permission",
    priority: "Medium",
    trigger: "An applicable Recommended contributor is PermissionLimited.",
    recommendationFamily: "Verify with authorised access where material",
    conditionKind: "ContributorState",
    sourceRoles: ["Recommended"],
    sourceStates: ["PermissionLimited"],
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-PROVENANCE-001",
    category: "Provenance",
    priority: "High",
    trigger: "Primary or Required evidence lacks material source, environment, provider or capture provenance.",
    recommendationFamily: "Re-capture or attach provenance-bearing evidence",
    conditionKind: "EvidenceQuality",
    sourceRoles: ["Primary", "Required"],
    sourceStates: ["Available", "Partial"],
    qualityDimension: "Provenance",
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-PROVENANCE-002",
    category: "Provenance",
    priority: "Medium",
    trigger: "Recommended evidence has incomplete provenance.",
    recommendationFamily: "Preserve missing provenance details",
    conditionKind: "EvidenceQuality",
    sourceRoles: ["Recommended"],
    sourceStates: ["Available", "Partial"],
    qualityDimension: "Provenance",
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-FRESHNESS-001",
    category: "Freshness",
    priority: "High",
    trigger: "Applicable Required evidence is Stale under an explicit rule.",
    recommendationFamily: "Refresh required evidence",
    conditionKind: "ContributorState",
    sourceRoles: ["Required"],
    sourceStates: ["Stale"],
    qualityDimension: "Freshness",
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-FRESHNESS-002",
    category: "Freshness",
    priority: "Medium",
    trigger: "Applicable Recommended evidence is Stale under an explicit rule.",
    recommendationFamily: "Refresh recommended evidence where material",
    conditionKind: "ContributorState",
    sourceRoles: ["Recommended"],
    sourceStates: ["Stale"],
    qualityDimension: "Freshness",
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-SCOPE-001",
    category: "Scope",
    priority: "High",
    trigger: "Subject, environment or source-target orientation materially mismatches the investigation.",
    recommendationFamily: "Align evidence with the investigated scope",
    conditionKind: "ScopeMismatch",
    sourceRoles: ["Primary", "Required"],
    sourceStates: ["Available", "Partial"],
    qualityDimension: "Scope",
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-SCOPE-002",
    category: "Scope",
    priority: "Medium",
    trigger: "Requested interval, provider or record scope is only partially covered.",
    recommendationFamily: "Extend or narrow evidence scope explicitly",
    conditionKind: "ScopeMismatch",
    sourceRoles: ["Required", "Recommended"],
    sourceStates: ["Partial"],
    qualityDimension: "Scope",
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-REPEATABILITY-001",
    category: "Repeatability",
    priority: "Medium",
    trigger: "Attached query or runtime evidence lacks material query shape, ordering, capture or artifact identity.",
    recommendationFamily: "Capture repeatable query and evidence context",
    conditionKind: "RepeatabilityLimited",
    sourceRoles: ["Optional"],
    sourceStates: ["Partial"],
    qualityDimension: "Repeatability",
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-REPEATABILITY-002",
    category: "Repeatability",
    priority: "Low",
    trigger: "Optional reproduction context is incomplete.",
    recommendationFamily: "Preserve additional handoff context",
    conditionKind: "RepeatabilityLimited",
    sourceRoles: ["Optional"],
    sourceStates: ["Partial"],
    qualityDimension: "Repeatability",
    expectedPostureCeiling: "Ready"
  },
  {
    ruleId: "GAP-CONFLICT-001",
    category: "Conflict",
    priority: "High",
    trigger: "Canonical sources materially conflict and the conflict limits synthesis.",
    recommendationFamily: "Verify competing evidence sources",
    conditionKind: "EvidenceConflict",
    sourceRoles: ["Primary", "Required"],
    sourceStates: ["Available", "Partial"],
    qualityDimension: "Consistency",
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-CONFLICT-002",
    category: "Conflict",
    priority: "Medium",
    trigger: "Canonical sources contain a non-dominant unresolved inconsistency.",
    recommendationFamily: "Review the inconsistency before increasing confidence",
    conditionKind: "EvidenceConflict",
    sourceRoles: ["Recommended"],
    sourceStates: ["Available", "Partial"],
    qualityDimension: "Consistency",
    expectedPostureCeiling: "Conditional"
  },
  {
    ruleId: "GAP-CONTRIBUTOR-001",
    category: "ContributorUnavailable",
    priority: "High",
    trigger: "An applicable Required contributor is Unsupported.",
    recommendationFamily: "Record unsupported capability and seek alternative evidence",
    conditionKind: "ContributorState",
    sourceRoles: ["Required"],
    sourceStates: ["Unsupported"],
    expectedPostureCeiling: "Limited"
  },
  {
    ruleId: "GAP-CONTRIBUTOR-002",
    category: "ContributorUnavailable",
    priority: "Low",
    trigger: "An Optional contributor is Unsupported or NotConsulted and the profile explicitly enables transparency.",
    recommendationFamily: "Optional review only",
    conditionKind: "ContributorState",
    sourceRoles: ["Optional"],
    sourceStates: ["Unsupported", "NotConsulted"],
    expectedPostureCeiling: "Ready"
  }
];

export const READINESS_GAP_RULE_IDS_V1: readonly string[] = READINESS_GAP_RULES_V1.map((rule) => rule.ruleId);

export function getReadinessGapRuleV1(ruleId: string): InvestigationGapRuleDescriptorV1 | undefined {
  return READINESS_GAP_RULES_V1.find((rule) => rule.ruleId === ruleId);
}
