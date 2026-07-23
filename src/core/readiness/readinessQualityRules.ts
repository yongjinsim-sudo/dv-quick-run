import type { ReadinessQualityRuleV1 } from "./readinessProfile.js";

export const READINESS_QUALITY_RULES_V1: readonly ReadinessQualityRuleV1[] = [
  {
    ruleId: "QUALITY-PROVENANCE-001",
    dimension: "Provenance",
    defaultState: "Unknown",
    explanation: "Assess whether evidence preserves provider, subject, environment, capture time and source-artifact provenance."
  },
  {
    ruleId: "QUALITY-COVERAGE-001",
    dimension: "Coverage",
    defaultState: "Unknown",
    explanation: "Assess whether evidence covers the expected contributors, records, intervals and comparison scope."
  },
  {
    ruleId: "QUALITY-FRESHNESS-001",
    dimension: "Freshness",
    defaultState: "Unknown",
    explanation: "Assess freshness only through provider-owned validity or an explicit profile rule relative to assessmentUtc."
  },
  {
    ruleId: "QUALITY-SCOPE-001",
    dimension: "Scope",
    defaultState: "Unknown",
    explanation: "Assess alignment with the investigated subject, environment, interval and source-target orientation."
  },
  {
    ruleId: "QUALITY-REPEATABILITY-001",
    dimension: "Repeatability",
    defaultState: "Unknown",
    explanation: "Assess whether preserved query shape, ordering, snapshot identity and artifact provenance support repeatable review."
  },
  {
    ruleId: "QUALITY-CONSISTENCY-001",
    dimension: "Consistency",
    defaultState: "Unknown",
    explanation: "Assess whether canonical evidence agrees, conflicts or remains incomparable without choosing a source as truth."
  }
];
