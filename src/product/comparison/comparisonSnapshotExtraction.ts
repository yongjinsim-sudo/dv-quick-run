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
      const extractedIdentities = toComparableIdentities(evidence);
      for (const identity of extractedIdentities) {
        const key = identityKey(identity);
        if (key) {
          identities.set(key, mergeIdentity(identities.get(key), identity));
        }
      }
    }
  }

  if (!identities.size) {
    return undefined;
  }

  return { identities: [...identities.values()].sort(compareIdentities) };
}

function toComparableIdentities(evidence: OperationalContextEvidence): readonly ComparableIdentity[] {
  if (evidence.evidenceType !== "AccessTopology" && evidence.evidenceType !== "RuntimeActor" && evidence.evidenceType !== "AutomationParticipation") {
    return [];
  }

  const raw = evidence.raw as Record<string, unknown> | undefined;

  if (evidence.evidenceType === "AccessTopology") {
    return buildAccessTopologyIdentities(raw, evidence);
  }

  if (evidence.evidenceType === "RuntimeActor") {
    const actors = Array.isArray(raw?.actors) ? raw?.actors as readonly unknown[] : [];
    const actor = actors[0] as Record<string, unknown> | undefined;
    if (!actor || !hasIdentityAnchor(actor)) {
      return [];
    }

    const identity = buildIdentityFromRaw({
      raw: actor,
      summaryText: `${evidence.title} ${evidence.summary}`
    });

    return identity ? [identity] : [];
  }

  if (evidence.evidenceType === "AutomationParticipation") {
    const identityRaw = firstIdentityLikeRaw(raw);
    if (!identityRaw || !hasIdentityAnchor(identityRaw)) {
      return [];
    }

    const identity = buildIdentityFromRaw({
      raw: identityRaw,
      roles: asStringArray(identityRaw.roles),
      teams: asStringArray(identityRaw.teams),
      summaryText: `${evidence.title} ${evidence.summary}`
    });

    return identity ? [identity] : [];
  }

  return [];
}

function buildAccessTopologyIdentities(
  raw: Record<string, unknown> | undefined,
  evidence: OperationalContextEvidence
): readonly ComparableIdentity[] {
  const accessContext = raw?.accessContext as Record<string, unknown> | undefined;
  const principalSummary = accessContext?.principalSummary as Record<string, unknown> | undefined;
  if (!principalSummary || !hasIdentityAnchor(principalSummary)) {
    return [];
  }

  const principal = buildIdentityFromRaw({
    raw: principalSummary,
    roles: extractRoleNames(accessContext?.directRoles),
    inheritedRoles: extractRoleNames(accessContext?.inheritedRoles),
    teams: extractTeamNames(accessContext?.teamMemberships),
    summaryText: `${evidence.title} ${evidence.summary}`
  });

  const principalName = principal?.displayName ?? principal?.uniqueName ?? principal?.email;
  const teamIdentities = extractTeamIdentities(accessContext?.teamMemberships, principalName);
  const roleIdentities = extractRoleIdentities(accessContext, principalName);
  const businessUnitIdentities = extractBusinessUnitIdentities(accessContext, principalName);

  return [principal, ...teamIdentities, ...roleIdentities, ...businessUnitIdentities]
    .filter((identity): identity is ComparableIdentity => Boolean(identity));
}

function buildIdentityFromRaw(args: {
  readonly raw: Record<string, unknown> | undefined;
  readonly roles?: readonly string[];
  readonly inheritedRoles?: readonly string[];
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
  const inheritedRoles = args.inheritedRoles ?? asStringArray(raw?.inheritedRoles) ?? asStringArray(raw?.inheritedTeamRoles);
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
    subjectType: isApplicationUser ? "applicationUser" : "user",
    id,
    displayName,
    uniqueName,
    email,
    applicationId,
    azureAdObjectId,
    isApplicationUser,
    roles,
    directRoles: roles,
    inheritedRoles,
    inheritedTeamRoles: inheritedRoles,
    teams
  };
}

function extractTeamIdentities(value: unknown, principalName: string | undefined): readonly ComparableIdentity[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => isRecord(item) ? item : undefined)
    .filter((item): item is Record<string, unknown> => Boolean(item))
    .map((team) => {
      const displayName = asString(team.teamName) ?? asString(team.name);
      const id = asString(team.teamId) ?? asString(team.teamid) ?? asString(team.id);
      const teamType = asString(team.teamType) ?? asString(team.teamtype);
      const directRoles = extractRoleNames(team.inheritedRoles);
      return {
        subjectType: "team" as const,
        id,
        displayName,
        teamType,
        directRoles,
        roles: directRoles,
        users: principalName ? [principalName] : undefined
      };
    })
    .filter((identity) => Boolean(identity.id || identity.displayName));
}

function extractBusinessUnitIdentities(accessContext: Record<string, unknown> | undefined, principalName: string | undefined): readonly ComparableIdentity[] {
  const businessUnitMap = new Map<string, ComparableIdentity>();
  const principalSummary = accessContext?.principalSummary as Record<string, unknown> | undefined;
  const principalBusinessUnitName = asString(principalSummary?.businessUnitName);
  const principalBusinessUnitId = asString(principalSummary?.businessUnitId);

  if (principalBusinessUnitName || principalBusinessUnitId) {
    mergeBusinessUnitIdentity(businessUnitMap, {
      id: principalBusinessUnitId,
      displayName: principalBusinessUnitName,
      users: principalName ? [principalName] : undefined
    });
  }

  for (const team of extractTeamRecords(accessContext?.teamMemberships)) {
    const businessUnitName = asString(team.businessUnitName);
    const businessUnitId = asString(team.businessUnitId) ?? asString(team.businessunitid);
    const teamName = asString(team.teamName) ?? asString(team.name);
    if (businessUnitName || businessUnitId) {
      mergeBusinessUnitIdentity(businessUnitMap, {
        id: businessUnitId,
        displayName: businessUnitName,
        teams: teamName ? [teamName] : undefined,
        users: principalName ? [principalName] : undefined
      });
    }
  }

  return [...businessUnitMap.values()].sort(compareIdentities);
}

function mergeBusinessUnitIdentity(
  businessUnitMap: Map<string, ComparableIdentity>,
  identity: ComparableIdentity
): void {
  const key = `businessUnit:${(identity.id ?? identity.displayName ?? "").toLowerCase()}`;
  if (!identity.id && !identity.displayName) {
    return;
  }

  businessUnitMap.set(key, mergeIdentity(businessUnitMap.get(key), {
    ...identity,
    subjectType: "businessUnit"
  }));
}

function extractRoleIdentities(accessContext: Record<string, unknown> | undefined, principalName: string | undefined): readonly ComparableIdentity[] {
  const roleMap = new Map<string, ComparableIdentity>();

  for (const role of extractRoleRecords(accessContext?.directRoles)) {
    mergeRoleIdentity(roleMap, role, { userName: principalName });
  }

  for (const team of extractTeamRecords(accessContext?.teamMemberships)) {
    const teamName = asString(team.teamName) ?? asString(team.name);
    for (const role of extractRoleRecords(team.inheritedRoles)) {
      mergeRoleIdentity(roleMap, role, { teamName, userName: principalName });
    }
  }

  for (const role of extractRoleRecords(accessContext?.inheritedRoles)) {
    mergeRoleIdentity(roleMap, role, {
      teamName: asString(role.sourceTeamName),
      userName: principalName
    });
  }

  return [...roleMap.values()].sort(compareIdentities);
}

function mergeRoleIdentity(
  roleMap: Map<string, ComparableIdentity>,
  role: Record<string, unknown>,
  participation: { readonly teamName?: string; readonly userName?: string }
): void {
  const displayName = asString(role.roleName) ?? asString(role.name);
  const id = asString(role.roleId) ?? asString(role.roleid) ?? asString(role.id);
  if (!displayName && !id) {
    return;
  }

  const key = `role:${(id ?? displayName ?? "").toLowerCase()}`;
  const current = roleMap.get(key);
  roleMap.set(key, mergeIdentity(current, {
    subjectType: "role",
    id,
    displayName,
    businessUnitName: asString(role.businessUnitName),
    teams: participation.teamName ? [participation.teamName] : undefined,
    users: participation.userName ? [participation.userName] : undefined
  }));
}

function extractRoleRecords(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
}

function extractTeamRecords(value: unknown): readonly Record<string, unknown>[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(isRecord);
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
      || asString(raw.teamId)
      || asString(raw.roleid)
      || asString(raw.roleId)
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
  const subject = identity.subjectType ?? (identity.isApplicationUser ? "applicationUser" : "user");
  const key = identity.id
    ?? identity.applicationId
    ?? identity.azureAdObjectId
    ?? identity.uniqueName
    ?? identity.email
    ?? identity.displayName;

  return key ? `${subject}:${key.toLowerCase()}` : undefined;
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
    subjectType: current.subjectType ?? next.subjectType,
    id: current.id ?? next.id,
    displayName: current.displayName ?? next.displayName,
    uniqueName: current.uniqueName ?? next.uniqueName,
    email: current.email ?? next.email,
    applicationId: current.applicationId ?? next.applicationId,
    azureAdObjectId: current.azureAdObjectId ?? next.azureAdObjectId,
    isApplicationUser: current.isApplicationUser || next.isApplicationUser,
    teamType: current.teamType ?? next.teamType,
    businessUnitName: current.businessUnitName ?? next.businessUnitName,
    businessUnitPath: current.businessUnitPath ?? next.businessUnitPath,
    parentBusinessUnitName: current.parentBusinessUnitName ?? next.parentBusinessUnitName,
    roles: mergeStringArrays(current.roles, next.roles),
    directRoles: mergeStringArrays(current.directRoles, next.directRoles),
    inheritedRoles: mergeStringArrays(current.inheritedRoles, next.inheritedRoles),
    inheritedTeamRoles: mergeStringArrays(current.inheritedTeamRoles, next.inheritedTeamRoles),
    teams: mergeStringArrays(current.teams, next.teams),
    users: mergeStringArrays(current.users, next.users)
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
