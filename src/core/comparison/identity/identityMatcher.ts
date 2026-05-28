import type {
  ComparableIdentity,
  ComparableIdentitySubjectType,
  IdentityMatchCandidate,
  IdentityMatchConfidence,
  IdentityMatchEvidence,
  IdentityMatchEvidenceStrength
} from "./identityMatchTypes.js";
import { normalizeIdentityName } from "./identityNormalization.js";

export function matchIdentityParticipation(
  sourceIdentities: readonly ComparableIdentity[],
  targetIdentities: readonly ComparableIdentity[]
): readonly IdentityMatchCandidate<ComparableIdentity>[] {
  const targetPool = [...targetIdentities];
  const matches: IdentityMatchCandidate<ComparableIdentity>[] = [];

  for (const source of sourceIdentities) {
    const best = findBestIdentityMatch(source, targetPool);
    if (best.target) {
      const index = targetPool.indexOf(best.target);
      if (index >= 0) {
        targetPool.splice(index, 1);
      }
    }

    matches.push(best);
  }

  for (const target of targetPool) {
    matches.push({
      source: {},
      target,
      confidence: "NoMatch",
      evidence: [{ label: "Only in target", detail: readableIdentityName(target), strength: "supporting" }]
    });
  }

  return matches;
}

function findBestIdentityMatch(
  source: ComparableIdentity,
  targets: readonly ComparableIdentity[]
): IdentityMatchCandidate<ComparableIdentity> {
  let best: IdentityMatchCandidate<ComparableIdentity> | undefined;
  let bestScore = -1;

  for (const target of targets) {
    const candidate = scoreIdentityMatch(source, target);
    const score = scoreCandidate(candidate);
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || best.confidence === "NoMatch") {
    return {
      source,
      confidence: "NoMatch",
      evidence: [{ label: "Only in source", detail: readableIdentityName(source), strength: "supporting" }]
    };
  }

  return best;
}

function scoreIdentityMatch(
  source: ComparableIdentity,
  target: ComparableIdentity
): IdentityMatchCandidate<ComparableIdentity> {
  const evidence: IdentityMatchEvidence[] = [];
  const sourceType = resolveSubjectType(source);
  const targetType = resolveSubjectType(target);

  if (sourceType && targetType && sourceType !== targetType) {
    return {
      source,
      target,
      confidence: "NoMatch",
      evidence: [{ label: "Identity subject", detail: `Subject types differ: ${sourceType} → ${targetType}.`, strength: "weak" }]
    };
  }

  appendSubjectTypeEvidence(evidence, sourceType, targetType);
  appendExactAnchorEvidence(evidence, source, target, sourceType ?? targetType);
  appendNormalizedNameEvidence(evidence, source, target);
  appendSupportingEvidence(evidence, source, target, sourceType ?? targetType);

  const confidence = determineConfidence(evidence);
  const normalizedKey = evidence.some((item) => item.label === "Normalized name")
    ? normalizedIdentityKey(source, target)
    : undefined;

  return {
    source,
    target,
    confidence,
    evidence,
    normalizedKey
  };
}

function appendSubjectTypeEvidence(
  evidence: IdentityMatchEvidence[],
  sourceType: ComparableIdentitySubjectType | undefined,
  targetType: ComparableIdentitySubjectType | undefined
): void {
  if (sourceType && targetType && sourceType === targetType) {
    evidence.push({ label: "Identity subject", detail: `Both identities are ${sourceType}.`, strength: "supporting" });
  }
}

function appendExactAnchorEvidence(
  evidence: IdentityMatchEvidence[],
  source: ComparableIdentity,
  target: ComparableIdentity,
  subjectType: ComparableIdentitySubjectType | undefined
): void {
  if (source.azureAdObjectId && target.azureAdObjectId && equalsIgnoreCase(source.azureAdObjectId, target.azureAdObjectId)) {
    evidence.push({ label: "Azure AD object id", detail: "Azure AD object id matches exactly.", strength: "exact" });
  }

  if (source.email && target.email && equalsIgnoreCase(source.email, target.email)) {
    evidence.push({ label: "Internal email", detail: "Internal email matches exactly.", strength: "exact" });
  }

  if (source.applicationId && target.applicationId && equalsIgnoreCase(source.applicationId, target.applicationId)) {
    evidence.push({ label: "Application id", detail: "Application/client id matches exactly.", strength: "exact" });
  }

  if (subjectType === "role" && source.businessUnitName && target.businessUnitName && equalsIgnoreCase(source.businessUnitName, target.businessUnitName)) {
    evidence.push({ label: "Business unit", detail: "Role business unit matches exactly.", strength: "strong" });
  }

  if (subjectType === "team" && source.teamType && target.teamType && equalsIgnoreCase(source.teamType, target.teamType)) {
    evidence.push({ label: "Team type", detail: "Team type matches exactly.", strength: "strong" });
  }

  if (subjectType === "businessUnit" && source.businessUnitPath && target.businessUnitPath && samePath(source.businessUnitPath, target.businessUnitPath)) {
    evidence.push({ label: "Business unit path", detail: "Business unit parent path matches exactly.", strength: "exact" });
  }

  if (source.id && target.id && equalsIgnoreCase(source.id, target.id)) {
    evidence.push({ label: "Dataverse id", detail: "Dataverse id matches exactly.", strength: "exact" });
  }
}

function appendNormalizedNameEvidence(
  evidence: IdentityMatchEvidence[], source: ComparableIdentity, target: ComparableIdentity): void {
  const sourceName = normalizeIdentityName(source.displayName ?? source.uniqueName ?? source.email ?? source.businessUnitName);
  const targetName = normalizeIdentityName(target.displayName ?? target.uniqueName ?? target.email ?? target.businessUnitName);
  const normalizedKey = sourceName?.normalized && sourceName.normalized === targetName?.normalized ? sourceName.normalized : undefined;

  if (normalizedKey && sourceName && targetName) {
    const removed = [...sourceName.removedTokens, ...targetName.removedTokens];
    evidence.push({
      label: "Normalized name",
      detail: removed.length > 0
        ? `Name matches after conservative environment-token normalization: ${[...new Set(removed)].join(", ")}.`
        : "Name matches after normalization.",
      strength: removed.length > 0 ? "strong" : "supporting"
    });
  }
}

function appendSupportingEvidence(
  evidence: IdentityMatchEvidence[],
  source: ComparableIdentity,
  target: ComparableIdentity,
  subjectType: ComparableIdentitySubjectType | undefined
): void {
  if ((subjectType === "applicationUser" || source.isApplicationUser || target.isApplicationUser) && source.isApplicationUser && target.isApplicationUser) {
    evidence.push({ label: "Identity type", detail: "Both identities appear automation-oriented/application-user-like.", strength: "supporting" });
  }

  const roleOverlap = overlap(mergeArrays(source.roles, source.directRoles), mergeArrays(target.roles, target.directRoles));
  if (roleOverlap.length > 0) {
    evidence.push({ label: "Role participation", detail: `Observed role participation overlaps: ${roleOverlap.join(", ")}.`, strength: "supporting" });
  }

  const teamOverlap = overlap(source.teams, target.teams);
  if (teamOverlap.length > 0) {
    evidence.push({ label: "Team participation", detail: `Observed team participation overlaps: ${teamOverlap.join(", ")}.`, strength: "supporting" });
  }

  const userOverlap = overlap(source.users, target.users);
  if (userOverlap.length > 0) {
    evidence.push({ label: "User participation", detail: `Observed user participation overlaps: ${userOverlap.join(", ")}.`, strength: "supporting" });
  }
}

function determineConfidence(evidence: readonly IdentityMatchEvidence[]): IdentityMatchConfidence {
  if (evidence.some((item) => item.strength === "exact")) {
    return "ExactMatch";
  }

  const strongCount = evidence.filter((item) => item.strength === "strong").length;
  const supportingCount = evidence.filter((item) => item.strength === "supporting").length;

  if (strongCount >= 2 || (strongCount > 0 && supportingCount >= 2)) {
    return "LikelyMatch";
  }

  if (strongCount > 0 || supportingCount >= 3) {
    return "PossibleMatch";
  }

  return "NoMatch";
}

function normalizedIdentityKey(source: ComparableIdentity, target: ComparableIdentity): string | undefined {
  const sourceName = normalizeIdentityName(source.displayName ?? source.uniqueName ?? source.email ?? source.businessUnitName);
  const targetName = normalizeIdentityName(target.displayName ?? target.uniqueName ?? target.email ?? target.businessUnitName);

  return sourceName?.normalized && sourceName.normalized === targetName?.normalized ? sourceName.normalized : undefined;
}

function resolveSubjectType(identity: ComparableIdentity): ComparableIdentitySubjectType | undefined {
  if (identity.subjectType) {
    return identity.subjectType;
  }

  if (identity.isApplicationUser || identity.applicationId) {
    return "applicationUser";
  }

  return undefined;
}

function mergeArrays(left: readonly string[] | undefined, right: readonly string[] | undefined): readonly string[] | undefined {
  const values = [...(left ?? []), ...(right ?? [])];
  return values.length ? values : undefined;
}

function overlap(left: readonly string[] | undefined, right: readonly string[] | undefined): readonly string[] {
  const rightSet = new Set((right ?? []).map((value) => value.toLowerCase()));
  return (left ?? []).filter((value) => rightSet.has(value.toLowerCase()));
}

function scoreCandidate(candidate: IdentityMatchCandidate<ComparableIdentity>): number {
  return scoreConfidence(candidate.confidence) + candidate.evidence.reduce((total, item) => total + scoreEvidence(item.strength), 0);
}

function scoreConfidence(confidence: IdentityMatchConfidence): number {
  switch (confidence) {
    case "ExactMatch":
      return 40;
    case "LikelyMatch":
      return 30;
    case "PossibleMatch":
      return 20;
    default:
      return 0;
  }
}

function scoreEvidence(strength: IdentityMatchEvidenceStrength | undefined): number {
  switch (strength) {
    case "exact":
      return 10;
    case "strong":
      return 6;
    case "supporting":
      return 3;
    case "weak":
      return 1;
    default:
      return 0;
  }
}

function equalsIgnoreCase(left: string, right: string): boolean {
  return left.toLowerCase() === right.toLowerCase();
}

function samePath(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((item, index) => equalsIgnoreCase(item, right[index]));
}

function readableIdentityName(identity: ComparableIdentity): string {
  return identity.displayName ?? identity.uniqueName ?? identity.email ?? identity.businessUnitName ?? identity.id ?? "Unknown identity";
}
