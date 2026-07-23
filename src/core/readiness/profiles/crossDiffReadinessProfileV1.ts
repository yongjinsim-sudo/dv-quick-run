import { READINESS_GAP_RULE_IDS_V1 } from "../gaps/gapRuleRegistry.js";
import { READINESS_FRESHNESS_RULES_V1 } from "../readinessFreshnessRules.js";
import type { InvestigationReadinessProfileV1 } from "../readinessProfile.js";
import { READINESS_QUALITY_RULES_V1 } from "../readinessQualityRules.js";

export const CROSS_DIFF_READINESS_PROFILE_V1: InvestigationReadinessProfileV1 = {
  profileId: "cross-diff-mini-rca-v1",
  version: "1.0",
  investigationKind: "cross-environment-diff",
  contributorRules: [
    {
      contributorId: "crossDiff.comparison",
      role: "Primary",
      appliesWhen: { kind: "always" },
      absenceBehavior: "No qualifying comparison produces NotAssessable."
    },
    {
      contributorId: "crossDiff.sourceSnapshot",
      role: "Required",
      appliesWhen: { kind: "always" },
      absenceBehavior: "Missing, PermissionLimited or Stale produces a High gap."
    },
    {
      contributorId: "crossDiff.targetSnapshot",
      role: "Required",
      appliesWhen: { kind: "always" },
      absenceBehavior: "Missing, PermissionLimited or Stale produces a High gap."
    },
    {
      contributorId: "crossDiff.providerFindings",
      role: "Required",
      appliesWhen: { kind: "always" },
      absenceBehavior: "Missing or provenance-limited findings produce a High gap."
    },
    {
      contributorId: "relationship.evidence",
      role: "Recommended",
      appliesWhen: { kind: "finding-family", families: ["relationship"], mode: "any" },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "metadata.evidence",
      role: "Recommended",
      appliesWhen: { kind: "finding-family", families: ["metadata"], mode: "any" },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "configuration.evidence",
      role: "Recommended",
      appliesWhen: { kind: "finding-family", families: ["configuration"], mode: "any" },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "identity.evidence",
      role: "Recommended",
      appliesWhen: { kind: "finding-family", families: ["identity"], mode: "any" },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "audit.evidence",
      role: "Recommended",
      appliesWhen: {
        kind: "any",
        conditions: [
          { kind: "intent-flag", flag: "auditRequested", equals: true },
          { kind: "intent-flag", flag: "actorOrChangeTimeRequested", equals: true }
        ]
      },
      absenceBehavior: "A limitation is Medium by default."
    },
    {
      contributorId: "timeline.evidence",
      role: "Recommended",
      appliesWhen: { kind: "intent-flag", flag: "temporalProgressionRequested", equals: true },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "query.evidence",
      role: "Optional",
      appliesWhen: { kind: "intent-flag", flag: "runtimeConfirmationAttached", equals: true },
      absenceBehavior: "Absence alone produces no gap."
    }
  ],
  freshnessRules: READINESS_FRESHNESS_RULES_V1.filter((rule) =>
    rule.contributorIds.some((contributorId) =>
      [
        "crossDiff.comparison", "crossDiff.sourceSnapshot", "crossDiff.targetSnapshot",
        "crossDiff.providerFindings", "relationship.evidence", "metadata.evidence",
        "configuration.evidence", "identity.evidence", "audit.evidence", "timeline.evidence",
        "query.evidence"
      ].includes(contributorId)
    )
  ),
  qualityRules: READINESS_QUALITY_RULES_V1,
  gapRuleIds: READINESS_GAP_RULE_IDS_V1
};
