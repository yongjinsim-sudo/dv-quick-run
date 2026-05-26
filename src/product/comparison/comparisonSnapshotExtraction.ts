import type { ComparableIdentity } from "../../core/comparison/index.js";
import type { OperationalProfileModel } from "../operationalProfile/operationalProfileTypes.js";
import type { OperationalContextEvidence } from "../operationalContext/operationalContextTypes.js";

export interface IdentityParticipationSnapshotPayload {
  readonly identities: readonly ComparableIdentity[];
}

export function buildIdentityParticipationSnapshotPayloadFromProfile(
  profile: OperationalProfileModel
): IdentityParticipationSnapshotPayload | undefined {
  const identities = new Map<string, ComparableIdentity>();

  for (const section of profile.operationalContext?.sections ?? []) {
    for (const evidence of section.evidence) {
      const identity = toComparableIdentity(evidence);
      if (!identity) {
        continue;
      }

      const key = identityKey(identity);
      if (key) {
        identities.set(key, mergeIdentity(identities.get(key), identity));
      }
    }
  }

  if (!identities.size) {
    return undefined;
  }

  return { identities: [...identities.values()].sort(compareIdentities) };
}

function toComparableIdentity(evidence: OperationalContextEvidence): ComparableIdentity | undefined {
  if (evidence.evidenceType !== "AccessTopology" && evidence.evidenceType !== "RuntimeActor" && evidence.evidenceType !== "AutomationParticipation") {
    return undefined;
  }

  const raw = evidence.raw as Record<string, unknown> | undefined;

  if (evidence.evidenceType === "AccessTopology") {
    const accessContext = raw?.accessContext as Record<string, unknown> | undefined;
    const principalSummary = accessContext?.principalSummary as Record<string, unknown> | undefined;
    if (!principalSummary || !hasIdentityAnchor(principalSummary)) {
      return undefined;
    }

    return buildIdentityFromRaw({
      raw: principalSummary,
      roles: extractRoleNames(accessContext?.directRoles),
      teams: extractTeamNames(accessContext?.teamMemberships),
      summaryText: `${evidence.title} ${evidence.summary}`
    });
  }

  if (evidence.evidenceType === "RuntimeActor") {
    const actors = Array.isArray(raw?.actors) ? raw?.actors as readonly unknown[] : [];
    const actor = actors[0] as Record<string, unknown> | undefined;
    if (!actor || !hasIdentityAnchor(actor)) {
      return undefined;
    }

    return buildIdentityFromRaw({
      raw: actor,
      summaryText: `${evidence.title} ${evidence.summary}`
    });
  }

  if (evidence.evidenceType === "AutomationParticipation") {
    const identityRaw = firstIdentityLikeRaw(raw);
    if (!identityRaw || !hasIdentityAnchor(identityRaw)) {
      return undefined;
    }

    return buildIdentityFromRaw({
      raw: identityRaw,
      roles: asStringArray(identityRaw.roles),
      teams: asStringArray(identityRaw.teams),
      summaryText: `${evidence.title} ${evidence.summary}`
    });
  }

  return undefined;
}

function buildIdentityFromRaw(args: {
  readonly raw: Record<string, unknown> | undefined;
  readonly roles?: readonly string[];
  readonly teams?: readonly string[];
  readonly summaryText: string;
}): ComparableIdentity | undefined {
  const raw = args.raw;
  const displayName = asString(raw?.displayName) ?? asString(raw?.fullname) ?? asString(raw?.name);
  const id = asString(raw?.id) ?? asString(raw?.systemuserid) ?? asString(raw?.teamid);
  const applicationId = asString(raw?.applicationid) ?? asString(raw?.applicationId);
  const azureAdObjectId = asString(raw?.azureactivedirectoryobjectid) ?? asString(raw?.azureAdObjectId) ?? asString(raw?.azureObjectId);
  const uniqueName = asString(raw?.domainname) ?? asString(raw?.uniqueName) ?? asString(raw?.uniquename);
  const email = asString(raw?.internalemailaddress) ?? asString(raw?.email);
  const roles = args.roles ?? asStringArray(raw?.roles);
  const teams = args.teams ?? asStringArray(raw?.teams);
  const principalType = asString(raw?.principalType) ?? asString(raw?.actorType);
  const isApplicationUser = Boolean(
    raw?.isApplicationUser === true
      || raw?.applicationid
      || raw?.applicationId
      || /application user|service principal|automation/i.test(`${principalType ?? ""} ${args.summaryText}`)
  );

  if (!hasIdentityAnchor(raw)) {
    return undefined;
  }

  return {
    id,
    displayName,
    uniqueName,
    email,
    applicationId,
    azureAdObjectId,
    isApplicationUser,
    roles,
    teams
  };
}

function firstIdentityLikeRaw(raw: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!raw) {
    return undefined;
  }

  const candidates = [
    raw.identity,
    raw.principal,
    raw.principalSummary,
    raw.applicationUser,
    raw.user,
    raw.actor
  ];

  for (const candidate of candidates) {
    if (isRecord(candidate) && hasIdentityAnchor(candidate)) {
      return candidate;
    }
  }

  for (const value of Object.values(raw)) {
    if (Array.isArray(value)) {
      const found = value.find((item) => isRecord(item) && hasIdentityAnchor(item)) as Record<string, unknown> | undefined;
      if (found) {
        return found;
      }
    }
  }

  return hasIdentityAnchor(raw) ? raw : undefined;
}

function hasIdentityAnchor(raw: Record<string, unknown> | undefined): boolean {
  if (!raw) {
    return false;
  }

  return Boolean(
    asString(raw.id)
      || asString(raw.systemuserid)
      || asString(raw.teamid)
      || asString(raw.applicationid)
      || asString(raw.applicationId)
      || asString(raw.azureactivedirectoryobjectid)
      || asString(raw.azureAdObjectId)
      || asString(raw.azureObjectId)
      || asString(raw.domainname)
      || asString(raw.uniqueName)
      || asString(raw.uniquename)
      || asString(raw.internalemailaddress)
      || asString(raw.email)
  );
}

function identityKey(identity: ComparableIdentity): string | undefined {
  return (identity.id
    ?? identity.applicationId
    ?? identity.azureAdObjectId
    ?? identity.uniqueName
    ?? identity.email
    ?? identity.displayName)?.toLowerCase();
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function extractRoleNames(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const roles = value
    .map((item) => asString((item as { readonly roleName?: unknown }).roleName) ?? asString((item as { readonly name?: unknown }).name))
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => left.localeCompare(right));

  return roles.length ? roles : undefined;
}

function extractTeamNames(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const teams = value
    .map((item) => asString((item as { readonly teamName?: unknown }).teamName) ?? asString((item as { readonly name?: unknown }).name))
    .filter((item): item is string => Boolean(item))
    .sort((left, right) => left.localeCompare(right));

  return teams.length ? teams : undefined;
}

function mergeIdentity(current: ComparableIdentity | undefined, next: ComparableIdentity): ComparableIdentity {
  if (!current) {
    return next;
  }

  return {
    id: current.id ?? next.id,
    displayName: current.displayName ?? next.displayName,
    uniqueName: current.uniqueName ?? next.uniqueName,
    email: current.email ?? next.email,
    applicationId: current.applicationId ?? next.applicationId,
    azureAdObjectId: current.azureAdObjectId ?? next.azureAdObjectId,
    isApplicationUser: current.isApplicationUser || next.isApplicationUser,
    roles: mergeStringArrays(current.roles, next.roles),
    teams: mergeStringArrays(current.teams, next.teams)
  };
}

function mergeStringArrays(left: readonly string[] | undefined, right: readonly string[] | undefined): readonly string[] | undefined {
  const values = [...new Set([...(left ?? []), ...(right ?? [])].filter((value) => value.trim().length > 0))].sort((a, b) => a.localeCompare(b));
  return values.length ? values : undefined;
}

function asString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function asStringArray(value: unknown): readonly string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }

  const values = value.map(asString).filter((item): item is string => Boolean(item)).sort((a, b) => a.localeCompare(b));
  return values.length ? values : undefined;
}

function compareIdentities(left: ComparableIdentity, right: ComparableIdentity): number {
  return (left.displayName ?? left.uniqueName ?? left.email ?? left.id ?? "").localeCompare(
    right.displayName ?? right.uniqueName ?? right.email ?? right.id ?? ""
  );
}
