import type { DataverseClient } from "../../services/dataverseClient.js";
import type {
  OperationalContextEvidence,
  OperationalContextProvider,
  OperationalContextProviderRequest
} from "./operationalContextTypes.js";
import { createOperationalContextProviderResult } from "./operationalContextEngine.js";

type ODataListResponse = { value?: Array<Record<string, unknown>> };

type SolutionDetail = {
  id?: string;
  uniqueName?: string;
  friendlyName?: string;
  version?: string;
  isManaged?: boolean;
};


type ActorDetail = {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  actorType?: string;
  source?: string;
  accessMode?: string;
  isDisabled?: boolean;
  applicationId?: string;
  azureObjectId?: string;
};

type AccessPrincipalType = "Human User" | "Application User" | "Service Principal Context" | "SYSTEM Context" | "Team Context" | "Role Context" | "Business Unit Context" | "Unknown Principal";

type AccessContextSubjectKind = "systemuser" | "applicationuser" | "team" | "role" | "businessunit";

type PrincipalSummary = {
  id?: string;
  displayName?: string;
  uniqueName?: string;
  principalType: AccessPrincipalType;
  isDisabled?: boolean;
  accessMode?: string;
  applicationId?: string;
  azureObjectId?: string;
  businessUnitId?: string;
  businessUnitName?: string;
};

type AccessRole = {
  roleId?: string;
  roleName: string;
  businessUnitId?: string;
  businessUnitName?: string;
  source: "direct" | "team";
  sourceTeamId?: string;
  sourceTeamName?: string;
};

type TeamMembership = {
  teamId?: string;
  teamName: string;
  teamType?: string;
  businessUnitId?: string;
  inheritedRoles: AccessRole[];
};

type TeamMemberSummary = {
  userId?: string;
  displayName: string;
  uniqueName?: string;
  principalType?: AccessPrincipalType;
  isDisabled?: boolean;
  accessMode?: string;
  businessUnitId?: string;
  businessUnitName?: string;
  applicationId?: string;
  azureObjectId?: string;
};

type AccessEvidenceDetail = {
  sourceType: "principal" | "businessUnit" | "childBusinessUnit" | "businessUnitUser" | "businessUnitTeam" | "businessUnitAppUser" | "businessUnitRole" | "directRole" | "teamMembership" | "teamMember" | "roleUser" | "roleTeam" | "inheritedTeamRole" | "lookup";
  sourceId?: string;
  sourceDisplayName: string;
  relationshipType: string;
  evidenceDescription: string;
  rawContext?: unknown;
};

type BusinessUnitRoleGroup = {
  groupName: string;
  roles: AccessRole[];
};

type BusinessUnitSummary = {
  businessUnitId?: string;
  name?: string;
  parentBusinessUnitId?: string;
  parentBusinessUnitName?: string;
  childBusinessUnitCount?: number;
  userParticipationCount?: number;
  teamParticipationCount?: number;
  applicationUserParticipationCount?: number;
  roleParticipationCount?: number;
};

type AccessContextDetail = {
  subjectKind: AccessContextSubjectKind;
  principalSummary: PrincipalSummary;
  businessUnitSummary?: BusinessUnitSummary;
  directRoles: AccessRole[];
  teamMemberships: TeamMembership[];
  teamMembers: TeamMemberSummary[];
  roleUsers: TeamMemberSummary[];
  roleTeams: TeamMembership[];
  inheritedRoles: AccessRole[];
  evidence: AccessEvidenceDetail[];
  operationalSignificance: string;
  topologySummary: string;
  queryLog: string[];
  keySignals?: string[];
  businessUnitRoleGroups?: BusinessUnitRoleGroup[];
  limits: {
    roleTop: number;
    teamTop: number;
    teamRoleTop: number;
    teamMemberTop: number;
    displayedByDefault: number;
  };
  searchHint: string;
};

type AccessDetail = {
  label: string;
  summary: string;
  principal?: ActorDetail;
  missingPrivilege?: string;
  target?: string;
  source?: string;
};

type OwnershipDetail = {
  label: string;
  value: string;
  meaning: string;
  source: string;
};

function formatActorName(actor: ActorDetail): string {
  return actor.displayName ?? actor.uniqueName ?? actor.id ?? "Observed actor";
}

function classifyActor(row: Record<string, unknown>): string {
  const applicationId = normalizeString(row.applicationid);
  if (applicationId) {
    return "App user / service principal linked user";
  }

  return "Human or interactive Dataverse user";
}

function normalizeNumberLike(value: unknown): string | undefined {
  if (typeof value === "number") {
    return String(value);
  }

  const text = String(value ?? "").trim();
  return text || undefined;
}

async function loadWhoAmI(client: DataverseClient, token: string): Promise<Record<string, unknown>> {
  return await client.get("/WhoAmI", token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
}

async function loadSystemUser(client: DataverseClient, token: string, userId: string): Promise<Record<string, unknown> | undefined> {
  try {
    return await client.get(
      `/systemusers(${userId})?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled`,
      token,
      { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }
    ) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}

function toActorDetailFromWhoAmI(whoAmI: Record<string, unknown>, user?: Record<string, unknown>): ActorDetail {
  const id = normalizeGuidLike(whoAmI.UserId ?? whoAmI.userid ?? user?.systemuserid);
  return {
    id,
    displayName: normalizeString(user?.fullname),
    uniqueName: normalizeString(user?.domainname),
    actorType: user ? classifyActor(user) : "Current Dataverse principal",
    source: "WhoAmI / systemusers",
    accessMode: normalizeNumberLike(user?.accessmode),
    isDisabled: normalizeBoolean(user?.isdisabled),
    applicationId: normalizeString(user?.applicationid),
    azureObjectId: normalizeString(user?.azureactivedirectoryobjectid)
  };
}

async function loadCurrentActor(client: DataverseClient, token: string): Promise<{ actor: ActorDetail; queries: string[]; whoAmI: Record<string, unknown> }> {
  const whoAmI = await loadWhoAmI(client, token);
  const userId = normalizeGuidLike(whoAmI.UserId ?? whoAmI.userid);
  const user = userId ? await loadSystemUser(client, token, userId) : undefined;
  return {
    actor: toActorDetailFromWhoAmI(whoAmI, user),
    queries: ["/WhoAmI", ...(userId ? [`/systemusers(${userId})?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled`] : [])],
    whoAmI
  };
}

async function loadEntityOwnershipDetails(client: DataverseClient, token: string, logicalName: string): Promise<{ row: Record<string, unknown>; query: string; details: OwnershipDetail[] }> {
  const query = `/EntityDefinitions(LogicalName='${escapeODataString(logicalName)}')?$select=LogicalName,EntitySetName,OwnershipType,IsActivity,IsCustomEntity,IsManaged,PrimaryIdAttribute,PrimaryNameAttribute`;
  const row = await client.get(query, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
  const ownershipType = normalizeString(row.OwnershipType) ?? "Not returned";
  const isManaged = normalizeBoolean(row.IsManaged);
  const isActivity = normalizeBoolean(row.IsActivity);
  const isCustomEntity = normalizeBoolean(row.IsCustomEntity);

  return {
    row,
    query,
    details: [
      {
        label: "Ownership model",
        value: ownershipType,
        meaning: "Describes the Dataverse ownership model for this table. It is ownership structure only, not runtime responsibility.",
        source: "EntityDefinitions.OwnershipType"
      },
      {
        label: "Managed metadata state",
        value: typeof isManaged === "boolean" ? (isManaged ? "Managed" : "Unmanaged") : "Not returned",
        meaning: "Shows whether the table metadata is managed. This can matter for customisation/editability, but it is not causality.",
        source: "EntityDefinitions.IsManaged"
      },
      {
        label: "Activity table",
        value: typeof isActivity === "boolean" ? (isActivity ? "Yes" : "No") : "Not returned",
        meaning: "Activity tables participate in Dataverse activity behaviour. This is operational context only.",
        source: "EntityDefinitions.IsActivity"
      },
      {
        label: "Custom table",
        value: typeof isCustomEntity === "boolean" ? (isCustomEntity ? "Yes" : "No") : "Not returned",
        meaning: "Distinguishes platform/application tables from custom tables where Dataverse returns the metadata.",
        source: "EntityDefinitions.IsCustomEntity"
      }
    ]
  };
}

const ENTITY_COMPONENT_TYPE = 1;
const SOLUTION_LOOKUP_TOP = 15;
const SOLUTION_CONTEXT_DISPLAY_LIMIT = 8;
const SOLUTION_CONTEXT_TIMEOUT_MS = 5000;
const ACCESS_TEAM_MEMBER_TOP = 100;

function subjectLabel(request: OperationalContextProviderRequest): string {
  return request.subject.displayName ?? request.subject.logicalName ?? request.subject.id ?? request.subject.type;
}

function hasEntitySubject(request: OperationalContextProviderRequest): boolean {
  return request.subject.type === "entity" && typeof request.subject.logicalName === "string" && request.subject.logicalName.trim().length > 0;
}

function escapeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function normalizeGuidLike(value: unknown): string | undefined {
  const text = String(value ?? "").trim().replace(/[{}]/g, "");
  return /^[0-9a-fA-F-]{36}$/.test(text) ? text.toLowerCase() : undefined;
}

function normalizeBoolean(value: unknown): boolean | undefined {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "object" && value && "Value" in value) {
    const wrapped = (value as { Value?: unknown }).Value;
    return typeof wrapped === "boolean" ? wrapped : undefined;
  }

  return undefined;
}

function normalizeString(value: unknown): string | undefined {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function solutionName(solution: SolutionDetail): string {
  return solution.friendlyName ?? solution.uniqueName ?? solution.id ?? "Unnamed solution";
}

function isLikelyMicrosoftSolution(solution: SolutionDetail): boolean {
  const text = `${solution.uniqueName ?? ""} ${solution.friendlyName ?? ""}`.toLowerCase();
  return text.startsWith("system ")
    || text === "system"
    || text.startsWith("default ")
    || text === "default"
    || text.includes("microsoft")
    || text.includes("msdyn")
    || text.includes("msft_")
    || text.includes("power automate")
    || text.includes("dynamics");
}

function solutionOperationalRank(solution: SolutionDetail, index: number): number {
  const text = `${solution.uniqueName ?? ""} ${solution.friendlyName ?? ""}`.toLowerCase();
  let score = 1000 - index;

  if (!isLikelyMicrosoftSolution(solution)) {
    score += 5000;
  }

  if (solution.isManaged === false) {
    score += 1200;
  } else if (solution.isManaged === true) {
    score += 300;
  }

  if (text.includes("patch")) {
    score += 250;
  }

  if (text === "system" || text.includes("system solution")) {
    score -= 3000;
  }

  if (text === "default" || text.includes("default solution")) {
    score -= 2500;
  }

  return score;
}

function rankSolutionsForOperationalSignal(solutions: SolutionDetail[]): SolutionDetail[] {
  return solutions
    .map((solution, index) => ({ solution, score: solutionOperationalRank(solution, index), index }))
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.solution);
}

function displayedSolutions(solutions: SolutionDetail[]): SolutionDetail[] {
  return solutions.slice(0, SOLUTION_CONTEXT_DISPLAY_LIMIT);
}

function formatSolutionList(solutions: SolutionDetail[]): string {
  return solutions
    .map((solution) => {
      const managed = typeof solution.isManaged === "boolean"
        ? solution.isManaged ? "Managed" : "Unmanaged"
        : "Managed state unknown";
      const version = solution.version ? ` v${solution.version}` : "";
      return `${solutionName(solution)} (${managed}${version})`;
    })
    .join("; ");
}

function getLookupId(row: Record<string, unknown>, logicalName: string): string | undefined {
  return normalizeGuidLike(row[`_${logicalName}_value`] ?? row[logicalName]);
}

function toSolutionDetail(row: Record<string, unknown>): SolutionDetail {
  return {
    id: normalizeGuidLike(row.solutionid),
    uniqueName: normalizeString(row.uniquename),
    friendlyName: normalizeString(row.friendlyname),
    version: normalizeString(row.version),
    isManaged: normalizeBoolean(row.ismanaged)
  };
}

async function getDataverseList(client: DataverseClient, token: string, query: string): Promise<Array<Record<string, unknown>>> {
  const response = await client.get(query, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as ODataListResponse;
  return Array.isArray(response.value) ? response.value : [];
}

async function loadEntityMetadataId(client: DataverseClient, token: string, logicalName: string): Promise<string | undefined> {
  const result = await client.get(
    `/EntityDefinitions(LogicalName='${escapeODataString(logicalName)}')?$select=MetadataId,LogicalName`,
    token,
    { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }
  ) as Record<string, unknown>;

  return normalizeGuidLike(result.MetadataId);
}

async function loadSolutionsByIds(client: DataverseClient, token: string, solutionIds: string[]): Promise<SolutionDetail[]> {
  const uniqueIds = Array.from(new Set(solutionIds.map((id) => id.toLowerCase()))).slice(0, SOLUTION_LOOKUP_TOP);

  const rows = await Promise.all(uniqueIds.map(async (id) => {
    try {
      const solution = await client.get(
        `/solutions(${id})?$select=solutionid,uniquename,friendlyname,ismanaged,version`,
        token,
        { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }
      ) as Record<string, unknown>;
      return toSolutionDetail(solution);
    } catch {
      return { id } satisfies SolutionDetail;
    }
  }));

  return rankSolutionsForOperationalSignal(rows);
}

async function loadSolutionParticipation(client: DataverseClient, token: string, logicalName: string): Promise<{
  metadataId?: string;
  componentCount: number;
  solutions: SolutionDetail[];
  queries: string[];
}> {
  const metadataQuery = `/EntityDefinitions(LogicalName='${escapeODataString(logicalName)}')?$select=MetadataId,LogicalName`;
  const metadataId = await loadEntityMetadataId(client, token, logicalName);
  if (!metadataId) {
    return { componentCount: 0, solutions: [], queries: [metadataQuery] };
  }

  const componentFilter = `objectid eq ${metadataId} and componenttype eq ${ENTITY_COMPONENT_TYPE}`;
  const componentQuery = `/solutioncomponents?$select=solutioncomponentid,componenttype,objectid,_solutionid_value&$filter=${encodeURIComponent(componentFilter)}&$top=${SOLUTION_LOOKUP_TOP}`;
  const components = await getDataverseList(client, token, componentQuery);
  const solutionIds = components
    .map((row) => getLookupId(row, "solutionid"))
    .filter((id): id is string => !!id);

  const solutions = await loadSolutionsByIds(client, token, solutionIds);
  const solutionQueries = Array.from(new Set(solutionIds.map((id) => `/solutions(${id})?$select=solutionid,uniquename,friendlyname,ismanaged,version`)));

  return {
    metadataId,
    componentCount: components.length,
    solutions,
    queries: [metadataQuery, componentQuery, ...solutionQueries]
  };
}

function createFallbackSolutionEvidence(request: OperationalContextProviderRequest, logicalName: string): OperationalContextEvidence {
  return {
    subject: request.subject,
    evidenceType: "SolutionParticipation",
    title: "Solution package context can be checked",
    summary: `${subjectLabel(request)} can be checked against Dataverse solution metadata to identify package/layering context. This is contextual evidence only: it does not mean a solution caused any runtime behaviour.`,
    source: "metadata",
    scope: "oneHopRelated",
    confidence: "related",
    raw: {
      logicalName,
      defaultExpansionDepth: request.maxExpansionDepth,
      semanticExpansion: "solutioncomponent → solution",
      evidenceTable: "solutioncomponent",
      meaning: "solutioncomponent links Dataverse components to solution packages; solution provides the package name, managed state, and version.",
      runnable: false,
      note: "This is contextual metadata. Use a dedicated evidence-path action for further user-triggered exploration; do not treat it as a runnable operation."
    }
  };
}

export class SolutionContextProvider implements OperationalContextProvider {
  public readonly id = "solutionContext";
  public readonly label = "Solution Context";

  public async collect(request: OperationalContextProviderRequest) {
    if (!hasEntitySubject(request)) {
      return createOperationalContextProviderResult({
        providerId: this.id,
        label: this.label,
        unavailableReason: "Solution Context needs an entity or capability subject before it can look for solution participation evidence."
      });
    }

    const logicalName = request.subject.logicalName?.trim() ?? "";
    const client = request.dataverse?.client;
    const token = request.dataverse?.token;

    if (!client || !token) {
      return createOperationalContextProviderResult({
        providerId: this.id,
        label: this.label,
        evidence: [createFallbackSolutionEvidence(request, logicalName)]
      });
    }

    try {
      const participation = await loadSolutionParticipation(client, token, logicalName);
      const evidence: OperationalContextEvidence[] = [];

      if (participation.solutions.length > 0) {
        evidence.push({
          subject: request.subject,
          evidenceType: "SolutionParticipation",
          title: "Observed solution package participation",
          summary: `The bounded lookup observed ${participation.solutions.length} solution package participation record${participation.solutions.length === 1 ? "" : "s"} for ${subjectLabel(request)}. Highest-signal observed packages shown: ${formatSolutionList(displayedSolutions(participation.solutions))}. ${participation.solutions.length > SOLUTION_CONTEXT_DISPLAY_LIMIT ? "Additional observed packages are available in raw evidence. " : ""}Additional solution participation may exist outside this bounded result set. This is useful deployment/layering context only; participation does not imply deployment causality.`,
          source: "dataverse",
          scope: "oneHopRelated",
          confidence: "direct",
          emphasis: participation.solutions.some((solution) => solution.isManaged === true) ? "notable" : "neutral",
          query: participation.queries.join(" | "),
          raw: {
            logicalName,
            defaultExpansionDepth: request.maxExpansionDepth,
            semanticExpansion: "solutioncomponent → solution",
            entityMetadataId: participation.metadataId,
            componentType: ENTITY_COMPONENT_TYPE,
            observedComponentCount: participation.componentCount,
            resultLimit: SOLUTION_LOOKUP_TOP,
            displayLimit: SOLUTION_CONTEXT_DISPLAY_LIMIT,
            ranking: "Highest-signal observed solutions are ranked ahead of generic System/Default/Microsoft base layers. This is prioritisation only, not causality.",
            resultSetComplete: participation.componentCount < SOLUTION_LOOKUP_TOP,
            solutions: participation.solutions,
            displayedSolutions: displayedSolutions(participation.solutions),
            runnable: false,
            note: "DV Quick Run followed one curated evidence path to name observed solution packages. This is not a generic topology crawl. When the observed count equals the result limit, more participation may exist."
          }
        });
      } else {
        evidence.push({
          subject: request.subject,
          evidenceType: "SolutionParticipation",
          title: "No direct solution package participation returned",
          summary: `${subjectLabel(request)} did not return direct solution package participation from the bounded solutioncomponent lookup. This does not prove there is no layering context; it only means this pass did not observe a direct package link.`,
          source: "dataverse",
          scope: "oneHopRelated",
          confidence: "unknown",
          query: participation.queries.join(" | "),
          raw: {
            logicalName,
            defaultExpansionDepth: request.maxExpansionDepth,
            semanticExpansion: "solutioncomponent → solution",
            entityMetadataId: participation.metadataId,
            observedComponentCount: participation.componentCount,
            resultLimit: SOLUTION_LOOKUP_TOP,
            resultSetComplete: participation.componentCount < SOLUTION_LOOKUP_TOP,
            runnable: false,
            note: "No direct solution records were returned by the bounded evidence lookup."
          }
        });
      }

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    } catch (error) {
      const fallback = createFallbackSolutionEvidence(request, logicalName);
      fallback.title = "Solution package details unavailable";
      fallback.summary = `${subjectLabel(request)} may have solution package context, but DV Quick Run could not complete the bounded solutioncomponent → solution lookup. The card remains contextual and non-runnable.`;
      fallback.raw = {
        ...(typeof fallback.raw === "object" && fallback.raw ? fallback.raw : {}),
        lookupError: error instanceof Error ? error.message : String(error)
      };

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence: [fallback] });
    }
  }
}


const ACCESS_ROLE_TOP = 100;
const ACCESS_TEAM_TOP = 100;
const ACCESS_TEAM_ROLE_TOP = 100;
const ACCESS_CONTEXT_DISPLAYED_BY_DEFAULT = 8;

function roleName(row: Record<string, unknown>): string {
  return normalizeString(row.name) ?? normalizeString(row.uniquename) ?? normalizeGuidLike(row.roleid) ?? "Unnamed role";
}

function teamName(row: Record<string, unknown>): string {
  return normalizeString(row.name) ?? normalizeGuidLike(row.teamid) ?? "Unnamed team";
}

function teamTypeLabel(value: unknown): string | undefined {
  const text = normalizeNumberLike(value);
  if (!text) {
    return undefined;
  }

  const known: Record<string, string> = {
    "0": "Owner team",
    "1": "Access team",
    "2": "AAD security group team",
    "3": "AAD office group team"
  };
  return known[text] ?? `Team type ${text}`;
}

function accessModeLabel(value: unknown): string | undefined {
  const text = normalizeNumberLike(value);
  if (!text) {
    return undefined;
  }

  const known: Record<string, string> = {
    "0": "Read-write",
    "1": "Administrative",
    "2": "Read",
    "3": "Support user",
    "4": "Non-interactive",
    "5": "Delegated admin"
  };
  return known[text] ?? `Access mode ${text}`;
}

function classifyPrincipal(row: Record<string, unknown>, fallback: "user" | "team" = "user"): AccessPrincipalType {
  if (fallback === "team") {
    return "Team Context";
  }

  const id = normalizeString(row.systemuserid)?.toLowerCase();
  const name = `${normalizeString(row.fullname) ?? ""} ${normalizeString(row.domainname) ?? ""}`.toLowerCase();
  if (id === "00000000-0000-0000-0000-000000000000" || name.includes("system")) {
    return "SYSTEM Context";
  }

  if (normalizeString(row.applicationid)) {
    return "Application User";
  }

  const accessMode = normalizeNumberLike(row.accessmode);
  if (accessMode === "4") {
    return "Service Principal Context";
  }

  return "Human User";
}

function toPrincipalSummary(row: Record<string, unknown>): PrincipalSummary {
  const isTeam = !!normalizeString(row.teamid);
  const isRole = !!normalizeString(row.roleid);
  const isBusinessUnit = !!normalizeString(row.businessunitid) && !isTeam && !isRole;
  return {
    id: normalizeGuidLike(row.systemuserid ?? row.teamid ?? row.roleid ?? row.businessunitid),
    displayName: normalizeString(row.fullname) ?? normalizeString(row.name),
    uniqueName: normalizeString(row.domainname),
    principalType: isBusinessUnit ? "Business Unit Context" : (isRole ? "Role Context" : (isTeam ? "Team Context" : classifyPrincipal(row))),
    isDisabled: normalizeBoolean(row.isdisabled),
    accessMode: accessModeLabel(row.accessmode),
    applicationId: normalizeString(row.applicationid),
    azureObjectId: normalizeString(row.azureactivedirectoryobjectid),
    businessUnitId: getLookupId(row, "businessunitid")
  };
}

function toAccessRole(row: Record<string, unknown>, source: "direct" | "team", team?: TeamMembership): AccessRole {
  return {
    roleId: normalizeGuidLike(row.roleid),
    roleName: roleName(row),
    businessUnitId: getLookupId(row, "businessunitid"),
    source,
    sourceTeamId: team?.teamId,
    sourceTeamName: team?.teamName
  };
}

function toTeamMembership(row: Record<string, unknown>): TeamMembership {
  return {
    teamId: normalizeGuidLike(row.teamid),
    teamName: teamName(row),
    teamType: teamTypeLabel(row.teamtype),
    businessUnitId: getLookupId(row, "businessunitid"),
    inheritedRoles: []
  };
}

function toTeamMemberSummary(row: Record<string, unknown>): TeamMemberSummary {
  return {
    userId: normalizeGuidLike(row.systemuserid),
    displayName: normalizeString(row.fullname) ?? normalizeString(row.domainname) ?? normalizeGuidLike(row.systemuserid) ?? "Unnamed team member",
    uniqueName: normalizeString(row.domainname),
    principalType: classifyPrincipal(row),
    isDisabled: normalizeBoolean(row.isdisabled),
    accessMode: accessModeLabel(row.accessmode),
    businessUnitId: getLookupId(row, "businessunitid"),
    applicationId: normalizeString(row.applicationid),
    azureObjectId: normalizeString(row.azureactivedirectoryobjectid)
  };
}

function accessEvidenceSearchText(context: AccessContextDetail): string {
  return [
    context.principalSummary.displayName,
    context.principalSummary.uniqueName,
    context.principalSummary.principalType,
    context.principalSummary.accessMode,
    context.directRoles.map((role) => role.roleName).join(" "),
    context.teamMemberships.map((team) => `${team.teamName} ${team.teamType ?? ""}`).join(" "),
    context.teamMembers.map((member) => `${member.displayName} ${member.uniqueName ?? ""} ${member.principalType ?? ""}`).join(" "),
    context.roleUsers.map((member) => `${member.displayName} ${member.uniqueName ?? ""} ${member.principalType ?? ""}`).join(" "),
    context.roleTeams.map((team) => `${team.teamName} ${team.teamType ?? ""}`).join(" "),
    context.businessUnitSummary ? `${context.businessUnitSummary.name ?? ""} ${context.businessUnitSummary.parentBusinessUnitName ?? ""} ${context.businessUnitSummary.userParticipationCount ?? ""} ${context.businessUnitSummary.teamParticipationCount ?? ""} ${context.businessUnitSummary.applicationUserParticipationCount ?? ""} ${context.businessUnitSummary.roleParticipationCount ?? ""}` : undefined,
    context.keySignals?.join(" "),
    context.businessUnitRoleGroups?.map((group) => `${group.groupName} ${group.roles.map((role) => role.roleName).join(" ")}`).join(" "),
    context.inheritedRoles.map((role) => `${role.roleName} ${role.sourceTeamName ?? ""}`).join(" "),
    context.evidence.map((item) => `${item.sourceDisplayName} ${item.relationshipType} ${item.evidenceDescription}`).join(" ")
  ].filter((value): value is string => !!value).join(" ").toLowerCase();
}

function createAccessEvidence(context: AccessContextDetail): AccessEvidenceDetail[] {
  const evidence: AccessEvidenceDetail[] = [];
  const principalName = context.principalSummary.displayName ?? context.principalSummary.uniqueName ?? context.principalSummary.id ?? "Selected principal";

  evidence.push({
    sourceType: "principal",
    sourceId: context.principalSummary.id,
    sourceDisplayName: principalName,
    relationshipType: "principal summary",
    evidenceDescription: `${context.principalSummary.principalType} identity observed.`,
    rawContext: context.principalSummary
  });

  for (const role of context.directRoles) {
    evidence.push({
      sourceType: "directRole",
      sourceId: role.roleId,
      sourceDisplayName: role.roleName,
      relationshipType: "direct role assignment",
      evidenceDescription: "Observed direct role participation.",
      rawContext: role
    });
  }

  for (const team of context.teamMemberships) {
    evidence.push({
      sourceType: "teamMembership",
      sourceId: team.teamId,
      sourceDisplayName: team.teamName,
      relationshipType: "team membership",
      evidenceDescription: `Observed ${team.teamType ?? "team"} membership.`,
      rawContext: team
    });
  }

  for (const member of context.teamMembers) {
    evidence.push({
      sourceType: "teamMember",
      sourceId: member.userId,
      sourceDisplayName: member.displayName,
      relationshipType: "team member participation",
      evidenceDescription: `Observed ${member.principalType ?? "team member"} participation in the selected team.`,
      rawContext: member
    });
  }

  for (const member of context.roleUsers) {
    evidence.push({
      sourceType: "roleUser",
      sourceId: member.userId,
      sourceDisplayName: member.displayName,
      relationshipType: "direct user role participation",
      evidenceDescription: `Observed ${member.principalType ?? "user"} participation through the selected role.`,
      rawContext: member
    });
  }

  for (const team of context.roleTeams) {
    evidence.push({
      sourceType: "roleTeam",
      sourceId: team.teamId,
      sourceDisplayName: team.teamName,
      relationshipType: "team role participation",
      evidenceDescription: `Observed ${team.teamType ?? "team"} participation through the selected role.`,
      rawContext: team
    });
  }

  for (const role of context.inheritedRoles) {
    evidence.push({
      sourceType: "inheritedTeamRole",
      sourceId: role.roleId,
      sourceDisplayName: role.roleName,
      relationshipType: "inherited team role",
      evidenceDescription: `Observed role participation through team ${role.sourceTeamName ?? "unknown team"}.`,
      rawContext: role
    });
  }

  if (context.businessUnitSummary) {
    evidence.push({
      sourceType: "businessUnit",
      sourceId: context.businessUnitSummary.businessUnitId,
      sourceDisplayName: context.businessUnitSummary.name ?? principalName,
      relationshipType: "business unit summary",
      evidenceDescription: "Observed bounded business unit structural participation summary.",
      rawContext: context.businessUnitSummary
    });

    if (context.businessUnitSummary.parentBusinessUnitName) {
      evidence.push({
        sourceType: "businessUnit",
        sourceId: context.businessUnitSummary.parentBusinessUnitId,
        sourceDisplayName: context.businessUnitSummary.parentBusinessUnitName,
        relationshipType: "parent business unit",
        evidenceDescription: "Observed parent business unit reference. Hierarchy is not recursively expanded.",
        rawContext: context.businessUnitSummary
      });
    }
  }

  return evidence;
}

async function loadBusinessUnitName(client: DataverseClient, token: string, businessUnitId: string | undefined, queryLog: string[]): Promise<string | undefined> {
  if (!businessUnitId) {
    return undefined;
  }
  const query = `/businessunits(${businessUnitId})?$select=businessunitid,name,_parentbusinessunitid_value`;
  queryLog.push(query);
  try {
    const row = await client.get(query, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
    return normalizeString(row.name);
  } catch {
    return undefined;
  }
}

async function loadPrincipalAccessContext(client: DataverseClient, token: string, principalId: string): Promise<AccessContextDetail> {
  const queryLog: string[] = [];
  const principalQuery = `/systemusers(${principalId})?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value`;
  queryLog.push(principalQuery);
  const principalRow = await client.get(principalQuery, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
  const principalSummary = toPrincipalSummary(principalRow);
  principalSummary.businessUnitName = await loadBusinessUnitName(client, token, principalSummary.businessUnitId, queryLog);

  const directRolesQuery = `/systemusers(${principalId})/systemuserroles_association?$select=roleid,name,_businessunitid_value&$top=${ACCESS_ROLE_TOP}`;
  queryLog.push(directRolesQuery);
  const directRoles = (await getDataverseList(client, token, directRolesQuery)).map((row) => toAccessRole(row, "direct"));

  const teamsQuery = `/systemusers(${principalId})/teammembership_association?$select=teamid,name,teamtype,_businessunitid_value&$top=${ACCESS_TEAM_TOP}`;
  queryLog.push(teamsQuery);
  const teamMemberships = (await getDataverseList(client, token, teamsQuery)).map(toTeamMembership);

  const inheritedRoles: AccessRole[] = [];
  for (const team of teamMemberships) {
    if (!team.teamId) {
      continue;
    }
    const teamRolesQuery = `/teams(${team.teamId})/teamroles_association?$select=roleid,name,_businessunitid_value&$top=${ACCESS_TEAM_ROLE_TOP}`;
    queryLog.push(teamRolesQuery);
    try {
      const teamRoles = (await getDataverseList(client, token, teamRolesQuery)).map((row) => toAccessRole(row, "team", team));
      team.inheritedRoles = teamRoles;
      inheritedRoles.push(...teamRoles);
    } catch {
      team.inheritedRoles = [];
    }
  }

  const topologySummary = accessTopologySummary(principalSummary, directRoles, teamMemberships, inheritedRoles);
  const context: AccessContextDetail = {
    subjectKind: "systemuser",
    principalSummary,
    directRoles,
    teamMemberships,
    teamMembers: [],
    roleUsers: [],
    roleTeams: [],
    inheritedRoles,
    evidence: [],
    operationalSignificance: accessOperationalSignificance(principalSummary, directRoles, teamMemberships, inheritedRoles),
    topologySummary,
    queryLog,
    limits: {
      roleTop: ACCESS_ROLE_TOP,
      teamTop: ACCESS_TEAM_TOP,
      teamRoleTop: ACCESS_TEAM_ROLE_TOP,
      teamMemberTop: ACCESS_TEAM_MEMBER_TOP,
      displayedByDefault: ACCESS_CONTEXT_DISPLAYED_BY_DEFAULT
    },
    searchHint: "Search is local to the Access Context evidence currently loaded."
  };
  context.evidence = createAccessEvidence(context);
  return context;
}


async function loadTeamAccessContext(client: DataverseClient, token: string, teamId: string): Promise<AccessContextDetail> {
  const queryLog: string[] = [];
  const teamQuery = `/teams(${teamId})?$select=teamid,name,teamtype,_businessunitid_value,azureactivedirectoryobjectid,isdefault`;
  queryLog.push(teamQuery);
  const teamRow = await client.get(teamQuery, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
  const principalSummary = toPrincipalSummary(teamRow);
  principalSummary.businessUnitName = await loadBusinessUnitName(client, token, principalSummary.businessUnitId, queryLog);

  const team: TeamMembership = {
    teamId: principalSummary.id,
    teamName: principalSummary.displayName ?? "Selected team",
    teamType: teamTypeLabel(teamRow.teamtype),
    businessUnitId: principalSummary.businessUnitId,
    inheritedRoles: []
  };

  const teamRolesQuery = `/teams(${teamId})/teamroles_association?$select=roleid,name,_businessunitid_value&$top=${ACCESS_TEAM_ROLE_TOP}`;
  queryLog.push(teamRolesQuery);
  const directRoles = (await getDataverseList(client, token, teamRolesQuery)).map((row) => toAccessRole(row, "team", team));
  team.inheritedRoles = directRoles;

  const teamMembersQuery = `/teams(${teamId})/teammembership_association?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value&$top=${ACCESS_TEAM_MEMBER_TOP}`;
  queryLog.push(teamMembersQuery);
  let teamMembers: TeamMemberSummary[] = [];
  try {
    teamMembers = (await getDataverseList(client, token, teamMembersQuery)).map(toTeamMemberSummary);
  } catch {
    teamMembers = [];
  }

  const inheritedRoles: AccessRole[] = [];
  const topologySummary = teamAccessTopologySummary(principalSummary, directRoles, teamMembers);
  const context: AccessContextDetail = {
    subjectKind: "team",
    principalSummary,
    directRoles,
    teamMemberships: [],
    teamMembers,
    roleUsers: [],
    roleTeams: [],
    inheritedRoles,
    evidence: [],
    operationalSignificance: teamAccessOperationalSignificance(principalSummary, directRoles, teamMembers),
    topologySummary,
    queryLog,
    limits: {
      roleTop: ACCESS_ROLE_TOP,
      teamTop: ACCESS_TEAM_TOP,
      teamRoleTop: ACCESS_TEAM_ROLE_TOP,
      teamMemberTop: ACCESS_TEAM_MEMBER_TOP,
      displayedByDefault: ACCESS_CONTEXT_DISPLAYED_BY_DEFAULT
    },
    searchHint: "Search is local to the Team Access Context evidence currently loaded."
  };
  context.evidence = createAccessEvidence(context);
  return context;
}

async function loadRoleAccessContext(client: DataverseClient, token: string, roleId: string): Promise<AccessContextDetail> {
  const queryLog: string[] = [];
  const roleQuery = `/roles(${roleId})?$select=roleid,name,_businessunitid_value`;
  queryLog.push(roleQuery);
  const roleRow = await client.get(roleQuery, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
  const principalSummary = toPrincipalSummary(roleRow);
  principalSummary.businessUnitName = await loadBusinessUnitName(client, token, principalSummary.businessUnitId, queryLog);

  const roleUsersQuery = `/roles(${roleId})/systemuserroles_association?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value&$top=${ACCESS_ROLE_TOP}`;
  queryLog.push(roleUsersQuery);
  let roleUsers: TeamMemberSummary[] = [];
  try {
    roleUsers = (await getDataverseList(client, token, roleUsersQuery)).map(toTeamMemberSummary);
  } catch {
    roleUsers = [];
  }

  const roleTeamsQuery = `/roles(${roleId})/teamroles_association?$select=teamid,name,teamtype,_businessunitid_value&$top=${ACCESS_TEAM_TOP}`;
  queryLog.push(roleTeamsQuery);
  let roleTeams: TeamMembership[] = [];
  try {
    roleTeams = (await getDataverseList(client, token, roleTeamsQuery)).map(toTeamMembership);
  } catch {
    roleTeams = [];
  }

  const topologySummary = roleAccessTopologySummary(principalSummary, roleUsers, roleTeams);
  const context: AccessContextDetail = {
    subjectKind: "role",
    principalSummary,
    directRoles: [],
    teamMemberships: [],
    teamMembers: [],
    roleUsers,
    roleTeams,
    inheritedRoles: [],
    evidence: [],
    operationalSignificance: roleAccessOperationalSignificance(principalSummary, roleUsers, roleTeams),
    topologySummary,
    queryLog,
    limits: {
      roleTop: ACCESS_ROLE_TOP,
      teamTop: ACCESS_TEAM_TOP,
      teamRoleTop: ACCESS_TEAM_ROLE_TOP,
      teamMemberTop: ACCESS_TEAM_MEMBER_TOP,
      displayedByDefault: ACCESS_CONTEXT_DISPLAYED_BY_DEFAULT
    },
    searchHint: "Search is local to the Role Access Context evidence currently loaded."
  };
  context.evidence = createAccessEvidence(context);
  return context;
}


function roleAccessTopologySummary(
  principalSummary: PrincipalSummary,
  roleUsers: readonly TeamMemberSummary[],
  roleTeams: readonly TeamMembership[]
): string {
  const role = principalSummary.displayName ?? principalSummary.id ?? "Selected role";
  const bu = principalSummary.businessUnitName ? ` Business unit: ${principalSummary.businessUnitName}.` : "";
  const identitySummary = roleUsers.length > 0
    ? ` Direct user identity composition: ${summarizeTeamMemberCounts(countTeamMembersBy(roleUsers, (member) => member.principalType ?? "Unknown principal type"))}.`
    : "";
  const teamTypeSummary = roleTeams.length > 0
    ? ` Team composition: ${summarizeTeamMemberCounts(countTeamMembershipsBy(roleTeams, (team) => team.teamType ?? "team type not returned"))}.`
    : "";
  return `${role}: ${roleUsers.length} direct user participant${roleUsers.length === 1 ? "" : "s"}; ${roleTeams.length} team participant${roleTeams.length === 1 ? "" : "s"}.${bu}${identitySummary}${teamTypeSummary}`;
}

function roleAccessOperationalSignificance(
  principalSummary: PrincipalSummary,
  roleUsers: readonly TeamMemberSummary[],
  roleTeams: readonly TeamMembership[]
): string {
  const role = principalSummary.displayName ?? principalSummary.id ?? "Selected role";
  const bu = principalSummary.businessUnitName ? ` in business unit ${principalSummary.businessUnitName}` : "";
  const appUserCount = roleUsers.filter((member) => (member.principalType ?? "").toLowerCase().includes("application")).length;
  const humanCount = roleUsers.filter((member) => (member.principalType ?? "").toLowerCase().includes("human")).length;
  const teamCountText = `${roleTeams.length} team participant${roleTeams.length === 1 ? "" : "s"}`;
  const userCountText = `${roleUsers.length} direct user participant${roleUsers.length === 1 ? "" : "s"}`;

  if (roleUsers.length === 0 && roleTeams.length === 0) {
    return `${role} is shown as Role Context${bu}, with no direct user or team participation returned in this bounded lookup. This provides role participation orientation without implying effective access or privilege evaluation.`;
  }

  if (appUserCount > 0 && appUserCount / Math.max(roleUsers.length, 1) >= 0.75) {
    return `${role} is shown as Role Context${bu}. Observed direct user participation is mostly application/service identity based (${appUserCount} of ${roleUsers.length} observed direct users), alongside ${teamCountText}. This provides bounded role participation orientation without proving effective access.`;
  }

  if (humanCount > 0) {
    return `${role} is shown as Role Context${bu}, with ${humanCount} human user participant${humanCount === 1 ? "" : "s"}, ${roleUsers.length - humanCount} other direct user participant${roleUsers.length - humanCount === 1 ? "" : "s"}, and ${teamCountText}. This highlights observed role participation, not privilege authority.`;
  }

  return `${role} is shown as Role Context${bu}, with ${userCountText} and ${teamCountText}. This provides role participation orientation for the current investigation without simulating privileges or effective access.`;
}

function countTeamMembershipsBy(teamMemberships: readonly TeamMembership[], keySelector: (team: TeamMembership) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const team of teamMemberships) {
    const key = keySelector(team);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function countTeamMembersBy(teamMembers: readonly TeamMemberSummary[], keySelector: (member: TeamMemberSummary) => string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const member of teamMembers) {
    const key = keySelector(member);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function summarizeTeamMemberCounts(counts: Map<string, number>): string {
  return Array.from(counts.entries())
    .sort(([leftKey, leftCount], [rightKey, rightCount]) => rightCount - leftCount || leftKey.localeCompare(rightKey))
    .map(([key, count]) => `${count} ${key}`)
    .join(", ");
}

function teamAccessTopologySummary(
  principalSummary: PrincipalSummary,
  directRoles: readonly AccessRole[],
  teamMembers: readonly TeamMemberSummary[]
): string {
  const team = principalSummary.displayName ?? principalSummary.id ?? "Selected team";
  const bu = principalSummary.businessUnitName ? ` Business unit: ${principalSummary.businessUnitName}.` : "";
  const identitySummary = teamMembers.length > 0
    ? ` Identity composition: ${summarizeTeamMemberCounts(countTeamMembersBy(teamMembers, (member) => member.principalType ?? "Unknown principal type"))}.`
    : "";
  const accessModeSummary = teamMembers.length > 0
    ? ` Access mode composition: ${summarizeTeamMemberCounts(countTeamMembersBy(teamMembers, (member) => member.accessMode ?? "access mode not returned"))}.`
    : "";
  return `${team}: ${directRoles.length} direct team role${directRoles.length === 1 ? "" : "s"}; ${teamMembers.length} bounded member participation record${teamMembers.length === 1 ? "" : "s"}.${bu}${identitySummary}${accessModeSummary}`;
}

function teamAccessOperationalSignificance(
  principalSummary: PrincipalSummary,
  directRoles: readonly AccessRole[],
  teamMembers: readonly TeamMemberSummary[]
): string {
  const team = principalSummary.displayName ?? principalSummary.id ?? "Selected team";
  const bu = principalSummary.businessUnitName ? ` in business unit ${principalSummary.businessUnitName}` : "";
  const roleDescription = describeRoleSet(directRoles);
  const appUserCount = teamMembers.filter((member) => (member.principalType ?? "").toLowerCase().includes("application")).length;
  const nonInteractiveCount = teamMembers.filter((member) => (member.accessMode ?? "").toLowerCase().includes("non-interactive")).length;
  const readWriteCount = teamMembers.filter((member) => (member.accessMode ?? "").toLowerCase().includes("read-write")).length;

  if (directRoles.length === 0 && teamMembers.length === 0) {
    return `${team} is shown as ${principalSummary.principalType}${bu}, with no direct team roles or member participation returned in this bounded lookup. This provides team access-topology orientation without implying effective access.`;
  }

  if (appUserCount > 0 && appUserCount / Math.max(teamMembers.length, 1) >= 0.75) {
    const readWriteNote = readWriteCount > 0 ? ` ${readWriteCount} read-write member${readWriteCount === 1 ? "" : "s"} appear as notable participation.` : "";
    return `${team} is shown as ${principalSummary.principalType}${bu}. Observed member participation is mostly application/service identity based (${appUserCount} of ${teamMembers.length} observed members), with ${nonInteractiveCount} non-interactive member${nonInteractiveCount === 1 ? "" : "s"}.${readWriteNote} This provides bounded team participation orientation without proving effective access.`;
  }

  if (directRoles.length === 0) {
    return `${team} is shown as ${principalSummary.principalType}${bu}, with observed bounded member participation and no direct team roles returned in this lookup. This helps explain nearby team participation without proving effective access.`;
  }

  return `${team} is shown as ${principalSummary.principalType}${bu} with ${roleDescription} and ${teamMembers.length} bounded member participation record${teamMembers.length === 1 ? "" : "s"}. This provides team access-topology orientation for the current investigation without proving effective access.`;
}

function roleNames(roles: readonly AccessRole[]): string[] {
  return roles.map((role) => role.roleName).filter((name) => name.trim().length > 0);
}

function hasRoleContaining(roles: readonly AccessRole[], fragments: readonly string[]): boolean {
  const normalized = roleNames(roles).map((name) => name.toLowerCase());
  return normalized.some((role) => fragments.some((fragment) => role.includes(fragment)));
}

function accessTopologySummary(
  principalSummary: PrincipalSummary,
  directRoles: readonly AccessRole[],
  teamMemberships: readonly TeamMembership[],
  inheritedRoles: readonly AccessRole[]
): string {
  const principal = principalSummary.displayName ?? principalSummary.uniqueName ?? principalSummary.id ?? "Selected principal";
  const bu = principalSummary.businessUnitName ? ` in business unit ${principalSummary.businessUnitName}` : "";
  return `${principal} is shown as ${principalSummary.principalType}${bu}. Observed access topology includes ${directRoles.length} direct role${directRoles.length === 1 ? "" : "s"}, ${teamMemberships.length} team membership${teamMemberships.length === 1 ? "" : "s"}, and ${inheritedRoles.length} inherited team role${inheritedRoles.length === 1 ? "" : "s"}.`;
}

function describeRoleSet(roles: readonly AccessRole[]): string {
  const names = roleNames(roles);
  if (names.length === 0) {
    return "no direct roles observed";
  }

  if (names.length === 1) {
    return `${names[0]} role`;
  }

  if (names.length <= 3) {
    const allButLast = names.slice(0, -1).join(", ");
    return `${allButLast} and ${names[names.length - 1]} roles`;
  }

  return `${names.length} direct roles, including ${names.slice(0, 3).join(", ")}`;
}

function accessOperationalSignificance(
  principalSummary: PrincipalSummary,
  directRoles: readonly AccessRole[],
  teamMemberships: readonly TeamMembership[],
  inheritedRoles: readonly AccessRole[]
): string {
  const principal = principalSummary.displayName ?? principalSummary.uniqueName ?? principalSummary.id ?? "Selected principal";
  const roleDescription = describeRoleSet(directRoles);
  const principalType = principalSummary.principalType;
  const accessMode = principalSummary.accessMode ? ` with ${principalSummary.accessMode.toLowerCase()} access mode` : "";

  if (hasRoleContaining(directRoles, ["system administrator", "administrator"])) {
    return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. This suggests broad administrative operational reach in this environment.`;
  }

  if (hasRoleContaining(directRoles, ["flow", "power automate", "workflow"])) {
    return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. This appears aligned to automation or flow-related platform operations rather than broad interactive user activity.`;
  }

  if (hasRoleContaining(directRoles, ["ai", "aib", "builder", "machine", "ml"])) {
    return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. This appears aligned to AI Builder or platform service operations.`;
  }

  if (hasRoleContaining(directRoles, ["sync", "data sync", "integration", "service reader", "service writer", "datalake", "data lake"])) {
    return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. This appears aligned to integration, synchronization, or service-to-service operations.`;
  }

  if (directRoles.length === 0 && inheritedRoles.length === 0 && teamMemberships.length > 0) {
    return `${principal} participates as ${principalType}${accessMode} through observed team membership, with no direct or inherited team roles returned in this lookup. This gives identity-topology orientation without implying effective access.`;
  }

  if (directRoles.length >= 5) {
    return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. Multiple role associations suggest broader operational participation across platform capabilities.`;
  }

  return `${principal} participates as ${principalType}${accessMode} with ${roleDescription}. This provides access-topology orientation for the current investigation.`;
}

function classifyBusinessUnitRoleName(roleName: string): string {
  const lower = roleName.toLowerCase();

  if (lower.includes("copilot") || lower.includes("ai") || lower.includes("prompt") || lower.includes("agent")) {
    return "AI / Copilot Roles";
  }

  if (lower.includes("sync") || lower.includes("flow") || lower.includes("integration") || lower.includes("orchestration") || lower.includes("connector") || lower.includes("deployment")) {
    return "Automation / Integration Roles";
  }

  if (lower.includes("data") || lower.includes("analytics") || lower.includes("lake") || lower.includes("search") || lower.includes("power bi") || lower.includes("report")) {
    return "Data / Analytics Roles";
  }

  if (lower.includes("service") || lower.includes("platform") || lower.includes("app access") || lower.includes("system") || lower.includes("dataverse")) {
    return "Microsoft / Platform Service Roles";
  }

  if (lower.includes("sales") || lower.includes("customer") || lower.includes("knowledge") || lower.includes("support") || lower.includes("maker") || lower.includes("delegate")) {
    return "Human-facing / Business Roles";
  }

  return "Custom / Organizational Roles";
}

function buildBusinessUnitRoleGroups(roles: readonly AccessRole[]): BusinessUnitRoleGroup[] {
  const groups: Record<string, AccessRole[]> = {
    "Microsoft / Platform Service Roles": [],
    "Automation / Integration Roles": [],
    "AI / Copilot Roles": [],
    "Data / Analytics Roles": [],
    "Human-facing / Business Roles": [],
    "Custom / Organizational Roles": []
  };

  for (const role of roles) {
    groups[classifyBusinessUnitRoleName(role.roleName ?? "Unnamed role")].push(role);
  }

  return Object.entries(groups)
    .filter(([, groupedRoles]) => groupedRoles.length > 0)
    .map(([groupName, groupedRoles]) => ({ groupName, roles: groupedRoles }));
}

function buildBusinessUnitKeySignals(businessUnit: BusinessUnitSummary, roles: readonly AccessRole[], teams: readonly TeamMembership[]): string[] {
  const signals: string[] = [];
  const roleCount = businessUnit.roleParticipationCount ?? roles.length;
  const applicationUserCount = businessUnit.applicationUserParticipationCount ?? 0;
  const teamCount = businessUnit.teamParticipationCount ?? teams.length;
  const roleNames = roles.map((role) => role.roleName ?? "");

  if (applicationUserCount >= 25) {
    signals.push(`${applicationUserCount} automation-oriented identities observed in this bounded lookup.`);
  }

  if (roleCount >= 25) {
    signals.push(`${roleCount} role participants observed; role grouping is heuristic and for orientation only.`);
  }

  if (teamCount > 0) {
    signals.push(`${teamCount} team participants observed near this business unit.`);
  }

  if (roleNames.some((name) => name.toLowerCase().includes("system administrator"))) {
    signals.push("System Administrator role participation is present in the bounded role set.");
  }

  if (roleNames.some((name) => /copilot|ai|agent|prompt/i.test(name))) {
    signals.push("AI/Copilot-oriented role participation is present.");
  }

  if (roleNames.some((name) => /flow|sync|connector|orchestration|automation/i.test(name))) {
    signals.push("Automation/integration-oriented role participation is present.");
  }

  return signals.slice(0, 5);
}

function businessUnitAccessTopologySummary(businessUnit: BusinessUnitSummary): string {
  const name = businessUnit.name ?? businessUnit.businessUnitId ?? "Selected business unit";
  const parent = businessUnit.parentBusinessUnitName ? ` Parent business unit: ${businessUnit.parentBusinessUnitName}.` : "";
  return `${name}: ${businessUnit.childBusinessUnitCount ?? 0} bounded child business unit${businessUnit.childBusinessUnitCount === 1 ? "" : "s"}; ${businessUnit.userParticipationCount ?? 0} user participant${businessUnit.userParticipationCount === 1 ? "" : "s"}; ${businessUnit.teamParticipationCount ?? 0} team participant${businessUnit.teamParticipationCount === 1 ? "" : "s"}; ${businessUnit.applicationUserParticipationCount ?? 0} application/service identity participant${businessUnit.applicationUserParticipationCount === 1 ? "" : "s"}; ${businessUnit.roleParticipationCount ?? 0} role participant${businessUnit.roleParticipationCount === 1 ? "" : "s"}.${parent}`;
}

function businessUnitAccessOperationalSignificance(businessUnit: BusinessUnitSummary): string {
  const name = businessUnit.name ?? businessUnit.businessUnitId ?? "Selected business unit";
  const parent = businessUnit.parentBusinessUnitName ? ` under parent business unit ${businessUnit.parentBusinessUnitName}` : "";
  const appUsers = businessUnit.applicationUserParticipationCount ?? 0;
  const users = businessUnit.userParticipationCount ?? 0;
  const teams = businessUnit.teamParticipationCount ?? 0;
  const roles = businessUnit.roleParticipationCount ?? 0;

  if (users === 0 && teams === 0 && roles === 0) {
    return `${name} is shown as Business Unit Context${parent}, with no user, team, or role participation returned in this bounded lookup. This provides structural operational orientation without modelling organizational authority.`;
  }

  if (appUsers > 0) {
    return `${name} is shown as Business Unit Context${parent}. The bounded lookup observed ${users} user participant${users === 1 ? "" : "s"}, including ${appUsers} automation-oriented identity participant${appUsers === 1 ? "" : "s"}, ${teams} team participant${teams === 1 ? "" : "s"}, and ${roles} role participant${roles === 1 ? "" : "s"}. This explains nearby structural participation without asserting access authority.`;
  }

  return `${name} is shown as Business Unit Context${parent}, with ${users} user participant${users === 1 ? "" : "s"}, ${teams} team participant${teams === 1 ? "" : "s"}, and ${roles} role participant${roles === 1 ? "" : "s"} returned in this bounded lookup. This provides operational grouping orientation without recursive hierarchy exploration or authority modelling.`;
}

function applicationUserAccessOperationalSignificance(
  principalSummary: PrincipalSummary,
  directRoles: readonly AccessRole[],
  teamMemberships: readonly TeamMembership[],
  inheritedRoles: readonly AccessRole[]
): string {
  const principal = principalSummary.displayName ?? principalSummary.uniqueName ?? principalSummary.id ?? "Selected application user";
  const bu = principalSummary.businessUnitName ? ` in business unit ${principalSummary.businessUnitName}` : "";
  const roleDescription = describeRoleSet(directRoles);
  const teamCount = teamMemberships.length;
  const inheritedCount = inheritedRoles.length;

  return `${principal} appears automation-oriented as ${principalSummary.principalType}${bu}, with ${roleDescription}, ${teamCount} team membership${teamCount === 1 ? "" : "s"}, and ${inheritedCount} inherited team role${inheritedCount === 1 ? "" : "s"} returned in this bounded lookup. This explains automation identity participation without implying ownership, responsibility, or effective access.`;
}

async function loadApplicationUserAccessContext(client: DataverseClient, token: string, principalId: string): Promise<AccessContextDetail> {
  const context = await loadPrincipalAccessContext(client, token, principalId);
  context.subjectKind = "applicationuser";
  context.operationalSignificance = applicationUserAccessOperationalSignificance(
    context.principalSummary,
    context.directRoles,
    context.teamMemberships,
    context.inheritedRoles
  );
  context.searchHint = "Search is local to the Application User Context evidence currently loaded.";
  context.evidence = createAccessEvidence(context);
  return context;
}

async function loadBusinessUnitAccessContext(client: DataverseClient, token: string, businessUnitId: string): Promise<AccessContextDetail> {
  const queryLog: string[] = [];
  const businessUnitQuery = `/businessunits(${businessUnitId})?$select=businessunitid,name,_parentbusinessunitid_value`;
  queryLog.push(businessUnitQuery);
  const businessUnitRow = await client.get(businessUnitQuery, token, { timeoutMs: SOLUTION_CONTEXT_TIMEOUT_MS }) as Record<string, unknown>;
  const principalSummary = toPrincipalSummary(businessUnitRow);
  const parentBusinessUnitId = getLookupId(businessUnitRow, "parentbusinessunitid");
  const parentBusinessUnitName = await loadBusinessUnitName(client, token, parentBusinessUnitId, queryLog);

  const childBuQuery = `/businessunits?$select=businessunitid,name,_parentbusinessunitid_value&$filter=_parentbusinessunitid_value eq ${businessUnitId}&$top=${ACCESS_TEAM_TOP}`;
  queryLog.push(childBuQuery);
  const childBusinessUnits = await getDataverseList(client, token, childBuQuery);

  const usersQuery = `/systemusers?$select=systemuserid,fullname,domainname,applicationid,azureactivedirectoryobjectid,accessmode,isdisabled,_businessunitid_value&$filter=_businessunitid_value eq ${businessUnitId}&$top=${ACCESS_TEAM_MEMBER_TOP}`;
  queryLog.push(usersQuery);
  const users = (await getDataverseList(client, token, usersQuery)).map(toTeamMemberSummary);

  const teamsQuery = `/teams?$select=teamid,name,teamtype,_businessunitid_value&$filter=_businessunitid_value eq ${businessUnitId}&$top=${ACCESS_TEAM_TOP}`;
  queryLog.push(teamsQuery);
  const teams = (await getDataverseList(client, token, teamsQuery)).map(toTeamMembership);

  const rolesQuery = `/roles?$select=roleid,name,_businessunitid_value&$filter=_businessunitid_value eq ${businessUnitId}&$top=${ACCESS_ROLE_TOP}`;
  queryLog.push(rolesQuery);
  const roles = (await getDataverseList(client, token, rolesQuery)).map((row) => toAccessRole(row, "direct"));

  const appUsers = users.filter((user) => (user.principalType ?? "").toLowerCase().includes("application") || (user.accessMode ?? "").toLowerCase().includes("non-interactive"));
  const businessUnitSummary: BusinessUnitSummary = {
    businessUnitId: principalSummary.id,
    name: principalSummary.displayName,
    parentBusinessUnitId,
    parentBusinessUnitName,
    childBusinessUnitCount: childBusinessUnits.length,
    userParticipationCount: users.length,
    teamParticipationCount: teams.length,
    applicationUserParticipationCount: appUsers.length,
    roleParticipationCount: roles.length
  };

  principalSummary.businessUnitName = principalSummary.displayName;
  const context: AccessContextDetail = {
    subjectKind: "businessunit",
    principalSummary,
    businessUnitSummary,
    directRoles: roles,
    teamMemberships: teams,
    teamMembers: users,
    roleUsers: [],
    roleTeams: [],
    inheritedRoles: [],
    evidence: [],
    keySignals: buildBusinessUnitKeySignals(businessUnitSummary, roles, teams),
    businessUnitRoleGroups: buildBusinessUnitRoleGroups(roles),
    operationalSignificance: businessUnitAccessOperationalSignificance(businessUnitSummary),
    topologySummary: businessUnitAccessTopologySummary(businessUnitSummary),
    queryLog,
    limits: {
      roleTop: ACCESS_ROLE_TOP,
      teamTop: ACCESS_TEAM_TOP,
      teamRoleTop: ACCESS_TEAM_ROLE_TOP,
      teamMemberTop: ACCESS_TEAM_MEMBER_TOP,
      displayedByDefault: ACCESS_CONTEXT_DISPLAYED_BY_DEFAULT
    },
    searchHint: "Search is local to the Business Unit Context evidence currently loaded."
  };
  context.evidence = createAccessEvidence(context);
  return context;
}


function accessContextSummary(context: AccessContextDetail): string {
  return context.operationalSignificance;
}

export class AccessContextProvider implements OperationalContextProvider {
  public readonly id = "accessContext";
  public readonly label = "Access Context";

  public async collect(request: OperationalContextProviderRequest) {
    const client = request.dataverse?.client;
    const token = request.dataverse?.token;

    if (!client || !token) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "AccessRestriction",
        title: "No access topology evidence loaded",
        summary: "Access Context needs an active Dataverse connection before it can retrieve principal, role, and team participation evidence.",
        source: "providedContext",
        scope: "currentSubject",
        confidence: "unknown",
        emphasis: "notable",
        raw: {
          accessDetails: [{
            label: "No access topology evidence",
            summary: "No Dataverse access-context query was run because no Dataverse client/token was provided.",
            source: "provided context"
          } satisfies AccessDetail],
          runnable: false,
          note: "Access Context shows bounded operational participation evidence."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }

    try {
      const current = await loadCurrentActor(client, token);
      const requestedPrincipalId = request.subject.type === "principal" ? normalizeGuidLike(request.subject.id) : undefined;
      const principalId = requestedPrincipalId ?? current.actor.id;

      if (!principalId) {
        const actorName = formatActorName(current.actor);
        const evidence: OperationalContextEvidence[] = [{
          subject: request.subject,
          evidenceType: "AccessRestriction",
          title: "Current request principal observed",
          summary: `DV Quick Run is querying Dataverse as ${actorName}. A principal id was not available, so Access Context shows identity orientation only and does not infer roles or remediation.`,
          source: "dataverse",
          scope: "currentPrincipal",
          confidence: "direct",
          emphasis: "notable",
          query: current.queries.join(" | "),
          raw: {
            accessDetails: [{
              label: "Current Dataverse principal",
              summary: "This is the identity DV Quick Run used for the bounded context lookup. It is not an effective-permission simulation.",
              principal: current.actor,
              source: "WhoAmI / systemusers"
            } satisfies AccessDetail],
            whoAmI: current.whoAmI,
            runnable: false,
            note: "Missing privileges are shown only when returned by Dataverse evidence."
          }
        }];

        return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
      }

      const accessContext = request.subject.logicalName === "team"
        ? await loadTeamAccessContext(client, token, principalId)
        : request.subject.logicalName === "role"
          ? await loadRoleAccessContext(client, token, principalId)
          : request.subject.logicalName === "businessunit"
            ? await loadBusinessUnitAccessContext(client, token, principalId)
            : request.subject.logicalName === "applicationuser"
              ? await loadApplicationUserAccessContext(client, token, principalId)
              : await loadPrincipalAccessContext(client, token, principalId);
      const evidence: OperationalContextEvidence[] = [{
        subject: {
          ...request.subject,
          type: "principal",
          id: accessContext.principalSummary.id ?? principalId,
          displayName: accessContext.principalSummary.displayName ?? accessContext.principalSummary.uniqueName ?? request.subject.displayName
        },
        evidenceType: "AccessTopology",
        title: "Observed access topology participation",
        summary: accessContextSummary(accessContext),
        source: "dataverse",
        scope: requestedPrincipalId ? "currentSubject" : "currentPrincipal",
        confidence: "direct",
        emphasis: "notable",
        query: accessContext.queryLog.join(" | "),
        raw: {
          accessContext,
          searchableText: accessEvidenceSearchText(accessContext),
          progressiveDisclosure: "Principal/Application User/Team/Role/Business Unit Summary, Business Unit, Direct Roles, Team Memberships, Role Participation, Business Unit Participation, Inherited Team Roles, and Access Evidence should remain collapsed/expandable and searchable within the currently retrieved bounded evidence.",
          runnable: false,
          note: "Access Context shows bounded operational participation evidence."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    } catch (error) {
      const reason = error instanceof Error && error.message.trim().length > 0 ? error.message.trim() : String(error);
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "AccessRestriction",
        title: "Access context partially unavailable",
        summary: "DV Quick Run could not complete the bounded Access Context lookup. This may be due to current visibility constraints or provider limitations.",
        source: "provider",
        scope: "currentPrincipal",
        confidence: "unknown",
        emphasis: "notable",
        raw: {
          accessDetails: [{
            label: "Access context provider unavailable",
            summary: "Some access participation evidence could not be retrieved. DV Quick Run keeps this calm and explicit instead of guessing remediation.",
            source: "provider"
          } satisfies AccessDetail],
          lookupError: reason,
          runnable: false
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }
  }
}

export class RuntimeActorContextProvider implements OperationalContextProvider {
  public readonly id = "runtimeActorContext";
  public readonly label = "Runtime Actor Context";

  public async collect(request: OperationalContextProviderRequest) {
    const client = request.dataverse?.client;
    const token = request.dataverse?.token;

    if (!client || !token) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "RuntimeActor",
        title: "No runtime actor evidence captured yet",
        summary: "When actor evidence is available, DV Quick Run will preserve observed identity types such as human user, app user, service principal, workflow owner, or impersonation. This pass confirms the boundary and avoids collapsing identities into a generic user label.",
        source: "providedContext",
        scope: "currentSubject",
        confidence: "unknown",
        raw: {
          actors: [{
            actorType: "Not observed",
            displayName: "No runtime actor evidence captured",
            source: "provided context"
          } satisfies ActorDetail],
          runnable: false,
          note: "Runtime Actor Context does not infer runtime responsibility. It preserves observed identity distinctions only."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }

    try {
      const current = await loadCurrentActor(client, token);
      const actorName = formatActorName(current.actor);
      const actorType = current.actor.actorType ?? "Current Dataverse principal";
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "RuntimeActor",
        title: "Current request actor observed",
        summary: `DV Quick Run observed the current Dataverse request actor as ${actorName} (${actorType}). This preserves identity context for the investigation, but it does not mean this actor caused runtime behaviour.`,
        source: "dataverse",
        scope: "currentPrincipal",
        confidence: "direct",
        query: current.queries.join(" | "),
        raw: {
          actors: [current.actor],
          whoAmI: current.whoAmI,
          runnable: false,
          note: "Inline detail follows the selected actor evidence path. Runtime Actor Context preserves identity distinctions; it does not assign responsibility."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    } catch (error) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "RuntimeActor",
        title: "Runtime actor context unavailable",
        summary: "DV Quick Run could not load current actor context. No runtime responsibility or identity type is inferred from this failure.",
        source: "provider",
        scope: "currentPrincipal",
        confidence: "unknown",
        raw: {
          actors: [{
            actorType: "Unavailable",
            displayName: "Actor context provider unavailable",
            source: "provider"
          } satisfies ActorDetail],
          lookupError: error instanceof Error ? error.message : String(error),
          runnable: false
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }
  }
}

export class OwnershipContextProvider implements OperationalContextProvider {
  public readonly id = "ownershipContext";
  public readonly label = "Ownership / Participation Context";

  public async collect(request: OperationalContextProviderRequest) {
    const logicalName = request.subject.logicalName?.trim() ?? "";
    const client = request.dataverse?.client;
    const token = request.dataverse?.token;

    if (!client || !token || !hasEntitySubject(request)) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "Owner",
        title: "Ownership and participation are separate signals",
        summary: "Ownership evidence can help identify who or what owns a component. Participation evidence can show where it appears. Neither signal means runtime responsibility unless direct evidence supports that interpretation.",
        source: "providedContext",
        scope: "currentSubject",
        confidence: "unknown",
        raw: {
          ownershipDetails: [{
            label: "Ownership boundary",
            value: "No entity ownership metadata loaded",
            meaning: "This card preserves the distinction between ownership, participation, and runtime responsibility.",
            source: "provided context"
          } satisfies OwnershipDetail],
          runnable: false,
          note: "Ownership / Participation Context does not infer runtime responsibility."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }

    try {
      const ownership = await loadEntityOwnershipDetails(client, token, logicalName);
      const ownershipType = ownership.details.find((detail) => detail.label === "Ownership model")?.value ?? "Not returned";
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "Owner",
        title: "Entity ownership model observed",
        summary: `${subjectLabel(request)} uses Dataverse ownership model '${ownershipType}'. This explains ownership structure only; it does not identify runtime responsibility.`,
        source: "dataverse",
        scope: "currentSubject",
        confidence: "direct",
        query: ownership.query,
        raw: {
          logicalName,
          ownershipDetails: ownership.details,
          entityMetadata: ownership.row,
          runnable: false,
          note: "Inline detail follows the selected ownership evidence path. Ownership and participation remain separate from causality."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    } catch (error) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "Owner",
        title: "Ownership context unavailable",
        summary: "DV Quick Run could not load entity ownership metadata. No ownership or responsibility is inferred from this failure.",
        source: "provider",
        scope: "currentSubject",
        confidence: "unknown",
        raw: {
          ownershipDetails: [{
            label: "Ownership context provider unavailable",
            value: "Unavailable",
            meaning: "No ownership interpretation is inferred when metadata cannot be loaded.",
            source: "provider"
          } satisfies OwnershipDetail],
          lookupError: error instanceof Error ? error.message : String(error),
          runnable: false
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }
  }
}

export function createDefaultOperationalContextProviders(): OperationalContextProvider[] {
  return [
    new SolutionContextProvider(),
    new AccessContextProvider(),
    new RuntimeActorContextProvider(),
    new OwnershipContextProvider()
  ];
}
