import type { InvestigationGapCategory, InvestigationGapPriority, InvestigationGapV1 } from "../readinessContracts.js";
import { ordinalCompare } from "../readinessValueAccess.js";

const PRIORITY_ORDER: readonly InvestigationGapPriority[] = ["High", "Medium", "Low"];
const CATEGORY_ORDER: readonly InvestigationGapCategory[] = [
  "Coverage", "Permission", "Provenance", "Freshness", "Scope", "Repeatability", "Conflict", "ContributorUnavailable"
];

export function readinessGapPriorityRank(priority: InvestigationGapPriority): number {
  return PRIORITY_ORDER.length - PRIORITY_ORDER.indexOf(priority);
}

export function readinessGapCategoryRank(category: InvestigationGapCategory): number {
  return CATEGORY_ORDER.length - CATEGORY_ORDER.indexOf(category);
}

export function compareReadinessGaps(left: InvestigationGapV1, right: InvestigationGapV1): number {
  return PRIORITY_ORDER.indexOf(left.priority) - PRIORITY_ORDER.indexOf(right.priority)
    || CATEGORY_ORDER.indexOf(left.category) - CATEGORY_ORDER.indexOf(right.category)
    || ordinalCompare(left.ruleId, right.ruleId)
    || ordinalCompare(left.contributorIds.join("|"), right.contributorIds.join("|"))
    || ordinalCompare(left.id, right.id);
}

export function orderReadinessGaps(gaps: readonly InvestigationGapV1[]): InvestigationGapV1[] {
  return [...gaps].sort(compareReadinessGaps);
}
