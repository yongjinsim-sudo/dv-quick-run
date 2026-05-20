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
        title: "No specific access restriction evidence captured",
        summary: "DV Quick Run will only show specific missing privileges when Dataverse returns evidence for them. Without that evidence, this context stays generic so it does not guess the remediation.",
        source: "providedContext",
        scope: "currentSubject",
        confidence: "unknown",
        emphasis: "notable",
        raw: {
          accessDetails: [{
            label: "No access fault evidence",
            summary: "No Dataverse missing-privilege or restricted-access response was provided to this context card.",
            source: "provided context"
          } satisfies AccessDetail],
          runnable: false,
          note: "Access Context does not simulate RBAC or infer remediation. It surfaces observed access evidence only."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    }

    try {
      const current = await loadCurrentActor(client, token);
      const actorName = formatActorName(current.actor);
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "AccessRestriction",
        title: "Current request principal observed",
        summary: `DV Quick Run is querying Dataverse as ${actorName}. No missing-privilege evidence was captured for this subject, so Access Context shows principal context only and does not infer roles or remediation.`,
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
          note: "Inline detail follows the selected access evidence path only. Missing privileges are shown only when returned by Dataverse evidence."
        }
      }];

      return createOperationalContextProviderResult({ providerId: this.id, label: this.label, evidence });
    } catch (error) {
      const evidence: OperationalContextEvidence[] = [{
        subject: request.subject,
        evidenceType: "AccessRestriction",
        title: "Access context unavailable",
        summary: "DV Quick Run could not load current-principal access context. This is a provider limitation, not evidence of missing privileges.",
        source: "provider",
        scope: "currentPrincipal",
        confidence: "unknown",
        emphasis: "notable",
        raw: {
          accessDetails: [{
            label: "Access context provider unavailable",
            summary: "Current-principal context could not be loaded. No privilege remediation is inferred.",
            source: "provider"
          } satisfies AccessDetail],
          lookupError: error instanceof Error ? error.message : String(error),
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
