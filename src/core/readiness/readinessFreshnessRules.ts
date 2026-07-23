import type { ReadinessFreshnessRuleV1 } from "./readinessProfile.js";

export const READINESS_FRESHNESS_RULES_V1: readonly ReadinessFreshnessRuleV1[] = [
  {
    ruleId: "FRESHNESS-TIMELINE-RECONSTRUCTION-001",
    evidenceFamily: "Timeline Reconstruction",
    contributorIds: ["timeline.reconstruction"],
    owner: "Profile",
    evaluation: "Historical age alone never makes the timeline stale; assess requested-window coverage and artifact provenance.",
    withoutExplicitThreshold: "NotApplicable"
  },
  {
    ruleId: "FRESHNESS-TIMELINE-DERIVED-001",
    evidenceFamily: "Timeline Understanding and Trust",
    contributorIds: ["timeline.understanding", "timeline.trust", "timeline.evidence"],
    owner: "Profile",
    evaluation: "Derived evidence must correspond to the current Timeline Reconstruction input fingerprint.",
    withoutExplicitThreshold: "Unknown"
  },
  {
    ruleId: "FRESHNESS-CROSS-DIFF-SNAPSHOTS-001",
    evidenceFamily: "Cross-Diff source and target snapshots",
    contributorIds: ["crossDiff.sourceSnapshot", "crossDiff.targetSnapshot", "crossDiff.evidence"],
    owner: "Profile",
    evaluation: "Preserve source-target orientation and evaluate only an explicit comparison-context freshness constraint; otherwise assess relative alignment and provenance.",
    withoutExplicitThreshold: "Unknown"
  },
  {
    ruleId: "FRESHNESS-PROVIDER-FINDINGS-001",
    evidenceFamily: "Provider findings",
    contributorIds: ["crossDiff.providerFindings"],
    owner: "Provider",
    evaluation: "Findings must correspond to the current comparison or Timeline input fingerprint.",
    withoutExplicitThreshold: "Unknown"
  },
  {
    ruleId: "FRESHNESS-AUDIT-001",
    evidenceFamily: "Audit Evidence",
    contributorIds: ["audit.evidence"],
    owner: "Profile",
    evaluation: "Assess coverage of the requested audit interval and retrieval provenance; event age alone is not staleness.",
    withoutExplicitThreshold: "Unknown"
  },
  {
    ruleId: "FRESHNESS-QUERY-001",
    evidenceFamily: "Runtime query result",
    contributorIds: ["query.evidence"],
    owner: "ProviderOrProfile",
    evaluation: "Use an explicit validity window when supplied; otherwise freshness is Unknown.",
    withoutExplicitThreshold: "Unknown"
  },
  {
    ruleId: "FRESHNESS-DOMAIN-EVIDENCE-001",
    evidenceFamily: "Metadata, configuration, identity and relationship evidence",
    contributorIds: ["metadata.evidence", "configuration.evidence", "identity.evidence", "relationship.evidence"],
    owner: "ProviderOrProfile",
    evaluation: "Use provider-supplied intrinsic validity or an explicit profile threshold; otherwise freshness is Unknown.",
    withoutExplicitThreshold: "Unknown"
  }
];
