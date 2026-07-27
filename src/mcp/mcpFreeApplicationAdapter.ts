import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { parseDataverseQuery } from "../commands/router/actions/explain/explainQueryParser.js";
import {
  buildDesignNotes,
  buildIntentLines,
  buildOperationalCharacteristics,
  buildSummary,
  buildVerificationGuidance
} from "../commands/router/actions/explain/explainQuerySections.js";
import { buildQuerySemanticModel } from "../core/query/querySemanticModel.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { rankDvqrMetadataEntities, type DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export interface DvqrMcpFreeToolSuccess {
  readonly ok: true;
  readonly summary: string;
  readonly structuredContent: unknown;
}

export interface DvqrMcpFreeToolFailure {
  readonly ok: false;
  readonly code: "InvalidArguments" | "EnvironmentRequired" | "ExecutionFailed";
  readonly message: string;
}

export type DvqrMcpFreeToolResult = DvqrMcpFreeToolSuccess | DvqrMcpFreeToolFailure;

function stringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function environmentUrl(args: Record<string, unknown>, config: DvqrMcpRuntimeConfiguration): string | undefined {
  return stringArg(args, "environmentUrl")?.replace(/\/+$/, "") ?? config.environmentUrl;
}

function boundedResult(data: unknown, maxRecords: number): unknown {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return data;
  }
  const record = data as Record<string, unknown>;
  if (!Array.isArray(record.value)) {
    return data;
  }
  return {
    ...record,
    value: record.value.slice(0, maxRecords),
    dvqrMcp: {
      returnedRecords: Math.min(record.value.length, maxRecords),
      sourceRecordsInResponse: record.value.length,
      truncated: record.value.length > maxRecords
    }
  };
}

export class DvqrMcpFreeApplicationAdapter {
  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {}

  public explainOData(args: Record<string, unknown>): DvqrMcpFreeToolResult {
    const query = stringArg(args, "query");
    if (!query) {
      return { ok: false, code: "InvalidArguments", message: "query is required." };
    }
    const parsed = parseDataverseQuery(query);
    const semanticModel = buildQuerySemanticModel(parsed);
    const summary = buildSummary(parsed);
    return {
      ok: true,
      summary,
      structuredContent: {
        contractVersion: "dvqr-mcp-query-explanation-v1",
        summary,
        intent: buildIntentLines(parsed),
        operationalCharacteristics: buildOperationalCharacteristics(parsed),
        designNotes: buildDesignNotes(parsed),
        verificationGuidance: buildVerificationGuidance(parsed),
        semanticModel
      }
    };
  }

  public async executeOData(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
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
    const parsed = parseDataverseQuery(query);
    if (!parsed.entitySetName) {
      return { ok: false, code: "InvalidArguments", message: "The OData query does not contain an entity set." };
    }
    const normalizedPath = parsed.normalized.startsWith("/") ? parsed.normalized : `/${parsed.normalized}`;
    try {
      const scope = `${baseEnvironmentUrl}/.default`;
      const token = await getDataverseAccessToken(scope, this.config.tenantId);
      const result = await mcpDataverseGet({
        baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
        path: normalizedPath,
        token,
        timeoutMs: this.config.requestTimeoutMs
      });
      const requestedMax = Number(args.maxRecords ?? 100);
      const maxRecords = Number.isFinite(requestedMax) ? Math.max(1, Math.min(500, Math.floor(requestedMax))) : 100;
      const data = boundedResult(result.data, maxRecords);
      return {
        ok: true,
        summary: `Read-only OData GET completed with status ${result.executionContext.statusCode ?? "unknown"}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-odata-result-v1",
          environmentUrl: baseEnvironmentUrl,
          query: parsed.normalized,
          executionContext: result.executionContext,
          transport: result.transport,
          nativeFetchFailure: result.nativeFetchFailure,
          data
        }
      };
    } catch (error) {
      return {
        ok: false,
        code: "ExecutionFailed",
        message: error instanceof Error ? error.message : "Dataverse OData execution failed."
      };
    }
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
}
