import type {
  EvidenceRecommendationV1,
  InvestigationGapV1
} from "../readiness/readinessContracts.js";
import { READINESS_GAP_RULES_V1 } from "../readiness/gaps/gapRuleRegistry.js";
import { readinessGapCategoryRank, readinessGapPriorityRank } from "../readiness/gaps/gapOrdering.js";
import { ordinalCompare, uniqueSorted } from "../readiness/readinessValueAccess.js";
import { buildStableRecommendationId, dedupeAndRankRecommendations } from "./recommendationEngine.js";

interface RankedReadinessRecommendation extends EvidenceRecommendationV1 {
  readonly rank: number;
}

export interface ReadinessRecommendationResultV1 {
  readonly gaps: InvestigationGapV1[];
  readonly recommendations: EvidenceRecommendationV1[];
}

export function buildReadinessRecommendations(
  gaps: readonly InvestigationGapV1[]
): ReadinessRecommendationResultV1 {
  const registry = new Map(READINESS_GAP_RULES_V1.map((rule) => [rule.ruleId, rule]));
  const ranked: RankedReadinessRecommendation[] = gaps.flatMap((gap) => {
    const rule = registry.get(gap.ruleId);
    if (!rule) {
      return [];
    }
    return [{
      id: buildStableRecommendationId("readiness-recommendation", rule.ruleId, gap.contributorIds.join("|")),
      ruleId: rule.ruleId,
      priority: rule.priority,
      action: rule.recommendationFamily,
      reason: gap.explanation,
      gapIds: [gap.id],
      evidenceRefs: [...gap.evidenceRefs],
      limitations: ["Evidence guidance only; no Dataverse action is executed."],
      rank: readinessGapPriorityRank(rule.priority) * 100 + readinessGapCategoryRank(rule.category)
    }];
  });

  const recommendations = dedupeAndRankRecommendations(ranked).map(({ rank: _rank, ...recommendation }) => recommendation);
  const recommendationIdsByGap = new Map<string, string[]>();
  for (const recommendation of recommendations) {
    for (const gapId of recommendation.gapIds) {
      const ids = recommendationIdsByGap.get(gapId) ?? [];
      ids.push(recommendation.id);
      recommendationIdsByGap.set(gapId, ids);
    }
  }
  const linkedGaps = gaps.map((gap) => ({
    ...gap,
    recommendationIds: uniqueSorted(recommendationIdsByGap.get(gap.id) ?? [])
  }));
  return {
    gaps: linkedGaps,
    recommendations: [...recommendations].sort((left, right) => {
      const leftGap = gaps.findIndex((gap) => left.gapIds.includes(gap.id));
      const rightGap = gaps.findIndex((gap) => right.gapIds.includes(gap.id));
      return leftGap - rightGap || ordinalCompare(left.id, right.id);
    })
  };
}
