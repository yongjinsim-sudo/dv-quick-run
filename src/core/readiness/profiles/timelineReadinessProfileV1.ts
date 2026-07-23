import { READINESS_GAP_RULE_IDS_V1 } from "../gaps/gapRuleRegistry.js";
import { READINESS_FRESHNESS_RULES_V1 } from "../readinessFreshnessRules.js";
import type { InvestigationReadinessProfileV1 } from "../readinessProfile.js";
import { READINESS_QUALITY_RULES_V1 } from "../readinessQualityRules.js";

export const TIMELINE_READINESS_PROFILE_V1: InvestigationReadinessProfileV1 = {
  profileId: "timeline-mini-rca-v1",
  version: "1.0",
  investigationKind: "timeline",
  contributorRules: [
    {
      contributorId: "timeline.reconstruction",
      role: "Primary",
      appliesWhen: { kind: "always" },
      absenceBehavior: "No qualifying evidence produces NotAssessable."
    },
    {
      contributorId: "timeline.understanding",
      role: "Required",
      appliesWhen: { kind: "always" },
      absenceBehavior: "Missing, PermissionLimited or Stale produces a High gap."
    },
    {
      contributorId: "timeline.trust",
      role: "Required",
      appliesWhen: { kind: "always" },
      absenceBehavior: "Missing or unresolved trust produces a High provenance or coverage gap."
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
      absenceBehavior: "A limitation is Medium by default and High only through an explicit profile rule."
    },
    {
      contributorId: "identity.evidence",
      role: "Recommended",
      appliesWhen: { kind: "intent-flag", flag: "identityParticipationInScope", equals: true },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "relationship.evidence",
      role: "Recommended",
      appliesWhen: { kind: "intent-flag", flag: "relationshipBehaviourInScope", equals: true },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "configuration.evidence",
      role: "Recommended",
      appliesWhen: { kind: "intent-flag", flag: "configurationInScope", equals: true },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "crossDiff.evidence",
      role: "Recommended",
      appliesWhen: { kind: "intent-flag", flag: "environmentDriftLinked", equals: true },
      absenceBehavior: "A material limitation is Medium."
    },
    {
      contributorId: "query.evidence",
      role: "Optional",
      appliesWhen: { kind: "intent-flag", flag: "runtimeConfirmationAttached", equals: true },
      absenceBehavior: "Absence alone produces no gap; incomplete attached evidence may produce a repeatability gap."
    },
    {
      contributorId: "metadata.evidence",
      role: "Optional",
      appliesWhen: {
        kind: "all",
        conditions: [
          { kind: "intent-flag", flag: "metadataContextAttached", equals: true },
          { kind: "intent-flag", flag: "metadataOwnedByAnotherContributor", equals: false }
        ]
      },
      absenceBehavior: "Absence alone produces no gap."
    }
  ],
  freshnessRules: READINESS_FRESHNESS_RULES_V1.filter((rule) =>
    rule.contributorIds.some((contributorId) =>
      [
        "timeline.reconstruction", "timeline.understanding", "timeline.trust", "audit.evidence",
        "query.evidence", "metadata.evidence", "configuration.evidence", "identity.evidence",
        "relationship.evidence", "crossDiff.evidence"
      ].includes(contributorId)
    )
  ),
  qualityRules: READINESS_QUALITY_RULES_V1,
  gapRuleIds: READINESS_GAP_RULE_IDS_V1
};
