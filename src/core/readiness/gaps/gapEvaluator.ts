import type {
  EvidenceReferenceV1,
  InvestigationGapV1,
  InvestigationReadinessRequestV1
} from "../readinessContracts.js";
import type { NormalizedReadinessContributorV1 } from "../contributorStateNormalizer.js";
import type { InvestigationGapRuleDescriptorV1, InvestigationReadinessProfileV1 } from "../readinessProfile.js";
import { ordinalCompare, uniqueSorted } from "../readinessValueAccess.js";
import { READINESS_GAP_RULES_V1 } from "./gapRuleRegistry.js";
import { buildReadinessGapId } from "./gapIdentity.js";
import { orderReadinessGaps } from "./gapOrdering.js";

interface GapMatch {
  readonly rule: InvestigationGapRuleDescriptorV1;
  readonly contributor: NormalizedReadinessContributorV1;
}

function qualifyingPrimary(contributor: NormalizedReadinessContributorV1): boolean {
  return contributor.applicable
    && contributor.role === "Primary"
    && ["Available", "Partial"].includes(contributor.state)
    && contributor.evidenceRefs.length > 0;
}

function registryFor(profile: InvestigationReadinessProfileV1): Map<string, InvestigationGapRuleDescriptorV1> {
  const enabled = new Set(profile.gapRuleIds);
  return new Map(READINESS_GAP_RULES_V1.filter((rule) => enabled.has(rule.ruleId)).map((rule) => [rule.ruleId, rule]));
}

function addMatch(
  matches: GapMatch[],
  registry: ReadonlyMap<string, InvestigationGapRuleDescriptorV1>,
  ruleId: string,
  contributor: NormalizedReadinessContributorV1
): void {
  const rule = registry.get(ruleId);
  if (rule) {
    matches.push({ rule, contributor });
  }
}

function contributorMatches(
  contributor: NormalizedReadinessContributorV1,
  registry: ReadonlyMap<string, InvestigationGapRuleDescriptorV1>
): GapMatch[] {
  if (!contributor.applicable) {
    return [];
  }

  const matches: GapMatch[] = [];
  if (contributor.state === "PermissionLimited") {
    if (contributor.role === "Required") {addMatch(matches, registry, "GAP-PERMISSION-001", contributor);}
    if (contributor.role === "Recommended") {addMatch(matches, registry, "GAP-PERMISSION-002", contributor);}
  }
  if (contributor.state === "Stale") {
    if (contributor.role === "Required") {addMatch(matches, registry, "GAP-FRESHNESS-001", contributor);}
    if (contributor.role === "Recommended") {addMatch(matches, registry, "GAP-FRESHNESS-002", contributor);}
  }
  if (contributor.qualityStates.Provenance === "Limited") {
    if (["Primary", "Required"].includes(contributor.role)) {addMatch(matches, registry, "GAP-PROVENANCE-001", contributor);}
    if (contributor.role === "Recommended") {addMatch(matches, registry, "GAP-PROVENANCE-002", contributor);}
  }
  if (contributor.qualityStates.Scope === "Limited") {
    if (["Primary", "Required"].includes(contributor.role)) {addMatch(matches, registry, "GAP-SCOPE-001", contributor);}
    if (["Required", "Recommended"].includes(contributor.role) && contributor.state === "Partial") {
      addMatch(matches, registry, "GAP-SCOPE-002", contributor);
    }
  }
  if (contributor.qualityStates.Consistency === "Limited") {
    if (["Primary", "Required"].includes(contributor.role)) {addMatch(matches, registry, "GAP-CONFLICT-001", contributor);}
    if (contributor.role === "Recommended") {addMatch(matches, registry, "GAP-CONFLICT-002", contributor);}
  }
  if (contributor.role === "Optional" && (contributor.state === "Partial" || contributor.qualityStates.Repeatability === "Limited")) {
    addMatch(matches, registry, contributor.contributorId === "query.evidence" ? "GAP-REPEATABILITY-001" : "GAP-REPEATABILITY-002", contributor);
  }

  if (matches.length > 0) {
    return matches;
  }
  if (contributor.role === "Required" && ["Missing", "NotConsulted"].includes(contributor.state)) {
    addMatch(matches, registry, "GAP-COVERAGE-002", contributor);
  } else if (contributor.role === "Required" && contributor.state === "Partial") {
    addMatch(matches, registry, "GAP-COVERAGE-003", contributor);
  } else if (contributor.role === "Recommended" && ["Missing", "Partial", "NotConsulted"].includes(contributor.state)) {
    addMatch(matches, registry, "GAP-COVERAGE-004", contributor);
  } else if (contributor.role === "Required" && contributor.state === "Unsupported") {
    addMatch(matches, registry, "GAP-CONTRIBUTOR-001", contributor);
  } else if (contributor.role === "Optional" && ["Unsupported", "NotConsulted"].includes(contributor.state)) {
    addMatch(matches, registry, "GAP-CONTRIBUTOR-002", contributor);
  }
  return matches;
}

function mergeEvidenceReferences(contributors: readonly NormalizedReadinessContributorV1[]): EvidenceReferenceV1[] {
  const byId = new Map<string, EvidenceReferenceV1>();
  for (const reference of contributors.flatMap((contributor) => contributor.evidenceRefs)) {
    if (!byId.has(reference.id)) {
      byId.set(reference.id, reference);
    }
  }
  return [...byId.values()].sort((left, right) => ordinalCompare(left.id, right.id));
}

function buildGap(
  request: InvestigationReadinessRequestV1,
  rule: InvestigationGapRuleDescriptorV1,
  contributors: readonly NormalizedReadinessContributorV1[]
): InvestigationGapV1 {
  const contributorIds = uniqueSorted(contributors.map((contributor) => contributor.contributorId));
  return {
    id: buildReadinessGapId(request.investigationInput.subject, rule.ruleId, contributorIds),
    ruleId: rule.ruleId,
    category: rule.category,
    priority: rule.priority,
    title: `${rule.category} evidence gap`,
    explanation: `${rule.trigger} Affected contributors: ${contributorIds.join(", ")}.`,
    contributorIds,
    evidenceRefs: mergeEvidenceReferences(contributors),
    recommendationIds: [],
    limitations: uniqueSorted(contributors.flatMap((contributor) => contributor.limitations))
  };
}

export function evaluateReadinessGaps(
  request: InvestigationReadinessRequestV1,
  profile: InvestigationReadinessProfileV1,
  contributors: readonly NormalizedReadinessContributorV1[]
): InvestigationGapV1[] {
  const registry = registryFor(profile);
  const primary = contributors.filter((contributor) => contributor.role === "Primary" && contributor.applicable);
  if (!primary.some(qualifyingPrimary)) {
    const rule = registry.get("GAP-COVERAGE-001");
    return rule ? [buildGap(request, rule, primary)] : [];
  }

  const matches = contributors.flatMap((contributor) => contributorMatches(contributor, registry));
  const byRule = new Map<string, { rule: InvestigationGapRuleDescriptorV1; contributors: NormalizedReadinessContributorV1[] }>();
  for (const match of matches) {
    const existing = byRule.get(match.rule.ruleId);
    if (existing) {
      if (!existing.contributors.some((contributor) => contributor.contributorId === match.contributor.contributorId)) {
        existing.contributors.push(match.contributor);
      }
    } else {
      byRule.set(match.rule.ruleId, { rule: match.rule, contributors: [match.contributor] });
    }
  }

  return orderReadinessGaps([...byRule.values()].map((entry) =>
    buildGap(request, entry.rule, entry.contributors.sort((left, right) => ordinalCompare(left.contributorId, right.contributorId)))
  ));
}
