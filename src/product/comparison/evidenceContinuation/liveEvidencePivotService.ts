import type { CommandContext } from "../../../commands/context/commandContext.js";

function buildEvidencePivotPreview(
  evidenceKind: string | undefined,
  label: string | undefined,
  value: string | undefined
): string {
  const kind = (evidenceKind ?? "evidence").toLowerCase();
  const observed = value ?? "captured evidence";

  if (kind.includes("solution")) {
    return `Bounded solution evidence pivot ready. DVQR would continue into solution participation investigation for: ${observed}`;
  }

  if (kind.includes("automation") || kind.includes("workflow")) {
    return `Bounded workflow / automation pivot ready. DVQR would continue into orchestration participation evidence for: ${observed}`;
  }

  if (kind.includes("plugin")) {
    return `Bounded plugin runtime pivot ready. DVQR would continue into plugin step runtime investigation for: ${observed}`;
  }

  if (kind.includes("identity") || kind.includes("role") || kind.includes("team")) {
    return `Bounded identity participation pivot ready. DVQR would continue into Access Context evidence for: ${observed}`;
  }

  if (kind.includes("score") || kind.includes("signal") || kind.includes("delta")) {
    return `Bounded operational density pivot ready. DVQR would continue into operational profile contributor evidence for: ${observed}`;
  }

  return `Bounded investigation pivot ready. DVQR would continue investigation from captured evidence for: ${observed}`;
}



export interface EvidencePivotResult {
  readonly status: "available" | "unavailable" | "error";
  readonly summary: string;
}

interface DataverseListResponse<T> {
  readonly value?: readonly T[];
}

interface SolutionPivotRow {
  readonly solutionid?: string;
  readonly uniquename?: string;
  readonly friendlyname?: string;
  readonly version?: string;
  readonly ismanaged?: boolean;
  readonly installedon?: string;
  readonly modifiedon?: string;
}

interface PluginStepPivotRow {
  readonly sdkmessageprocessingstepid?: string;
  readonly name?: string;
  readonly stage?: number;
  readonly mode?: number;
  readonly rank?: number;
  readonly statecode?: number;
  readonly statuscode?: number;
  readonly filteringattributes?: string;
  readonly supporteddeployment?: number;
  readonly "sdkmessageid/name"?: string;
  readonly "plugintypeid/typename"?: string;
}

interface WorkflowPivotRow {
  readonly workflowid?: string;
  readonly name?: string;
  readonly uniquename?: string;
  readonly category?: number;
  readonly type?: number;
  readonly mode?: number;
  readonly statecode?: number;
  readonly statuscode?: number;
  readonly "owningbusinessunit/name"?: string;
  readonly primaryentity?: string;
  readonly createdon?: string;
  readonly modifiedon?: string;
}

interface SystemUserPivotRow {
  readonly systemuserid?: string;
  readonly fullname?: string;
  readonly domainname?: string;
  readonly internalemailaddress?: string;
  readonly applicationid?: string;
  readonly isdisabled?: boolean;
  readonly accessmode?: number;
  readonly "businessunitid/name"?: string;
  readonly modifiedon?: string;
}

interface TeamPivotRow {
  readonly teamid?: string;
  readonly name?: string;
  readonly teamtype?: number;
  readonly "businessunitid/name"?: string;
  readonly modifiedon?: string;
}

interface RolePivotRow {
  readonly roleid?: string;
  readonly name?: string;
  readonly "businessunitid/name"?: string;
  readonly modifiedon?: string;
}

function extractIdentitySearchTerms(label: string | undefined, value: string | undefined): readonly string[] {
  const raw = `${label ?? ""} ${value ?? ""}`;
  const terms = new Set<string>();

  for (const token of raw.split(/[•→,|;]/g)) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 3 || /^(source|target|only in source|only in target|normalized name|normalised name|name matches after conservative environment-token normalization|identity|subject|type|role|team|participation|overlaps|both|appear|application-user-like|applicationuser|application-user)$/i.test(trimmed)) {
      continue;
    }

    terms.add(trimmed);
  }


  const serviceLikeTerms = raw.match(/[A-Za-z0-9_.-]+(?:_msi|service|svc|operator|app|application|integration)[A-Za-z0-9_.-]*/gi);
  for (const term of serviceLikeTerms ?? []) {
    if (term.length >= 3) {
      terms.add(term);
    }
  }

  const emails = raw.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi);
  for (const email of emails ?? []) {
    terms.add(email);
  }

  const guids = raw.match(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi);
  for (const guid of guids ?? []) {
    terms.add(guid);
  }

  return [...terms].slice(0, 6);
}

function extractNamedParticipationTerms(value: string | undefined): readonly string[] {
  const raw = value ?? "";
  return raw
    .replace(/^Observed .*?:/i, "")
    .split(/[,•→|;]/g)
    .map((term) => term.trim())
    .filter((term) => term.length >= 3)
    .slice(0, 6);
}

function accessModeLabel(accessmode: number | undefined): string {
  switch (accessmode) {
    case 0:
      return "Read-write";
    case 1:
      return "Administrative";
    case 2:
      return "Read";
    case 3:
      return "Support user";
    case 4:
      return "Non-interactive";
    case 5:
      return "Delegated admin";
    default:
      return typeof accessmode === "number" ? `Access mode ${accessmode}` : "Unknown access mode";
  }
}

function teamTypeLabel(teamtype: number | undefined): string {
  switch (teamtype) {
    case 0:
      return "Owner team";
    case 1:
      return "Access team";
    case 2:
      return "Azure AD security group team";
    case 3:
      return "Azure AD office group team";
    default:
      return typeof teamtype === "number" ? `Team type ${teamtype}` : "Unknown team type";
  }
}

function formatSystemUserPivotRow(row: SystemUserPivotRow): string {
  const name = row.fullname || row.domainname || row.internalemailaddress || row.systemuserid || "system user";
  const email = row.internalemailaddress ? ` · Email ${row.internalemailaddress}` : "";
  const domain = row.domainname ? ` · Domain ${row.domainname}` : "";
  const app = row.applicationid ? " · Application user" : "";
  const access = ` · ${accessModeLabel(row.accessmode)}`;
  const state = typeof row.isdisabled === "boolean" ? ` · ${row.isdisabled ? "Disabled" : "Enabled"}` : "";
  const bu = row["businessunitid/name"] ? ` · BU ${row["businessunitid/name"]}` : "";
  return `${name}${email}${domain}${app}${access}${state}${bu}`;
}

function formatTeamPivotRow(row: TeamPivotRow): string {
  const name = row.name || row.teamid || "team";
  const type = ` · ${teamTypeLabel(row.teamtype)}`;
  const bu = row["businessunitid/name"] ? ` · BU ${row["businessunitid/name"]}` : "";
  return `${name}${type}${bu}`;
}

function formatRolePivotRow(row: RolePivotRow): string {
  const name = row.name || row.roleid || "role";
  const bu = row["businessunitid/name"] ? ` · BU ${row["businessunitid/name"]}` : "";
  return `${name}${bu}`;
}

async function queryLiveIdentityEvidencePivot(
  ctx: CommandContext,
  label: string | undefined,
  value: string | undefined
): Promise<EvidencePivotResult> {
  const lowerLabel = (label ?? "").toLowerCase();
  const lowerValue = (value ?? "").toLowerCase();
  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();

  try {
      if (lowerLabel.includes("identity subject") && lowerValue.includes("businessunit")) {
    return {
      status: "available",
      summary: "Business-unit identity subject is structural comparison context. Use adjacent business-unit id / team participation rows for bounded live lookup; DVQR does not infer hierarchy authority from this row."
    };
  }

if (lowerLabel.includes("normalized name") || lowerLabel.includes("normalised name")) {
      return {
        status: "available",
        summary: "Captured normalized identity evidence indicates conservative environment-token matching. No unique live identity value is present in this evidence row; use adjacent identity subject / only-in-source / only-in-target rows for bounded live user, team, or role lookup."
      };
    }

    if (lowerLabel.includes("team") || lowerValue.includes("team participation")) {
      const terms = extractNamedParticipationTerms(value);
      if (!terms.length) {
        return {
          status: "unavailable",
          summary: "Captured team participation evidence is available inline, but DVQR could not derive a bounded team lookup term."
        };
      }

      const select = "$select=teamid,name,teamtype,modifiedon";
      const expand = "$expand=businessunitid($select=name)";
      for (const term of terms) {
        const escaped = escapeODataLiteral(term);
        const result = await client.getWithMetadata<DataverseListResponse<TeamPivotRow>>(`/teams?${select}&${expand}&$filter=contains(name,'${escaped}')&$top=5`, token, { timeoutMs: 12000 });
        const rows = result.data.value ?? [];
        if (rows.length > 0) {
          return {
            status: "available",
            summary: `Live Dataverse team evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatTeamPivotRow).join(" · ")}`
          };
        }
      }

      return {
        status: "unavailable",
        summary: `Live Dataverse team lookup completed but found no team matching: ${terms.join(", ")}`
      };
    }

    if (lowerLabel.includes("role") || lowerValue.includes("role participation")) {
      const terms = extractNamedParticipationTerms(value);
      if (!terms.length) {
        return {
          status: "unavailable",
          summary: "Captured role participation evidence is available inline, but DVQR could not derive a bounded role lookup term."
        };
      }

      const select = "$select=roleid,name,modifiedon";
      const expand = "$expand=businessunitid($select=name)";
      for (const term of terms) {
        const escaped = escapeODataLiteral(term);
        const result = await client.getWithMetadata<DataverseListResponse<RolePivotRow>>(`/roles?${select}&${expand}&$filter=contains(name,'${escaped}')&$top=5`, token, { timeoutMs: 12000 });
        const rows = result.data.value ?? [];
        if (rows.length > 0) {
          return {
            status: "available",
            summary: `Live Dataverse role evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatRolePivotRow).join(" · ")}`
          };
        }
      }

      return {
        status: "unavailable",
        summary: `Live Dataverse role lookup completed but found no role matching: ${terms.join(", ")}`
      };
    }

    const terms = extractIdentitySearchTerms(label, value);
    if (!terms.length) {
      return {
        status: "available",
        summary: buildEvidencePivotPreview("identity", label, value)
      };
    }

    const select = "$select=systemuserid,fullname,domainname,internalemailaddress,applicationid,isdisabled,accessmode,modifiedon";
    const expand = "$expand=businessunitid($select=name)";
    for (const term of terms) {
      const escaped = escapeODataLiteral(term);
      const filter = `$filter=systemuserid eq ${/^[0-9a-f-]{36}$/i.test(term) ? term : "00000000-0000-0000-0000-000000000000"} or contains(fullname,'${escaped}') or contains(domainname,'${escaped}') or contains(internalemailaddress,'${escaped}')`;
      const result = await client.getWithMetadata<DataverseListResponse<SystemUserPivotRow>>(`/systemusers?${select}&${expand}&${filter}&$top=5`, token, { timeoutMs: 12000 });
      const rows = result.data.value ?? [];
      if (rows.length > 0) {
        return {
          status: "available",
          summary: `Live Dataverse identity evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatSystemUserPivotRow).join(" · ")}`
        };
      }
    }

    return {
      status: "unavailable",
      summary: `Live Dataverse identity lookup completed but found no system user matching: ${terms.join(", ")}. If this evidence is a team or business-unit subject, use the adjacent team/role participation rows for bounded lookup.`
    };
  } catch (error) {
    return {
      status: "error",
      summary: `Live Dataverse identity/access lookup could not complete: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function extractWorkflowSearchTerms(label: string | undefined, value: string | undefined): readonly string[] {
  const raw = `${label ?? ""} ${value ?? ""}`;
  const terms = new Set<string>();

  for (const token of raw.split(/[•→,|]/g)) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 3 || /^(source|target|workflow|automation|process|state|activated|deactivated|active|inactive|managed|unmanaged|owner)$/i.test(trimmed)) {
      continue;
    }

    terms.add(trimmed);
  }

  const namedMatch = raw.match(/[A-Za-z0-9_.\s-]+(?:Workflow|Flow|Realtime|Background|Automation|Process|Sync|Async)[A-Za-z0-9_.\s-]*/gi);
  for (const term of namedMatch ?? []) {
    const cleaned = term.trim();
    if (cleaned.length >= 3) {
      terms.add(cleaned);
    }
  }

  return [...terms].slice(0, 6);
}

function workflowCategoryLabel(category: number | undefined): string {
  switch (category) {
    case 0:
      return "Classic workflow";
    case 1:
      return "Dialog";
    case 2:
      return "Business rule";
    case 3:
      return "Action";
    case 4:
      return "Business process flow";
    case 5:
      return "Modern flow";
    case 6:
      return "Desktop flow";
    default:
      return typeof category === "number" ? `Category ${category}` : "Unknown category";
  }
}

function workflowModeLabel(mode: number | undefined): string {
  switch (mode) {
    case 0:
      return "Background";
    case 1:
      return "Real-time";
    default:
      return typeof mode === "number" ? `Mode ${mode}` : "Unknown mode";
  }
}

function workflowStateLabel(statecode: number | undefined): string {
  switch (statecode) {
    case 0:
      return "Draft";
    case 1:
      return "Activated";
    default:
      return typeof statecode === "number" ? `State ${statecode}` : "Unknown state";
  }
}

function formatWorkflowPivotRow(row: WorkflowPivotRow): string {
  const name = row.name || row.uniquename || row.workflowid || "workflow";
  const category = ` · ${workflowCategoryLabel(row.category)}`;
  const mode = ` · ${workflowModeLabel(row.mode)}`;
  const state = ` · ${workflowStateLabel(row.statecode)}`;
  const entity = row.primaryentity ? ` · Entity ${row.primaryentity}` : "";
  const ownerText = "";
  const bu = row["owningbusinessunit/name"] ? ` · BU ${row["owningbusinessunit/name"]}` : "";
  const modified = row.modifiedon ? ` · Modified ${row.modifiedon}` : "";
  return `${name}${category}${mode}${state}${entity}${ownerText}${bu}${modified}`;
}

async function queryLiveWorkflowEvidencePivot(
  ctx: CommandContext,
  label: string | undefined,
  value: string | undefined
): Promise<EvidencePivotResult> {
  const terms = extractWorkflowSearchTerms(label, value);
  if (!terms.length) {
    return {
      status: "unavailable",
      summary: "Captured workflow / automation evidence is available inline, but DVQR could not derive a bounded workflow lookup term from this evidence row."
    };
  }

  try {
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    const select = "$select=workflowid,name,uniquename,category,type,mode,statecode,statuscode,primaryentity,createdon,modifiedon";
    const expand = "$expand=owningbusinessunit($select=name)";

    for (const term of terms) {
      const escaped = escapeODataLiteral(term);
      const filter = `$filter=contains(name,'${escaped}') or contains(uniquename,'${escaped}')`;
      const result = await client.getWithMetadata<DataverseListResponse<WorkflowPivotRow>>(`/workflows?${select}&${expand}&${filter}&$top=5`, token, { timeoutMs: 12000 });
      const rows = result.data.value ?? [];

      if (rows.length > 0) {
        return {
          status: "available",
          summary: `Live Dataverse workflow / automation evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatWorkflowPivotRow).join(" · ")}`
        };
      }
    }

    return {
      status: "unavailable",
      summary: `Live Dataverse workflow / automation lookup completed but found no workflow matching: ${terms.join(", ")}`
    };
  } catch (error) {
    return {
      status: "error",
      summary: `Live Dataverse workflow / automation lookup could not complete: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}

function extractPluginSearchTerms(label: string | undefined, value: string | undefined): readonly string[] {
  const raw = `${label ?? ""} ${value ?? ""}`;
  const terms = new Set<string>();

  for (const token of raw.split(/[•→,|]/g)) {
    const trimmed = token.trim();
    if (!trimmed || trimmed.length < 3 || /^(source|target|plugin|step|message|entity|stage|mode|order|rank|enabled|disabled|managed|unmanaged)$/i.test(trimmed)) {
      continue;
    }

    if (/^\d+$/.test(trimmed)) {
      continue;
    }

    terms.add(trimmed);
  }

  const namedMatch = raw.match(/[A-Za-z0-9_.]+(?:Plugin|Dispatch|Validation|Sync|Async|Step|Handler)[A-Za-z0-9_.]*/g);
  for (const term of namedMatch ?? []) {
    terms.add(term);
  }

  return [...terms].slice(0, 6);
}

function pluginStageLabel(stage: number | undefined): string {
  switch (stage) {
    case 10:
      return "Pre-validation";
    case 20:
      return "Pre-operation";
    case 40:
      return "Post-operation";
    default:
      return typeof stage === "number" ? `Stage ${stage}` : "Unknown stage";
  }
}

function pluginModeLabel(mode: number | undefined): string {
  switch (mode) {
    case 0:
      return "Synchronous";
    case 1:
      return "Asynchronous";
    default:
      return typeof mode === "number" ? `Mode ${mode}` : "Unknown mode";
  }
}

function pluginStateLabel(statecode: number | undefined): string {
  switch (statecode) {
    case 0:
      return "Enabled";
    case 1:
      return "Disabled";
    default:
      return typeof statecode === "number" ? `State ${statecode}` : "Unknown state";
  }
}

function formatPluginStepPivotRow(row: PluginStepPivotRow): string {
  const name = row.name || row.sdkmessageprocessingstepid || "plugin step";
  const message = row["sdkmessageid/name"] ? ` · Message ${row["sdkmessageid/name"]}` : "";
  const type = row["plugintypeid/typename"] ? ` · Type ${row["plugintypeid/typename"]}` : "";
  const stage = ` · ${pluginStageLabel(row.stage)}`;
  const mode = ` · ${pluginModeLabel(row.mode)}`;
  const rank = typeof row.rank === "number" ? ` · Rank ${row.rank}` : "";
  const state = ` · ${pluginStateLabel(row.statecode)}`;
  const filtering = row.filteringattributes ? ` · Filtering ${row.filteringattributes}` : "";
  return `${name}${message}${type}${stage}${mode}${rank}${state}${filtering}`;
}

async function queryLivePluginStepEvidencePivot(
  ctx: CommandContext,
  label: string | undefined,
  value: string | undefined
): Promise<EvidencePivotResult> {
  const terms = extractPluginSearchTerms(label, value);
  if (!terms.length) {
    return {
      status: "unavailable",
      summary: "Captured plugin evidence is available inline, but DVQR could not derive a bounded plugin step lookup term from this evidence row."
    };
  }

  try {
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    const select = "$select=sdkmessageprocessingstepid,name,stage,mode,rank,statecode,statuscode,filteringattributes,supporteddeployment";
    const expand = "$expand=sdkmessageid($select=name),plugintypeid($select=typename)";

    for (const term of terms) {
      const escaped = escapeODataLiteral(term);
      const filter = `$filter=contains(name,'${escaped}')`;
      const result = await client.getWithMetadata<DataverseListResponse<PluginStepPivotRow>>(`/sdkmessageprocessingsteps?${select}&${expand}&${filter}&$top=5`, token, { timeoutMs: 12000 });
      const rows = result.data.value ?? [];

      if (rows.length > 0) {
        return {
          status: "available",
          summary: `Live Dataverse plugin step evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatPluginStepPivotRow).join(" · ")}`
        };
      }
    }

    return {
      status: "unavailable",
      summary: `Live Dataverse plugin step lookup completed but found no step matching: ${terms.join(", ")}`
    };
  } catch (error) {
    return {
      status: "error",
      summary: `Live Dataverse plugin step lookup could not complete: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}


interface EntityDefinitionPivotRow {
  readonly MetadataId?: string;
  readonly LogicalName?: string;
  readonly SchemaName?: string;
  readonly EntitySetName?: string;
  readonly OwnershipType?: string;
  readonly IsCustomEntity?: boolean;
  readonly IsManaged?: boolean;
  readonly IsAuditEnabled?: {
    readonly Value?: boolean;
  };
  readonly IsActivity?: boolean;
  readonly IsValidForAdvancedFind?: {
    readonly Value?: boolean;
  };
  readonly DisplayName?: {
    readonly UserLocalizedLabel?: {
      readonly Label?: string;
    };
  };
}

function extractCustomEntityLogicalNames(
  label: string | undefined,
  value: string | undefined,
  parentTitle?: string,
  parentSummary?: string,
  parentEvidence?: string
): readonly string[] {
  const raw = `${label ?? ""} ${value ?? ""} ${parentTitle ?? ""} ${parentSummary ?? ""} ${parentEvidence ?? ""}`;
  const matches = raw.match(/\b[a-z][a-z0-9]{1,20}_[a-z0-9_]{2,80}\b/gi) ?? [];
  const ignoredPrefixes = new Set(["msdyn"]);
  const terms = new Set<string>();

  for (const match of matches) {
    const logicalName = match.toLowerCase();
    const prefix = logicalName.split("_")[0];
    if (!ignoredPrefixes.has(prefix)) {
      terms.add(logicalName);
    }
  }

  return [...terms].slice(0, 4);
}

function formatEntityDefinitionPivotRow(row: EntityDefinitionPivotRow): string {
  const displayName = row.DisplayName?.UserLocalizedLabel?.Label;
  const logicalName = row.LogicalName ?? "entity";
  const schema = row.SchemaName ? ` · Schema ${row.SchemaName}` : "";
  const setName = row.EntitySetName ? ` · Set ${row.EntitySetName}` : "";
  const ownership = row.OwnershipType ? ` · Ownership ${row.OwnershipType}` : "";
  const custom = typeof row.IsCustomEntity === "boolean" ? ` · ${row.IsCustomEntity ? "Custom entity" : "Standard entity"}` : "";
  const managed = typeof row.IsManaged === "boolean" ? ` · ${row.IsManaged ? "Managed" : "Unmanaged"}` : "";
  const audit = typeof row.IsAuditEnabled?.Value === "boolean" ? ` · Auditing ${row.IsAuditEnabled.Value ? "enabled" : "disabled"}` : "";
  return `${displayName ?? logicalName} (${logicalName})${schema}${setName}${ownership}${custom}${managed}${audit}`;
}

async function queryLiveEntityMetadataEvidencePivot(
  ctx: CommandContext,
  label: string | undefined,
  value: string | undefined,
  parentTitle?: string,
  parentSummary?: string,
  parentEvidence?: string
): Promise<EvidencePivotResult> {
  const logicalNames = extractCustomEntityLogicalNames(label, value, parentTitle, parentSummary, parentEvidence);
  if (!logicalNames.length) {
    return {
      status: "available",
      summary: "Entity-level evidence is captured comparison context, but DVQR could not derive a custom entity logical name for a bounded metadata lookup."
    };
  }

  try {
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    const select = "$select=MetadataId,LogicalName,SchemaName,EntitySetName,OwnershipType,IsCustomEntity,IsManaged,IsActivity,IsAuditEnabled,IsValidForAdvancedFind,DisplayName";

    for (const logicalName of logicalNames) {
      const result = await client.getWithMetadata<EntityDefinitionPivotRow>(`/EntityDefinitions(LogicalName='${escapeODataLiteral(logicalName)}')?${select}`, token, { timeoutMs: 12000 });
      if (result.data) {
        return {
          status: "available",
          summary: `Live Dataverse entity metadata returned for "${logicalName}": ${formatEntityDefinitionPivotRow(result.data)}`
        };
      }
    }

    return {
      status: "unavailable",
      summary: `Live Dataverse entity metadata lookup completed but found no entity matching: ${logicalNames.join(", ")}`
    };
  } catch (error) {
    return {
      status: "error",
      summary: `Live Dataverse entity metadata lookup could not complete: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}


function extractSolutionSearchTerms(label: string | undefined, value: string | undefined): readonly string[] {
  const raw = `${label ?? ""} ${value ?? ""}`;
  const terms = new Set<string>();

  const solutionEvidenceMatches = raw.match(/(?:Source solution|Target solution):\s*([^·]+)(?:·\s*v?([0-9][0-9.]*))?/gi);
  for (const match of solutionEvidenceMatches ?? []) {
    const cleaned = match
      .replace(/^(Source solution|Target solution):\s*/i, "")
      .split("·")[0]
      .trim();
    if (cleaned.length >= 3) {
      terms.add(cleaned);
    }
  }

  for (const token of raw.split(/[•→,|]/g)) {
    const trimmed = token
      .replace(/^(Source solution|Target solution|Solution classification|Version drift):\s*/i, "")
      .trim();

    if (!trimmed || trimmed.length < 3 || /^(source|target|solution|version|changed|managed|unmanaged|custom solution|microsoft platform solution|platform patch layer|backup \/ archived solution)$/i.test(trimmed)) {
      continue;
    }

    if (/present only in/i.test(trimmed)) {
      continue;
    }

    terms.add(trimmed.replace(/^v(?=\d)/i, ""));
  }

  for (const version of raw.match(/\b\d+\.\d+(?:\.\d+){0,3}\b/g) ?? []) {
    terms.add(version);
  }

  return [...terms].slice(0, 6);
}

function escapeODataLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function formatSolutionPivotRow(row: SolutionPivotRow): string {
  const name = row.friendlyname || row.uniquename || row.solutionid || "solution";
  const unique = row.uniquename ? ` (${row.uniquename})` : "";
  const version = row.version ? ` v${row.version}` : "";
  const managed = typeof row.ismanaged === "boolean" ? ` · ${row.ismanaged ? "Managed" : "Unmanaged"}` : "";
  const changed = row.modifiedon || row.installedon;
  const changedText = changed ? ` · ${changed}` : "";
  return `${name}${unique}${version}${managed}${changedText}`;
}

async function queryLiveSolutionEvidencePivot(
  ctx: CommandContext,
  label: string | undefined,
  value: string | undefined
): Promise<EvidencePivotResult> {
  const terms = extractSolutionSearchTerms(label, value);
  if (!terms.length) {
    return {
      status: "unavailable",
      summary: "Captured solution evidence is available inline, but DVQR could not derive a bounded solution lookup term from this evidence row."
    };
  }

  try {
    const token = await ctx.getToken(ctx.getScope());
    const client = ctx.getClient();
    const select = "$select=solutionid,uniquename,friendlyname,version,ismanaged,installedon,modifiedon";

    for (const term of terms) {
      const escaped = escapeODataLiteral(term);
      const filter = `$filter=uniquename eq '${escaped}' or friendlyname eq '${escaped}' or version eq '${escaped}'`;
      const result = await client.getWithMetadata<DataverseListResponse<SolutionPivotRow>>(`/solutions?${select}&${filter}&$top=3`, token, { timeoutMs: 12000 });
      const rows = result.data.value ?? [];

      if (rows.length > 0) {
        return {
          status: "available",
          summary: `Live Dataverse solution evidence returned ${rows.length} match${rows.length === 1 ? "" : "es"} for "${term}": ${rows.map(formatSolutionPivotRow).join(" · ")}`
        };
      }
    }

    return {
      status: "unavailable",
      summary: `Live Dataverse solution lookup completed but found no solution matching: ${terms.join(", ")}`
    };
  } catch (error) {
    return {
      status: "error",
      summary: `Live Dataverse solution lookup could not complete: ${error instanceof Error ? error.message : String(error)}`
    };
  }
}


function isIdentityEvidencePivot(
  evidenceKind: string | undefined,
  label: string | undefined,
  value: string | undefined,
  parentText = ""
): boolean {
  const kind = (evidenceKind ?? "").toLowerCase();
  const text = `${label ?? ""} ${value ?? ""}`.toLowerCase();
  const combinedText = `${text} ${parentText}`.toLowerCase();

  return kind.includes("identity")
    || kind.includes("role")
    || kind.includes("team")
    || combinedText.includes("identity")
    || combinedText.includes("application-user")
    || combinedText.includes("applicationuser")
    || combinedText.includes("role participation")
    || combinedText.includes("team participation")
    || combinedText.includes("only in source")
    || combinedText.includes("only in target")
    || combinedText.includes("normalized name")
    || combinedText.includes("normalised name")
    || /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i.test(combinedText);
}

function isWorkflowEvidencePivot(
  evidenceKind: string | undefined,
  label: string | undefined,
  value: string | undefined,
  parentText = ""
): boolean {
  const kind = (evidenceKind ?? "").toLowerCase();
  const text = `${label ?? ""} ${value ?? ""}`.toLowerCase();
  const combinedText = `${text} ${parentText}`.toLowerCase();

  return kind.includes("automation")
    || kind.includes("workflow")
    || combinedText.includes("workflow")
    || combinedText.includes("flow")
    || combinedText.includes("owner changed")
    || combinedText.includes("owner ");
}

function buildParentAwareMetadataPivotResult(
  label: string | undefined,
  value: string | undefined,
  parentTitle: string | undefined,
  parentProvider: string | undefined
): EvidencePivotResult | undefined {
  const evidenceLabel = (label ?? "").toLowerCase();
  const evidenceValue = value ?? "captured evidence";
  const title = parentTitle ?? "parent drift signal";

  if (evidenceLabel.includes("solution classification")) {
    return {
      status: "available",
      summary: `Solution classification is captured comparison context. Use the adjacent Source solution / Target solution evidence row for bounded live solution lookup; captured classification: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("score") || evidenceLabel.includes("delta") || evidenceLabel.includes("participation density")) {
    return {
      status: "available",
      summary: `Operational density evidence is attribute-level comparison context. Use the parent drift "${title}" to review operational profile contributors; captured value: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("state") || evidenceLabel.includes("stage") || evidenceLabel.includes("execution order") || evidenceLabel.includes("filtering attribute")) {
    return {
      status: "available",
      summary: `Runtime evidence pivot is parent-aware. Use the parent plugin/workflow drift "${title}" for the live lookup; this row highlights ${label ?? "attribute drift"}: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("managed state") || evidenceLabel.includes("version")) {
    return {
      status: "available",
      summary: `Solution evidence pivot is parent-aware. Use the parent solution drift "${title}" for the live solution lookup; this row highlights ${label ?? "attribute drift"}: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("owner")) {
    return {
      status: "available",
      summary: `Owner drift is captured workflow/identity context. Use the parent workflow or identity participation row for bounded live lookup; captured owner context: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("normalized name") || evidenceLabel.includes("normalised name")) {
    return {
      status: "available",
      summary: `Identity normalization evidence is correlation context. Use the parent identity drift "${title}" or adjacent only-in-source / only-in-target identity rows for live identity lookup; captured value: ${evidenceValue}`
    };
  }

  if (evidenceLabel.includes("dataverse id") || evidenceLabel.includes("business unit id")) {
    return {
      status: "available",
      summary: `Dataverse identifier evidence is captured comparison context. Use the parent identity/business-unit drift "${title}" or adjacent participation rows for bounded live lookup; captured value: ${evidenceValue}`
    };
  }

  return undefined;
}


async function withEvidencePivotTimeout(promise: Promise<EvidencePivotResult>, label: string | undefined): Promise<EvidencePivotResult> {
  let timer: NodeJS.Timeout | undefined;
  const timeout = new Promise<EvidencePivotResult>((resolve) => {
    timer = setTimeout(() => resolve({
      status: "unavailable",
      summary: `Live evidence pivot timed out while investigating ${label ?? "captured evidence"}. Captured snapshot evidence remains available inline; retry if the current environment connection is still valid.`
    }), 15000);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

export interface EvidencePivotDiagnostics {
  readonly append?: (stage: string, details?: unknown) => void;
}

export async function buildEvidencePivotResult(
  ctx: CommandContext,
  evidenceKind: string | undefined,
  label: string | undefined,
  value: string | undefined,
  parentTitle?: string,
  parentSummary?: string,
  parentKind?: string,
  parentProvider?: string,
  parentEvidence?: string,
  comparisonEntityLogicalName?: string,
  diagnostics: EvidencePivotDiagnostics = {}
): Promise<EvidencePivotResult> {
  const kind = (evidenceKind ?? "evidence").toLowerCase();
  const text = `${label ?? ""} ${value ?? ""}`.toLowerCase();
  const parentText = `${parentTitle ?? ""} ${parentSummary ?? ""} ${parentKind ?? ""} ${parentProvider ?? ""} ${parentEvidence ?? ""}`.toLowerCase();
  const combinedText = `${text} ${parentText}`;
  const parentAwareEvidence = `${parentEvidence ?? ""} ${comparisonEntityLogicalName ?? ""}`;

  const metadataPivotResult = buildParentAwareMetadataPivotResult(label, value, parentTitle, parentProvider);
  if (metadataPivotResult) {
    diagnostics.append?.("route.metadataContext", { label, value, parentTitle, entityLogicalName: comparisonEntityLogicalName });
    return metadataPivotResult;
  }

  if (kind.includes("solution") || text.includes("solution") || parentText.includes("solution")) {
    diagnostics.append?.("route.solution", { label, value, parentTitle, entityLogicalName: comparisonEntityLogicalName });
    return withEvidencePivotTimeout(queryLiveSolutionEvidencePivot(ctx, label ?? parentTitle, `${value ?? ""} ${parentEvidence ?? ""}`), label);
  }

  if (kind.includes("plugin") || combinedText.includes("plugin") || combinedText.includes("sdkmessageprocessingstep")) {
    return withEvidencePivotTimeout(queryLivePluginStepEvidencePivot(ctx, parentTitle ?? label, parentEvidence ?? value), label);
  }

  if (isIdentityEvidencePivot(evidenceKind, label, value, parentText)) {
    return withEvidencePivotTimeout(queryLiveIdentityEvidencePivot(ctx, parentTitle ?? label, parentEvidence ?? value), label);
  }

  if (isWorkflowEvidencePivot(evidenceKind, label, value, parentText)) {
    return withEvidencePivotTimeout(queryLiveWorkflowEvidencePivot(ctx, parentTitle ?? label, parentEvidence ?? value), label);
  }

  const customEntityLogicalNames = extractCustomEntityLogicalNames(label, value, parentTitle, parentSummary, parentAwareEvidence);
  if (customEntityLogicalNames.length > 0) {
    diagnostics.append?.("route.entityMetadata", { label, value, parentTitle, entityLogicalName: comparisonEntityLogicalName, customEntityLogicalNames });
    return withEvidencePivotTimeout(queryLiveEntityMetadataEvidencePivot(ctx, label, value, parentTitle, parentSummary, parentAwareEvidence), label);
  }

  return {
    status: "available",
    summary: buildEvidencePivotPreview(evidenceKind, label, value)
  };
}
