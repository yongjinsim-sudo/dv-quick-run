export {
  createCrossEnvironmentComparisonEngine,
  createEmptyComparisonProviderResult,
  CrossEnvironmentComparisonEngine
} from "./crossEnvironmentComparisonEngine.js";
export { compareOperationalSignificance, sortComparisonGroups } from "./comparisonOrdering.js";
export type {
  ComparisonDifference,
  ComparisonDifferenceKind,
  ComparisonDriftGroup,
  ComparisonEnvironmentRef,
  ComparisonEvidenceRef,
  ComparisonOperationalSignificance,
  ComparisonProvider,
  ComparisonProviderContext,
  ComparisonProviderResult,
  ComparisonSummary,
  ComparisonSnapshotTrustStatus,
  ComparisonSnapshotTrustSummary,
  ComparisonViewModel
} from "./comparisonTypes.js";
export { defaultEnvironmentIdentityTokens, normalizeIdentityName } from "./identity/identityNormalization.js";
export { matchIdentityParticipation } from "./identity/identityMatcher.js";
export type {
  ComparableIdentity,
  IdentityMatchCandidate,
  IdentityMatchConfidence,
  IdentityMatchEvidence
} from "./identity/identityMatchTypes.js";

export { calibrateComparisonDifference, calibrateSignificance, maxComparisonSignificance } from "./comparisonSignificance.js";
