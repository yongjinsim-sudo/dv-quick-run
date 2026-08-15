import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { buildOperationalProfile } from "../product/operationalProfile/operationalProfileEngine.js";
import { buildOperationalContextViewModel } from "../product/operationalContext/operationalContextEngine.js";
import { createDefaultOperationalContextProviders } from "../product/operationalContext/defaultOperationalContextProviders.js";
import { DataverseClient, type DataverseGetOptions } from "../services/dataverseClient.js";
import type { OperationalProfileInput, OperationalProfileModel } from "../product/operationalProfile/operationalProfileTypes.js";
import { mcpDataverseGet, type DvqrMcpDataverseGetResult } from "./mcpDataverseTransport.js";
import { environmentUrl, stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";

const MAX_PROFILE_ROWS = 5000;

const DVQR_SCORE_CALIBRATED_CEILING = 80;

const OPERATIONAL_PROFILE_SEMANTICS: Record<string, { evidenceLabel: string; meaning: string; mustNotInfer: readonly string[] }> = {
  relationships: {
    evidenceLabel: "relationship definitions",
    meaning: "Metadata relationship fanout contributes investigation and traversal surface context.",
    mustNotInfer: [
      "Do not describe relationship count as runtime-viable traversal paths.",
      "Do not describe relationships as security or access paths.",
      "Do not infer exponential branching, business preference, causality, or runtime participation from relationship count alone."
    ]
  },
  plugins: {
    evidenceLabel: "synchronous plug-in steps",
    meaning: "Registered synchronous plug-in steps are runtime execution touchpoints for investigation orientation.",
    mustNotInfer: [
      "Do not call the count a number of distinct plug-ins unless distinct plug-in identity was separately established.",
      "Do not infer that a plug-in is slow, faulty, causal, or a performance problem from participation count alone."
    ]
  },
  workflows: {
    evidenceLabel: "workflow/flow participation",
    meaning: "Workflow and flow participation contributes orchestration context.",
    mustNotInfer: [
      "Do not label this evidence asynchronous unless execution mode was explicitly observed.",
      "Do not infer delay, bypassed controls, failure, causality, or timing impact from workflow/flow participation alone."
    ]
  },
  solutionParticipation: {
    evidenceLabel: "solution participation",
    meaning: "Observed solution participation contributes packaging and layering context.",
    mustNotInfer: [
      "Do not infer deployment defects, layering problems, or unsafe customisation from solution participation alone."
    ]
  },
  activityParticipation: {
    evidenceLabel: "activity timeline participation",
    meaning: "Activity participation contributes timeline and interaction context when observed.",
    mustNotInfer: [
      "Do not rename this value to an activity-record count unless the underlying evidence explicitly represents counted activity records.",
      "Do not infer business activity, user behaviour, or causal sequence from this score primitive alone."
    ]
  },
  customisationDensity: {
    evidenceLabel: "customisation footprint evidence",
    meaning: "Managed/custom metadata evidence contributes customisation-footprint context.",
    mustNotInfer: [
      "Do not infer poor design, excessive customisation, defects, or quality from this evidence alone."
    ]
  },
  ownershipModel: {
    evidenceLabel: "ownership model evidence",
    meaning: "Ownership-model evidence contributes contextual ownership complexity.",
    mustNotInfer: [
      "Do not infer permissions, effective access, hierarchy behaviour, or security correctness from ownership-model presence alone."
    ]
  }
};

class McpOperationalProfileDataverseClient extends DataverseClient {
  public constructor(
    private readonly apiBaseUrl: string,
    private readonly requestTimeoutMs: number
  ) {
    super(apiBaseUrl);
  }

  public override async get(path: string, token: string, options: DataverseGetOptions = {}): Promise<unknown> {
    const result = await mcpDataverseGet({
      baseUrl: this.apiBaseUrl,
      path,
      token,
      timeoutMs: options.timeoutMs ?? this.requestTimeoutMs
    });
    return result.data;
  }
}

function escapeODataString(value: string): string { return value.replace(/'/g, "''"); }
function rows(data: unknown): Array<Record<string, unknown>> {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const value = (data as Record<string, unknown>).value;
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];
}
function numberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : undefined; }
  return undefined;
}
function booleanValue(value: unknown): boolean | undefined {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") { if (value.toLowerCase() === "true") return true; if (value.toLowerCase() === "false") return false; }
  return undefined;
}
function guidValue(value: unknown): string | undefined {
  const text = typeof value === "string" ? value.replace(/[{}]/g, "").trim() : "";
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(text) ? text : undefined;
}
function displayLabel(value: unknown): string | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  const user = (value as Record<string, unknown>).UserLocalizedLabel;
  if (!user || typeof user !== "object" || Array.isArray(user)) return undefined;
  const label = (user as Record<string, unknown>).Label;
  return typeof label === "string" && label.trim() ? label.trim() : undefined;
}

export function projectOperationalProfileForMcp(
  profile: OperationalProfileModel,
  liveAuthority?: { environmentUrl: string; acquiredAt: string }
) {
  const score = profile.dvqrScore;
  return {
    contractVersion: "dvqr-operational-profile-v2",
    table: { logicalName: profile.entityLogicalName, displayName: profile.entityDisplayName },
    profile: {
      headlineBand: profile.headlineBand,
      headlineLabel: profile.headlineLabel,
      summary: profile.summary,
      score: score?.displayScore ?? null,
      scoreBand: score?.band ?? null,
      scoreScale: { minimum: 0, maximum: 100 },
      contributors: (score?.contributingFactors ?? []).map((factor) => {
        const semantics = OPERATIONAL_PROFILE_SEMANTICS[factor.key];
        return {
          id: factor.key,
          label: factor.label,
          rawValue: factor.rawValue,
          rawEvidenceLabel: semantics?.evidenceLabel ?? "observed evidence",
          weightedContribution: factor.weightedContribution,
          maximumWeightedContribution: factor.maxContribution,
          normalizedRatio: factor.normalizedRatio,
          softCap: factor.softCap,
          contributionUnit: "weighted-evidence-points" as const,
          summary: factor.explanation,
          evidenceMeaning: semantics?.meaning,
          mustNotInfer: semantics?.mustNotInfer ?? []
        };
      }),
      observations: profile.dimensions.map((dimension) => ({
        id: dimension.id,
        label: dimension.label,
        band: dimension.band,
        value: dimension.valueLabel,
        explanation: dimension.explanation,
        whyItMatters: dimension.whyItMatters,
        evidenceState: dimension.evidenceStateLabel
      })),
      guidance: profile.guidance,
      scoreExplanation: score ? {
        summary: score.summary,
        evidencePrinciple: score.evidencePrinciple,
        methodology: score.methodology,
        normalizationVersion: score.normalizationVersion,
        explanationVersion: score.explanationVersion,
        weightedEvidence: score.rawDensityIndex,
        calibratedCeiling: DVQR_SCORE_CALIBRATED_CEILING,
        displayScale: { minimum: 0, maximum: 100 },
        displayFormula: "round(low-end damping(100 × weighted evidence / calibrated ceiling))",
        currentCalculation: `round(low-end damping(100 × ${score.rawDensityIndex} / ${DVQR_SCORE_CALIBRATED_CEILING})) = ${score.displayScore}`,
        arithmeticGuardrail: "The display score is a calibrated normalization of weighted evidence. Do not subtract weighted contributions from the display score, and do not invent residual, metadata, column, hidden, or unlisted score contributors to make the arithmetic sum to the display score.",
        terminologyGuardrail: "weightedContribution values are weighted evidence points, not percentages of the final display score."
      } : undefined
    },
    interpretation: {
      summary: score?.summary ?? profile.summary,
      limitations: [
        "DVQR Score is an investigation and operational-density signal, not a health, quality, security, performance, business-value, or root-cause score.",
        "Observed operational participation is contextual evidence and does not prove causality.",
        "Unavailable or unreadable evidence remains unknown; it must not be interpreted as zero participation.",
        "Relationship count is metadata fanout, not proof of runtime-viable traversal paths, access paths, business preference, or causality.",
        "Workflow/flow participation is orchestration context; do not infer asynchronous execution, delay, control bypass, or causal impact unless separately observed.",
        "Plug-in participation counts registered steps/touchpoints; do not infer distinct plug-in count, performance impact, defect, or causality.",
        "Activity Timeline Participation is a canonical score primitive; do not reinterpret it as an activity-record count unless that exact evidence was observed.",
        "Managed state and ownership evidence are governance/context signals and do not establish effective permissions, security posture, implementation quality, or change safety by themselves."
      ],
      presentationRules: {
        preferredTerms: [
          "weighted evidence points",
          "synchronous plug-in steps",
          "workflow/flow participation",
          "relationship definitions",
          "activity timeline participation",
          "operational density",
          "investigation context"
        ],
        prohibitedInferences: [
          "hidden score contribution",
          "metadata residual score",
          "runtime-viable path count from relationship count",
          "security/access path from relationship count",
          "asynchronous execution from workflow/flow participation alone",
          "performance impact from plug-in participation alone",
          "root cause from participation evidence"
        ]
      }
    },
    evidence: {
      source: "canonical-operational-profile" as const,
      authority: liveAuthority ? {
        mode: "live-dataverse-current-request" as const,
        environmentUrl: liveAuthority.environmentUrl,
        table: profile.entityLogicalName,
        acquiredAt: liveAuthority.acquiredAt,
        authoritativeForCurrentRequest: true,
        hostInstruction: "This profile was acquired live from the requested Dataverse environment for the current request. Use this live result as authoritative for current-state questions. Do not replace it with persisted DVQR snapshots, workspace files, exports, or earlier profile results unless the user explicitly asks for historical comparison."
      } : {
        mode: "canonical-projection" as const,
        environmentUrl: null,
        table: profile.entityLogicalName,
        acquiredAt: null,
        authoritativeForCurrentRequest: false,
        hostInstruction: "This is a canonical Operational Profile projection without live-request provenance. Do not claim current-environment authority unless live acquisition metadata is present."
      },
      comparisonBoundary: {
        historicalSnapshotsMayDiffer: true,
        rule: "Persisted snapshots and exports are historical evidence. They may be compared with this result when explicitly requested, but they must not silently supersede a live Operational Profile for a current-state question."
      }
    }
  };
}

export class McpOperationalProfileApplicationService {
  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {}

  public async get(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const table = stringArg(args, "table");
    const baseEnvironmentUrl = environmentUrl(args, this.config);
    if (!table) return { ok: false, code: "InvalidArguments", message: "table is required." };
    if (!baseEnvironmentUrl) return { ok: false, code: "EnvironmentRequired", message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call." };
    if (!/^https:\/\//i.test(baseEnvironmentUrl)) return { ok: false, code: "InvalidArguments", message: "environmentUrl must use HTTPS." };

    try {
      const token = await getDataverseAccessToken(`${baseEnvironmentUrl}/.default`, this.config.tenantId);
      const apiBase = `${baseEnvironmentUrl}/api/data/v9.2`;
      const get = (path: string) => mcpDataverseGet({ baseUrl: apiBase, path, token, timeoutMs: this.config.requestTimeoutMs });
      const safe = escapeODataString(table);
      const entityResult = await get(`/EntityDefinitions(LogicalName='${safe}')?$select=LogicalName,DisplayName,IsManaged,IsAuditEnabled`);
      const entity = entityResult.data && typeof entityResult.data === "object" && !Array.isArray(entityResult.data) ? entityResult.data as Record<string, unknown> : {};
      const logicalName = typeof entity.LogicalName === "string" && entity.LogicalName.trim() ? entity.LogicalName.trim() : table;
      const displayName = displayLabel(entity.DisplayName) ?? logicalName;
      const escapedLogicalName = escapeODataString(logicalName);
      const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const canonicalContextClient = new McpOperationalProfileDataverseClient(apiBase, this.config.requestTimeoutMs);
      const operationalContextPromise = buildOperationalContextViewModel({
        subject: { type: "entity", logicalName, displayName },
        providers: createDefaultOperationalContextProviders(),
        dataverse: { client: canonicalContextClient, token }
      });

      const settled = await Promise.allSettled([
        get(`/EntityDefinitions(LogicalName='${escapedLogicalName}')/Attributes?$select=LogicalName&$top=${MAX_PROFILE_ROWS}`),
        get(`/EntityDefinitions(LogicalName='${escapedLogicalName}')/ManyToOneRelationships?$select=SchemaName`),
        get(`/EntityDefinitions(LogicalName='${escapedLogicalName}')/OneToManyRelationships?$select=SchemaName`),
        get(`/EntityDefinitions(LogicalName='${escapedLogicalName}')/ManyToManyRelationships?$select=SchemaName`),
        get(`/sdkmessagefilters?$select=sdkmessagefilterid&$filter=${encodeURIComponent(`primaryobjecttypecode eq '${escapedLogicalName}'`)}&$top=50`),
        get(`/workflows?$select=workflowid,category,statecode,mode,primaryentity&$filter=${encodeURIComponent(`primaryentity eq '${escapedLogicalName}' and statecode eq 1`)}&$top=${MAX_PROFILE_ROWS}`),
        get(`/asyncoperations?$select=asyncoperationid,operationtype,primaryentitytype,createdon&$filter=${encodeURIComponent(`primaryentitytype eq '${escapedLogicalName}' and createdon ge ${since}`)}&$top=${MAX_PROFILE_ROWS}`)
      ]);
      const fulfilledRows = (index: number) => settled[index]?.status === "fulfilled" ? rows((settled[index] as PromiseFulfilledResult<DvqrMcpDataverseGetResult>).value.data) : [];
      const attributeRows = fulfilledRows(0);
      const relationshipCount = fulfilledRows(1).length + fulfilledRows(2).length + fulfilledRows(3).length;
      const filterRows = fulfilledRows(4);
      const workflowRows = fulfilledRows(5);
      const asyncRows = fulfilledRows(6);

      let pluginSteps: Array<Record<string, unknown>> = [];
      const filterIds = filterRows.map((row) => guidValue(row.sdkmessagefilterid)).filter((id): id is string => !!id).slice(0, 20);
      if (filterIds.length) {
        try {
          const filter = filterIds.map((id) => `_sdkmessagefilterid_value eq ${id}`).join(" or ");
          pluginSteps = rows((await get(`/sdkmessageprocessingsteps?$select=sdkmessageprocessingstepid,mode,statecode&$filter=${encodeURIComponent(`statecode eq 0 and (${filter})`)}&$top=${MAX_PROFILE_ROWS}`)).data);
        } catch { /* best-effort evidence; canonical profile represents missing evidence conservatively */ }
      }

      const operationTypes = new Set(asyncRows.map((row) => String(row.operationtype ?? "").trim()).filter(Boolean));
      const operationalContext = await operationalContextPromise;
      const profileInput: OperationalProfileInput = {
        entityLogicalName: logicalName,
        entityDisplayName: displayName,
        attributeCount: settled[0]?.status === "fulfilled" ? attributeRows.length : undefined,
        relationshipCount: settled.slice(1, 4).every((item) => item?.status === "fulfilled") ? relationshipCount : undefined,
        synchronousPluginStepCount: filterRows.length || pluginSteps.length ? pluginSteps.filter((row) => numberValue(row.mode) === 0).length : undefined,
        totalPluginStepCount: filterRows.length || pluginSteps.length ? pluginSteps.length : undefined,
        asyncOperationCount7d: settled[6]?.status === "fulfilled" ? asyncRows.length : undefined,
        distinctAsyncOperationCount7d: settled[6]?.status === "fulfilled" ? operationTypes.size : undefined,
        flowReferenceCount: settled[5]?.status === "fulfilled" ? workflowRows.filter((row) => numberValue(row.category) === 5).length : undefined,
        activeWorkflowCount: settled[5]?.status === "fulfilled" ? workflowRows.filter((row) => numberValue(row.category) === 0).length : undefined,
        businessRuleCount: settled[5]?.status === "fulfilled" ? workflowRows.filter((row) => numberValue(row.category) === 2).length : undefined,
        realTimeWorkflowCount: settled[5]?.status === "fulfilled" ? workflowRows.filter((row) => numberValue(row.category) === 0 && numberValue(row.mode) === 1).length : undefined,
        auditingEnabled: booleanValue(entity.IsAuditEnabled),
        isManaged: booleanValue(entity.IsManaged),
        operationalContext
      };
      const profile = buildOperationalProfile(profileInput);
      const acquiredAt = new Date().toISOString();
      const projection = projectOperationalProfileForMcp(profile, { environmentUrl: baseEnvironmentUrl, acquiredAt });
      const unavailableEvidence = settled.map((item, index) => item.status === "rejected" ? ["attributes", "many-to-one relationships", "one-to-many relationships", "many-to-many relationships", "plug-in filters", "workflows/flows/business rules", "async operations (7d)"][index] : undefined).filter(Boolean);

      return {
        ok: true,
        summary: `${displayName} Operational Profile: DVQR Score ${profile.dvqrScore?.displayScore ?? 0}/100 (${profile.dvqrScore?.band ?? "Minimal"}). ${profile.dvqrScore?.summary ?? profile.summary} Live Dataverse evidence acquired for this request is authoritative for current-state interpretation; do not substitute older persisted snapshots unless historical comparison was explicitly requested.`,
        structuredContent: {
          ...projection,
          environmentUrl: baseEnvironmentUrl,
          evidenceAcquisition: {
            mode: "bounded-read-only",
            unavailableEvidence,
            primaryExecutionContext: entityResult.executionContext,
            primaryTransport: entityResult.transport,
            nativeFetchFailure: entityResult.nativeFetchFailure
          }
        }
      };
    } catch (error) {
      return { ok: false, code: "ExecutionFailed", message: error instanceof Error ? error.message : "Operational Profile retrieval failed." };
    }
  }
}
