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
import { findRelationshipPaths, rankRelationshipPaths, type McpRankedRelationshipPath, type McpRelationshipEdge, type McpRelationshipGraph } from "./mcpRelationshipIntelligence.js";
import { pathMatchesRelationshipHint, selectRelationshipPath } from "./mcpRelationshipIntent.js";
import { describeRelationshipPurpose, explainRelationshipPath } from "./mcpRelationshipExplainability.js";
import { generateRelationshipQuery, type McpEntityShape } from "./mcpRelationshipQueryGenerator.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { rankDvqrMetadataEntities, type DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export interface DvqrMcpFreeToolSuccess {
  readonly ok: true;
  readonly summary: string;
  readonly structuredContent: unknown;
}

export interface DvqrMcpFreeToolFailure {
  readonly ok: false;
  readonly code: "InvalidArguments" | "EnvironmentRequired" | "ExecutionFailed" | "UnknownNavigationProperty";
  readonly message: string;
  readonly structuredError?: unknown;
  readonly structuredContent?: unknown;
}

export type DvqrMcpFreeToolResult = DvqrMcpFreeToolSuccess | DvqrMcpFreeToolFailure;

function stringArg(args: Record<string, unknown>, name: string): string | undefined {
  const value = args[name];
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function environmentUrl(args: Record<string, unknown>, config: DvqrMcpRuntimeConfiguration): string | undefined {
  return stringArg(args, "environmentUrl")?.replace(/\/+$/, "") ?? config.environmentUrl;
}


function presentRelationshipExplainability(explanation: ReturnType<typeof explainRelationshipPath>) {
  return {
    confidence: explanation.confidenceDisplay,
    ratingStars: explanation.ratingStars,
    confidenceLabel: explanation.confidenceLabel,
    purpose: {
      ...explanation.purpose,
      categoryCode: explanation.purpose.category,
      category: explanation.purpose.categoryLabel
    },
    whySelected: explanation.whySelected,
    whyNotFirst: explanation.whyNotFirst,
    diagnostics: {
      score: explanation.confidence,
      scoring: explanation.scoring
    }
  };
}

function presentRelationshipPurpose(purpose: ReturnType<typeof describeRelationshipPurpose>) {
  return {
    ...purpose,
    categoryCode: purpose.category,
    category: purpose.categoryLabel
  };
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
      const structuredError = mapStructuredExecutionError(error, parsed.normalized, parsed.entitySetName);
      return {
        ok: false,
        code: "ExecutionFailed",
        message: structuredError.summary,
        structuredError
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

  private async metadataContext(args: Record<string, unknown>): Promise<{ baseEnvironmentUrl: string; token: string } | DvqrMcpFreeToolFailure> {
    const baseEnvironmentUrl = environmentUrl(args, this.config);
    if (!baseEnvironmentUrl) {
      return { ok: false, code: "EnvironmentRequired", message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call." };
    }
    if (!/^https:\/\//i.test(baseEnvironmentUrl)) {
      return { ok: false, code: "InvalidArguments", message: "environmentUrl must use HTTPS." };
    }
    const token = await getDataverseAccessToken(`${baseEnvironmentUrl}/.default`, this.config.tenantId);
    return { baseEnvironmentUrl, token };
  }

  private async fetchRelationships(baseEnvironmentUrl: string, token: string, logicalName: string): Promise<McpRelationshipEdge[]> {
    const safe = logicalName.replace(/'/g, "''");
    const baseUrl = `${baseEnvironmentUrl}/api/data/v9.2`;
    const [m2o, o2m, m2m] = await Promise.all([
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/ManyToOneRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencingEntityNavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/OneToManyRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedEntityNavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs })
    ]);
    const rows = (x: any) => Array.isArray(x?.data?.value) ? x.data.value : [];
    const edges: McpRelationshipEdge[] = [];
    for (const rel of rows(m2o)) {
      const nav = String(rel.ReferencingEntityNavigationPropertyName ?? "").trim();
      const target = String(rel.ReferencedEntity ?? "").trim();
      if (nav && target) {
        edges.push({ fromTable: logicalName, toTable: target, navigationProperty: nav, relationshipSchemaName: rel.SchemaName, referencingAttribute: rel.ReferencingAttribute, relationshipType: "ManyToOne", direction: "manyToOne", collectionValued: false, polymorphicTargetQualified: true });
      }
    }
    for (const rel of rows(o2m)) {
      const nav = String(rel.ReferencedEntityNavigationPropertyName ?? "").trim();
      const target = String(rel.ReferencingEntity ?? "").trim();
      if (nav && target) {
        edges.push({ fromTable: logicalName, toTable: target, navigationProperty: nav, relationshipSchemaName: rel.SchemaName, referencingAttribute: rel.ReferencingAttribute, relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true, polymorphicTargetQualified: true });
      }
    }
    for (const rel of rows(m2m)) {
      const e1 = String(rel.Entity1LogicalName ?? "").trim(); const e2 = String(rel.Entity2LogicalName ?? "").trim();
      if (e1.toLowerCase() === logicalName.toLowerCase() && rel.Entity1NavigationPropertyName) {
        edges.push({ fromTable: logicalName, toTable: e2, navigationProperty: String(rel.Entity1NavigationPropertyName), relationshipSchemaName: rel.SchemaName, relationshipType: "ManyToMany", direction: "manyToMany", collectionValued: true });
      }
      if (e2.toLowerCase() === logicalName.toLowerCase() && rel.Entity2NavigationPropertyName) {
        edges.push({ fromTable: logicalName, toTable: e1, navigationProperty: String(rel.Entity2NavigationPropertyName), relationshipSchemaName: rel.SchemaName, relationshipType: "ManyToMany", direction: "manyToMany", collectionValued: true });
      }
    }
    return edges.sort((a,b) => a.navigationProperty.localeCompare(b.navigationProperty));
  }


  private async fetchEntityShape(baseEnvironmentUrl: string, token: string, logicalName: string): Promise<McpEntityShape> {
    const safe = logicalName.replace(/'/g, "''");
    const result = await mcpDataverseGet<any>({
      baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
      path: `/EntityDefinitions(LogicalName='${safe}')?$select=LogicalName,EntitySetName,PrimaryIdAttribute,PrimaryNameAttribute`,
      token,
      timeoutMs: this.config.requestTimeoutMs
    });
    const row = result.data as any;
    return {
      logicalName: String(row.LogicalName ?? logicalName),
      entitySetName: String(row.EntitySetName ?? `${logicalName}s`),
      primaryIdAttribute: String(row.PrimaryIdAttribute ?? `${logicalName}id`),
      primaryNameAttribute: row.PrimaryNameAttribute ? String(row.PrimaryNameAttribute) : undefined
    };
  }

  private async discoverRankedPaths(context: { baseEnvironmentUrl: string; token: string }, sourceTable: string, targetTable: string, maxDepth: number, maxPaths: number): Promise<{ ranked: readonly McpRankedRelationshipPath[]; nodes: Set<string>; edges: McpRelationshipEdge[] }> {
    const nodes = new Set<string>([sourceTable.toLowerCase(), targetTable.toLowerCase()]);
    const edges: McpRelationshipEdge[] = [];
    const queue: Array<{ table: string; depth: number }> = [{ table: sourceTable, depth: 0 }];
    while (queue.length && nodes.size <= 200) {
      const current = queue.shift()!;
      const tableEdges = await this.fetchRelationships(context.baseEnvironmentUrl, context.token, current.table);
      edges.push(...tableEdges);
      for (const candidate of tableEdges.map((edge) => edge.toTable).filter((tableName) => !nodes.has(tableName.toLowerCase()))) {
        nodes.add(candidate.toLowerCase());
        if (nodes.size < 200 && current.depth + 1 < maxDepth) {
          queue.push({ table: candidate, depth: current.depth + 1 });
        }
      }
      const graphNow: McpRelationshipGraph = { nodes: [...nodes], edges };
      if (findRelationshipPaths(graphNow, sourceTable, targetTable, { maxDepth, maxPaths }).length >= maxPaths || nodes.size >= 200) {
        break;
      }
    }
    const graph: McpRelationshipGraph = { nodes: [...nodes], edges };
    return { ranked: rankRelationshipPaths(findRelationshipPaths(graph, sourceTable, targetTable, { maxDepth, maxPaths })), nodes, edges };
  }

  public async resolveNavigationProperty(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const edges = await this.fetchRelationships(context.baseEnvironmentUrl, context.token, sourceTable);
      const direct = edges.filter((edge) => edge.toTable.toLowerCase() === targetTable.toLowerCase());
      const guessed = stringArg(args, "guessedProperty");
      const guessedPropertyMatched = guessed ? direct.some((edge) => edge.navigationProperty.toLowerCase() === guessed.toLowerCase()) : undefined;
      const structuredContent = {
        contractVersion: "dvqr-mcp-navigation-resolution-v2", sourceTable, targetTable, guessedProperty: guessed,
        guessedPropertyMatched,
        directMatches: direct.map((edge) => ({ ...edge, lookupValueProperty: edge.referencingAttribute ? `_${edge.referencingAttribute}_value` : undefined, expandFragment: `$expand=${edge.navigationProperty}` })),
        directExpansionAvailable: direct.length > 0,
        queryGenerated: false,
        placeholderQueryAllowed: false,
        evidenceBoundary: guessed && !guessedPropertyMatched
          ? `No metadata-verified navigation property named ${guessed} was found. Do not generate or present a query using this unverified name.`
          : undefined,
        suggestedNextActions: guessed && !guessedPropertyMatched
          ? ["Do not generate a placeholder query.", "Use one of the returned directMatches only when it matches the intended business relationship.", "Run dvqr_find_relationship_paths with relationshipHint to discover verified alternatives."]
          : direct.length ? ["Use the exact target-qualified navigation property.", "Validate selected nested fields before execution."] : ["Run dvqr_find_relationship_paths to discover a bridge-table path."]
      };
      if (guessed && !guessedPropertyMatched) {
        return { ok: false, code: "UnknownNavigationProperty", message: `No metadata-verified navigation property named ${guessed} connects ${sourceTable} to ${targetTable}. No query was generated.`, structuredContent };
      }
      return { ok: true, summary: direct.length ? `Resolved ${direct.length} direct navigation propert${direct.length === 1 ? "y" : "ies"} from ${sourceTable} to ${targetTable}.` : `No direct navigation property connects ${sourceTable} to ${targetTable}.`, structuredContent };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok:false, code:"ExecutionFailed", message:structuredError.summary, structuredError }; }
  }

  public async findRelationshipPaths(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok:false, code:"InvalidArguments", message:"sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const maxPaths = Math.max(1, Math.min(50, Number(args.maxPaths ?? 10)));
      const { ranked, nodes, edges } = await this.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, maxPaths);
      const relationshipHint = stringArg(args, "relationshipHint");
      const hintedPath = relationshipHint ? ranked.find((path) => pathMatchesRelationshipHint(path, relationshipHint)) : undefined;
      const presentationPaths = hintedPath ? [hintedPath, ...ranked.filter((path) => path.pathId !== hintedPath.pathId)] : ranked;
      const compactPaths = presentationPaths.slice(0, 5).map((path, index) => ({
        rank: index + 1,
        assessment: path.assessment,
        score: path.score,
        tables: path.tables,
        pathId: path.pathId,
        explainability: presentRelationshipExplainability(explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 })),
        whySelected: explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 }).whySelected,
        hops: path.hops.map((hop) => ({ fromTable: hop.fromTable, toTable: hop.toTable, navigationProperty: hop.navigationProperty, relationshipType: hop.relationshipType, direction: hop.direction, referencingAttribute: hop.referencingAttribute, polymorphicTargetQualified: hop.polymorphicTargetQualified, purpose: presentRelationshipPurpose(describeRelationshipPurpose(hop)) }))
      }));
      return { ok:true, summary: presentationPaths.length ? `Best verified path: ${presentationPaths[0].tables.join(" → ")} · ${compactPaths[0]?.explainability.confidence ?? "metadata verified"}.` : `No verified relationship path was found within depth ${maxDepth}.`, structuredContent: {
        contractVersion:"dvqr-mcp-relationship-paths-v4", sourceTable, targetTable, relationshipHint, relationshipHintMatched: relationshipHint ? !!hintedPath : undefined, searchBounds:{ maxDepth, maxPaths, graphNodesInspected:nodes.size, graphEdgesInspected:edges.length },
        recommendedPath:compactPaths[0], alternatives:compactPaths.slice(1),
        suggestedNextActions: ranked.length ? ["Run dvqr_generate_relationship_query with this source and target to create metadata-verified query templates.", "Provide sourceRecordId to dvqr_probe_relationship_path for an explicit bounded runtime probe."] : ["Increase maxDepth cautiously or verify the table logical names."],
        limitations:["Metadata-valid paths are not proof that matching records exist.", "Only the five highest-ranked paths are returned inline to keep MCP responses compact."]
      }};
    } catch(error) { const structuredError=mapStructuredExecutionError(error); return { ok:false, code:"ExecutionFailed", message:structuredError.summary, structuredError }; }
  }

  public async generateRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable");
    if (!sourceTable || !targetTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable and targetTable are required." };
    }
    try {
      const context = await this.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const { ranked } = await this.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, 10);
      if (!ranked.length) {
        return { ok: false, code: "InvalidArguments", message: `No verified relationship path was found from ${sourceTable} to ${targetTable}.` };
      }
      const selectedPathId = stringArg(args, "pathId");
      const relationshipHint = stringArg(args, "relationshipHint");
      const selected = selectRelationshipPath(ranked, selectedPathId, relationshipHint);
      if (!selected) {
        if (relationshipHint) {
          return {
            ok: false,
            code: "UnknownNavigationProperty",
            message: `No metadata-verified relationship named ${relationshipHint} connects ${sourceTable} to ${targetTable}. No query was generated.`,
            structuredContent: {
              contractVersion: "dvqr-mcp-relationship-query-refusal-v1",
              sourceTable,
              targetTable,
              relationshipHint,
              relationshipHintMatched: false,
              queryGenerated: false,
              placeholderQueryAllowed: false,
              evidenceBoundary: "DVQR did not emit a query because the requested relationship could not be verified from Dataverse metadata.",
              suggestedNextActions: [
                "Run dvqr_resolve_navigation_property to inspect exact direct navigation properties.",
                "Run dvqr_find_relationship_paths to inspect verified alternatives.",
                "Do not substitute or invent a navigation property."
              ]
            }
          };
        }
        return { ok: false, code: "InvalidArguments", message: "pathId did not match a verified relationship path. Copy pathId exactly from dvqr_find_relationship_paths; do not construct or guess it." };
      }
      const shapes = await Promise.all(selected.tables.map((table) => this.fetchEntityShape(context.baseEnvironmentUrl, context.token, table)));
      const generated = generateRelationshipQuery(selected, shapes, stringArg(args, "sourceRecordId"), Math.max(1, Math.min(20, Number(args.maxRecordsPerStep ?? 5))));
      const relationshipHintHonoured = relationshipHint ? pathMatchesRelationshipHint(selected, relationshipHint) : false;
      const explainability = explainRelationshipPath(selected, { relationshipHintHonoured, rank: 1 });
      return { ok: true, summary: `Generated a ${generated.recommendedMode} query plan for ${selected.tables.join(" → ")} · ${explainability.confidenceDisplay}.`, structuredContent: { contractVersion: "dvqr-mcp-relationship-query-v4", relationshipHint, relationshipHintHonoured: relationshipHint ? relationshipHintHonoured : undefined, selectedPath: { assessment: selected.assessment, score: selected.score, tables: selected.tables, explainability: presentRelationshipExplainability(explainability) }, generated } };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError }; }
  }

  public async probeRelationshipPath(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable"); const targetTable = stringArg(args, "targetTable"); const sourceRecordId = stringArg(args, "sourceRecordId");
    if (!sourceTable || !targetTable || !sourceRecordId) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable, targetTable and sourceRecordId are required." };
    }
    try {
      const context = await this.metadataContext(args);
      if ("ok" in context) {
        return context;
      }
      const maxDepth = Math.max(1, Math.min(6, Number(args.maxDepth ?? 4)));
      const maxRecordsPerStep = Math.max(1, Math.min(10, Number(args.maxRecordsPerStep ?? 3)));
      const { ranked } = await this.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, 10);
      if (!ranked.length) {
        return { ok: false, code: "InvalidArguments", message: `No verified relationship path was found from ${sourceTable} to ${targetTable}.` };
      }
      const selectedPathId = stringArg(args, "pathId");
      const relationshipHint = stringArg(args, "relationshipHint");
      const selected = selectRelationshipPath(ranked, selectedPathId, relationshipHint);
      if (!selected) {
        return { ok: false, code: "InvalidArguments", message: relationshipHint ? `No verified path matched the requested relationship ${relationshipHint}. No query was generated; do not construct a placeholder query from this unverified name.` : "pathId did not match a verified relationship path." };
      }
      const shapes = await Promise.all(selected.tables.map((table) => this.fetchEntityShape(context.baseEnvironmentUrl, context.token, table)));
      const generated = generateRelationshipQuery(selected, shapes, sourceRecordId, maxRecordsPerStep);
      let currentIds = [sourceRecordId];
      const probeSteps: any[] = [];
      for (const step of generated.stagedQueries) {
        const targetShape = shapes.find((shape) => shape.logicalName.toLowerCase() === step.toTable.toLowerCase())!;
        const nextIds: string[] = [];
        const attempts: any[] = [];
        for (const currentId of currentIds.slice(0, maxRecordsPerStep)) {
          const query = step.queryTemplate.replace(/<[^>]+>/, currentId);
          const result = await mcpDataverseGet<any>({ baseUrl: `${context.baseEnvironmentUrl}/api/data/v9.2`, path: `/${query}`, token: context.token, timeoutMs: this.config.requestTimeoutMs });
          const data: any = result.data;
          const rows = Array.isArray(data?.value) ? data.value : data && typeof data === "object" ? [data] : [];
          for (const row of rows.slice(0, maxRecordsPerStep)) {
            const value = row?.[targetShape.primaryIdAttribute];
            if (typeof value === "string" && value) { nextIds.push(value); }
          }
          attempts.push({ sourceRecordId: currentId, query, returnedRecords: rows.length, transport: result.transport });
        }
        probeSteps.push({ ...step, attempts, continuationRecordCount: nextIds.length, status: nextIds.length ? "DataObserved" : "NoMatchingDataObserved" });
        currentIds = [...new Set(nextIds)].slice(0, maxRecordsPerStep);
        if (!currentIds.length) { break; }
      }
      const reachedTarget = probeSteps.length === selected.hops.length && currentIds.length > 0;
      return { ok: true, summary: reachedTarget ? `Runtime probe reached ${targetTable} through ${selected.tables.join(" → ")}.` : `Runtime probe stopped after ${probeSteps.length} of ${selected.hops.length} hop(s); no matching continuation data was observed.`, structuredContent: { contractVersion: "dvqr-mcp-relationship-probe-v2", sourceTable, targetTable, sourceRecordId, selectedPath: { pathId: selected.pathId, tables: selected.tables, score: selected.score, explainability: presentRelationshipExplainability(explainRelationshipPath(selected, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(selected, relationshipHint), rank: 1 })) }, bounds: { maxDepth, maxRecordsPerStep }, reachedTarget, finalTargetRecordIds: currentIds, steps: probeSteps, limitations: ["A successful probe proves only that matching records were observed for this source record at this time.", "No-match results do not invalidate the metadata relationship.", "The probe is read-only and bounded; it does not exhaustively enumerate all related records."] } };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError }; }
  }

  public async explainLookup(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable=stringArg(args,"sourceTable"); const lookup=stringArg(args,"lookup");
    if(!sourceTable||!lookup) {
      return {ok:false,code:"InvalidArguments",message:"sourceTable and lookup are required."};
    }
    try {
      const context=await this.metadataContext(args);
      if("ok" in context) {
        return context;
      }
      const safe=sourceTable.replace(/'/g,"''");
      const baseUrl=`${context.baseEnvironmentUrl}/api/data/v9.2`;
      const [attrs, edges]=await Promise.all([
        mcpDataverseGet<any>({baseUrl,path:`/EntityDefinitions(LogicalName='${safe}')/Attributes/Microsoft.Dynamics.CRM.LookupAttributeMetadata?$select=LogicalName,SchemaName,DisplayName,AttributeType,Targets`,token:context.token,timeoutMs:this.config.requestTimeoutMs}),
        this.fetchRelationships(context.baseEnvironmentUrl,context.token,sourceTable)
      ]);
      const rows=Array.isArray((attrs.data as any)?.value)?(attrs.data as any).value:[];
      const attr=rows.find((row:any)=>String(row.LogicalName??"").toLowerCase()===lookup.toLowerCase()||`_${String(row.LogicalName??"").toLowerCase()}_value`===lookup.toLowerCase());
      if(!attr) {
        return {ok:false,code:"InvalidArguments",message:`Lookup ${lookup} was not found on ${sourceTable}.`};
      }
      const logicalName=String(attr.LogicalName); const targets=Array.isArray(attr.Targets)?attr.Targets.map(String):[];
      const targetDetails=targets.map((target:string)=>({targetTable:target,navigationProperties:edges.filter((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase()&&edge.toTable.toLowerCase()===target.toLowerCase()).map((edge)=>({name:edge.navigationProperty,relationshipSchemaName:edge.relationshipSchemaName,expandFragment:`$expand=${edge.navigationProperty}`}))}));
      return {ok:true,summary:`${sourceTable}.${logicalName} targets ${targets.length || targetDetails.length} table${(targets.length||targetDetails.length)===1?"":"s"}.`,structuredContent:{contractVersion:"dvqr-mcp-lookup-explanation-v2",sourceTable,logicalName,displayName:attr.DisplayName,attributeType:attr.AttributeType,valueProperty:`_${logicalName}_value`,targets:targetDetails,relationshipPurpose:edges.find((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase())?presentRelationshipPurpose(describeRelationshipPurpose(edges.find((edge)=>edge.referencingAttribute?.toLowerCase()===logicalName.toLowerCase())!)):undefined,runtimeTargetAnnotation:`_${logicalName}_value@Microsoft.Dynamics.CRM.lookuplogicalname`,formattedValueAnnotation:`_${logicalName}_value@OData.Community.Display.V1.FormattedValue`,selectExample:`$select=_${logicalName}_value`,limitations:["Supported targets describe schema validity; the runtime annotation identifies the target used by a particular row."]}};
    } catch(error){const structuredError=mapStructuredExecutionError(error);return{ok:false,code:"ExecutionFailed",message:structuredError.summary,structuredError};}
  }

}
