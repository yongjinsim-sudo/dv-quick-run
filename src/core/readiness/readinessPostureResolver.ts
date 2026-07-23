import type {
  InvestigationGapV1,
  InvestigationReadinessPosture
} from "./readinessContracts.js";
import type { NormalizedReadinessContributorV1 } from "./contributorStateNormalizer.js";

function hasQualifyingPrimary(contributors: readonly NormalizedReadinessContributorV1[]): boolean {
  return contributors.some((contributor) =>
    contributor.applicable
    && contributor.role === "Primary"
    && ["Available", "Partial"].includes(contributor.state)
    && contributor.evidenceRefs.length > 0
  );
}

export function resolveReadinessPosture(
  contributors: readonly NormalizedReadinessContributorV1[],
  gaps: readonly InvestigationGapV1[]
): InvestigationReadinessPosture {
  if (!hasQualifyingPrimary(contributors)) {
    return "NotAssessable";
  }
  if (gaps.some((gap) => gap.priority === "High")) {
    return "Limited";
  }
  if (gaps.some((gap) => gap.priority === "Medium")) {
    return "Conditional";
  }
  return "Ready";
}
