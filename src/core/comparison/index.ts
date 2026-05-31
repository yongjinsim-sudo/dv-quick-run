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
  ComparisonInvestigationContinuation,
  ComparisonInvestigationContinuationKind,
  ComparisonInvestigationContinuationState,
  ComparisonOperationalSignificance,
  ComparisonProvider,
  ComparisonProviderCapabilities,
  ComparisonProviderContext,
  ComparisonProviderResult,
  ComparisonSubjectType,
  ComparisonSummary,
  ComparisonSnapshotTrustStatus,
  ComparisonSnapshotTrustSummary,
  ComparisonViewModel
} from "./comparisonTypes.js";
export { defaultEnvironmentIdentityTokens, normalizeIdentityName } from "./identity/identityNormalization.js";
export { matchIdentityParticipation } from "./identity/identityMatcher.js";
export type {
  ComparableIdentity,
  ComparableIdentitySubjectType,
  IdentityMatchCandidate,
  IdentityMatchConfidence,
  IdentityMatchEvidence,
  IdentityMatchEvidenceStrength
} from "./identity/identityMatchTypes.js";

export { calibrateComparisonDifference, calibrateSignificance, maxComparisonSignificance } from "./comparisonSignificance.js";
