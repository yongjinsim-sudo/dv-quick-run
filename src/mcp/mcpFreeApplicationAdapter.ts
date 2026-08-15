import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { rankDvqrMetadataEntities, type DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { McpODataApplicationService } from "./mcpODataApplicationService.js";
import { McpCustomApiApplicationService } from "./mcpCustomApiApplicationService.js";
import { McpCustomApiExplainApplicationService } from "./mcpCustomApiExplainApplicationService.js";
import { McpCustomApiRecommendationApplicationService } from "./mcpCustomApiRecommendationApplicationService.js";
import { McpSolutionArchitectureRecommendationApplicationService } from "./mcpSolutionArchitectureRecommendationApplicationService.js";
import { McpCustomApiExecutionPreviewApplicationService } from "./mcpCustomApiExecutionPreviewApplicationService.js";
import { McpCustomApiExecutionApplicationService } from "./mcpCustomApiExecutionApplicationService.js";
import { McpCustomApiExecutionPreviewSessionStore } from "./mcpCustomApiExecutionPreviewSessionStore.js";
import type { McpCustomApiExecutionEvidenceRepository } from "./mcpCustomApiExecutionEvidenceStore.js";
import { createDvqrMcpFreeRuntimeState, type DvqrMcpFreeRuntimeState } from "./mcpFreeRuntimeState.js";
import { McpCustomApiExecutionInterpretationApplicationService } from "./mcpCustomApiExecutionInterpretationApplicationService.js";
import { McpRelationshipApplicationService } from "./mcpRelationshipApplicationService.js";
import { environmentUrl, stringArg } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { McpOperationalProfileApplicationService } from "./mcpOperationalProfileApplicationService.js";

export type { DvqrMcpFreeToolFailure, DvqrMcpFreeToolResult, DvqrMcpFreeToolSuccess } from "./mcpToolResults.js";

export class DvqrMcpFreeApplicationAdapter {
  private readonly oDataApplicationService: McpODataApplicationService;
  private readonly relationshipApplicationService: McpRelationshipApplicationService;
  private readonly operationalProfileApplicationService: McpOperationalProfileApplicationService;
  private readonly customApiApplicationService: McpCustomApiApplicationService;
  private readonly customApiExplainApplicationService: McpCustomApiExplainApplicationService;
  private readonly customApiRecommendationApplicationService: McpCustomApiRecommendationApplicationService;
  private readonly solutionArchitectureRecommendationApplicationService: McpSolutionArchitectureRecommendationApplicationService;
  private readonly customApiExecutionPreviewSessions: McpCustomApiExecutionPreviewSessionStore;
  private readonly customApiExecutionPreviewApplicationService: McpCustomApiExecutionPreviewApplicationService;
  private readonly customApiExecutionApplicationService: McpCustomApiExecutionApplicationService;
  private readonly customApiExecutionEvidence: McpCustomApiExecutionEvidenceRepository;
  private readonly customApiExecutionInterpretationApplicationService: McpCustomApiExecutionInterpretationApplicationService;

  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    runtimeStateOrPreviewSessions: DvqrMcpFreeRuntimeState | McpCustomApiExecutionPreviewSessionStore = createDvqrMcpFreeRuntimeState()
  ) {
    const runtimeState = runtimeStateOrPreviewSessions instanceof McpCustomApiExecutionPreviewSessionStore
      ? { ...createDvqrMcpFreeRuntimeState(), customApiExecutionPreviewSessions: runtimeStateOrPreviewSessions }
      : runtimeStateOrPreviewSessions;
    this.oDataApplicationService = new McpODataApplicationService(config);
    this.relationshipApplicationService = new McpRelationshipApplicationService(config);
    this.operationalProfileApplicationService = new McpOperationalProfileApplicationService(config);
    this.customApiApplicationService = new McpCustomApiApplicationService(config);
    this.customApiExplainApplicationService = new McpCustomApiExplainApplicationService(config, this.customApiApplicationService);
    this.customApiRecommendationApplicationService = new McpCustomApiRecommendationApplicationService(config);
    this.solutionArchitectureRecommendationApplicationService = new McpSolutionArchitectureRecommendationApplicationService(config);
    this.customApiExecutionPreviewSessions = runtimeState.customApiExecutionPreviewSessions;
    this.customApiExecutionEvidence = runtimeState.customApiExecutionEvidence;
    this.customApiExecutionPreviewApplicationService = new McpCustomApiExecutionPreviewApplicationService(config, this.customApiApplicationService, this.customApiExecutionPreviewSessions);
    this.customApiExecutionApplicationService = new McpCustomApiExecutionApplicationService(config, this.customApiExecutionPreviewSessions, undefined, undefined, this.customApiExecutionEvidence);
    this.customApiExecutionInterpretationApplicationService = new McpCustomApiExecutionInterpretationApplicationService(this.customApiExecutionEvidence);
  }

  public explainOData(args: Record<string, unknown>): DvqrMcpFreeToolResult {
    return this.oDataApplicationService.explain(args);
  }

  public executeOData(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.oDataApplicationService.execute(args);
  }

  public async searchMetadata(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const query = stringArg(args, "query");
    const baseEnvironmentUrl = environmentUrl(args, this.config);
    if (!query) {
      return { ok: false, code: "InvalidArguments", message: "query is required." };
    }
    if (!baseEnvironmentUrl) {
      return {
        ok: false,
        code: "EnvironmentRequired",
        message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
      };
    }
    if (!/^https:\/\//i.test(baseEnvironmentUrl)) {
      return { ok: false, code: "InvalidArguments", message: "environmentUrl must use HTTPS." };
    }

    try {
      const token = await getDataverseAccessToken(`${baseEnvironmentUrl}/.default`, this.config.tenantId);
      // Dataverse metadata does not support arbitrary contains filters or $top in this collection.
      // Retrieve a bounded projection once, then rank locally and deterministically.
      const path = "/EntityDefinitions?$select=LogicalName,SchemaName,EntitySetName,DisplayName,Description,PrimaryIdAttribute,PrimaryNameAttribute,IsCustomEntity,IsManaged,OwnershipType";
      const result = await mcpDataverseGet({
        baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
        path,
        token,
        timeoutMs: this.config.requestTimeoutMs
      });
      const record = result.data && typeof result.data === "object" && !Array.isArray(result.data)
        ? result.data as Record<string, unknown>
        : {};
      const candidates = Array.isArray(record.value)
        ? record.value as DvqrMetadataEntityCandidate[]
        : [];
      const requestedMax = Number(args.maxResults ?? 10);
      const maxResults = Number.isFinite(requestedMax) ? Math.max(1, Math.min(50, Math.floor(requestedMax))) : 10;
      const matches = rankDvqrMetadataEntities(query, candidates, maxResults);
      return {
        ok: true,
        summary: matches.length > 0
          ? `Found ${matches.length} deterministic metadata match${matches.length === 1 ? "" : "es"} for “${query}”.`
          : `No deterministic entity metadata matches were found for “${query}”.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-metadata-search-v1",
          environmentUrl: baseEnvironmentUrl,
          query,
          searchMode: "local-deterministic-ranking",
          catalogueEntitiesInspected: candidates.length,
          resultCount: matches.length,
          executionContext: result.executionContext,
          transport: result.transport,
          nativeFetchFailure: result.nativeFetchFailure,
          matches,
          groupedMatches: {
            highestConfidence: matches.filter((match) => match.resultTier === "highest-confidence"),
            related: matches.filter((match) => match.resultTier === "related"),
            contextual: matches.filter((match) => match.resultTier === "contextual")
          },
          presentationGuidance: [
            "Lead with highest-confidence matches.",
            "Keep related and contextual matches visibly separated.",
            "Include DVQR ranking reasons; do not invent semantic relationships that are absent from the result."
          ],
          limitations: [
            "v0.15.4 searches entity definitions only.",
            "Ranking uses explicit metadata fields and a bounded Dataverse concept-alias catalogue; it does not use generative inference.",
            "Attribute, relationship, lookup and choice search remain deferred."
          ]
        }
      };
    } catch (error) {
      return {
        ok: false,
        code: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Metadata search failed."
      };
    }
  }

  public getOperationalProfile(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.operationalProfileApplicationService.get(args);
  }

  public async getEntityMetadata(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const logicalName = stringArg(args, "logicalName");
    const baseEnvironmentUrl = environmentUrl(args, this.config);
    if (!logicalName) {
      return { ok: false, code: "InvalidArguments", message: "logicalName is required." };
    }
    if (!baseEnvironmentUrl) {
      return {
        ok: false,
        code: "EnvironmentRequired",
        message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
      };
    }
    try {
      const token = await getDataverseAccessToken(`${baseEnvironmentUrl}/.default`, this.config.tenantId);
      const path = `/EntityDefinitions(LogicalName='${encodeURIComponent(logicalName)}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute,IsActivity,IsCustomEntity,IsManaged,OwnershipType,SchemaName`;
      const result = await mcpDataverseGet({
        baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
        path,
        token,
        timeoutMs: this.config.requestTimeoutMs
      });
      return {
        ok: true,
        summary: `Metadata retrieved for ${logicalName}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-entity-metadata-v1",
          environmentUrl: baseEnvironmentUrl,
          executionContext: result.executionContext,
          transport: result.transport,
          nativeFetchFailure: result.nativeFetchFailure,
          entity: result.data
        }
      };
    } catch (error) {
      return {
        ok: false,
        code: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Entity metadata retrieval failed."
      };
    }
  }

  public discoverCustomApis(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiApplicationService.discover({
      ...args,
      query: typeof args.query === "string" ? args.query : ""
    });
  }

  public getCustomApiDefinition(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiApplicationService.getDefinition(args);
  }

  public explainCustomApi(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiExplainApplicationService.explain(args);
  }

  public compareCustomApis(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiRecommendationApplicationService.compare(args);
  }

  public recommendCustomApis(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiRecommendationApplicationService.recommend(args);
  }

  public recommendSolutionArchitecture(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.solutionArchitectureRecommendationApplicationService.recommend(args);
  }

  public checkCustomApiExecution(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiExecutionPreviewApplicationService.check(args);
  }

  public previewCustomApiExecution(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiExecutionPreviewApplicationService.preview(args);
  }

  public executeCustomApi(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.customApiExecutionApplicationService.execute(args);
  }

  public interpretCustomApiExecution(args: Record<string, unknown>): DvqrMcpFreeToolResult {
    return this.customApiExecutionInterpretationApplicationService.interpret(args);
  }

  public discoverOperationalAnchors(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.discoverOperationalAnchors(args);
  }

  public resolveNavigationProperty(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.resolveNavigationProperty(args);
  }

  public findRelationshipPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.findRelationshipPaths(args);
  }

  public discoverBusinessPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.discoverBusinessPaths(args);
  }

  public validateBusinessPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.validateBusinessPaths(args);
  }

  public generateRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.generateRelationshipQuery(args);
  }

  public probeRelationshipPath(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.probeRelationshipPath(args);
  }

  public explainLookup(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    return this.relationshipApplicationService.explainLookup(args);
  }

}
