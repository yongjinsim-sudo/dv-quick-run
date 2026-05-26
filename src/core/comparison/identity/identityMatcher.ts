import type { ComparableIdentity, IdentityMatchCandidate, IdentityMatchEvidence } from "./identityMatchTypes.js";
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
      evidence: [{ label: "Only in target", detail: readableIdentityName(target) }]
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
    const score = scoreConfidence(candidate.confidence) + candidate.evidence.length;
    if (score > bestScore) {
      best = candidate;
      bestScore = score;
    }
  }

  if (!best || best.confidence === "NoMatch") {
    return {
      source,
      confidence: "NoMatch",
      evidence: [{ label: "Only in source", detail: readableIdentityName(source) }]
    };
  }

  return best;
}

function scoreIdentityMatch(
  source: ComparableIdentity,
  target: ComparableIdentity
): IdentityMatchCandidate<ComparableIdentity> {
  const evidence: IdentityMatchEvidence[] = [];

  if (source.id && target.id && source.id.toLowerCase() === target.id.toLowerCase()) {
    evidence.push({ label: "Dataverse id", detail: "Dataverse system user id matches exactly." });
  }

  if (source.applicationId && target.applicationId && source.applicationId.toLowerCase() === target.applicationId.toLowerCase()) {
    evidence.push({ label: "Application id", detail: "Application/client id matches exactly." });
  }

  if (source.azureAdObjectId && target.azureAdObjectId && source.azureAdObjectId.toLowerCase() === target.azureAdObjectId.toLowerCase()) {
    evidence.push({ label: "Azure AD object id", detail: "Azure AD object id matches exactly." });
  }

  const sourceName = normalizeIdentityName(source.displayName ?? source.uniqueName ?? source.email);
  const targetName = normalizeIdentityName(target.displayName ?? target.uniqueName ?? target.email);
  const normalizedKey = sourceName?.normalized && sourceName.normalized === targetName?.normalized ? sourceName.normalized : undefined;

  if (normalizedKey && sourceName && targetName) {
    const removed = [...sourceName.removedTokens, ...targetName.removedTokens];
    evidence.push({
      label: "Normalized name",
      detail: removed.length > 0
        ? `Name matches after removing environment tokens: ${[...new Set(removed)].join(", ")}.`
        : "Name matches after normalization."
    });
  }

  if (source.isApplicationUser && target.isApplicationUser) {
    evidence.push({ label: "Identity type", detail: "Both identities appear automation-oriented/application-user-like." });
  }

  const roleOverlap = overlap(source.roles, target.roles);
  if (roleOverlap.length > 0) {
    evidence.push({ label: "Role participation", detail: `Observed role participation overlaps: ${roleOverlap.join(", ")}.` });
  }

  const teamOverlap = overlap(source.teams, target.teams);
  if (teamOverlap.length > 0) {
    evidence.push({ label: "Team participation", detail: `Observed team participation overlaps: ${teamOverlap.join(", ")}.` });
  }

  const hasExactAnchor = evidence.some((item) => item.label === "Dataverse id" || item.label === "Application id" || item.label === "Azure AD object id");
  const confidence = hasExactAnchor
    ? "ExactMatch"
    : normalizedKey && evidence.length >= 3
      ? "LikelyMatch"
      : normalizedKey
        ? "PossibleMatch"
        : "NoMatch";

  return {
    source,
    target,
    confidence,
    evidence,
    normalizedKey
  };
}

function overlap(left: readonly string[] | undefined, right: readonly string[] | undefined): readonly string[] {
  const rightSet = new Set((right ?? []).map((value) => value.toLowerCase()));
  return (left ?? []).filter((value) => rightSet.has(value.toLowerCase()));
}

function scoreConfidence(confidence: string): number {
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

function readableIdentityName(identity: ComparableIdentity): string {
  return identity.displayName ?? identity.uniqueName ?? identity.email ?? identity.id ?? "Unknown identity";
}
