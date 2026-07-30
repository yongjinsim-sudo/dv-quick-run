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
import { buildRelationshipPathGuidance, classifyProbeOutcome } from "./mcpRelationshipGuidance.js";
import { describeRelationshipPurpose, explainRelationshipPath } from "./mcpRelationshipExplainability.js";
import { generateRelationshipQuery, type McpEntityShape } from "./mcpRelationshipQueryGenerator.js";
import { mapStructuredExecutionError } from "./mcpStructuredErrors.js";
import { rankDvqrMetadataEntities, type DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import { buildRuntimeObservation, rankRuntimeObservations, relationshipPathFamily, selectDiverseRelationshipPaths, type McpRelationshipRuntimeObservation } from "./mcpRelationshipRuntimeEvidence.js";
import { rootEntitySetFromODataQuery } from "./mcpODataPath.js";
import { rankOperationalAnchors } from "./mcpOperationalAnchorDiscovery.js";
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
    metadataConfidence: explanation.confidenceDisplay,
    confidence: explanation.confidenceDisplay,
    confidenceKind: explanation.confidenceKind,
    businessConfidence: explanation.businessConfidence,
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

function describeBoundedResult(data: unknown): { recordCount?: number; truncated: boolean } {
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return { truncated: false };
  }
  const record = data as Record<string, unknown>;
  const dvqrMcp = record.dvqrMcp;
  if (dvqrMcp && typeof dvqrMcp === "object" && !Array.isArray(dvqrMcp)) {
    const details = dvqrMcp as Record<string, unknown>;
    return {
      recordCount: typeof details.returnedRecords === "number" ? details.returnedRecords : undefined,
      truncated: details.truncated === true
    };
  }
  return { truncated: false };
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
    const rootEntitySetName = parsed.entitySetName ?? rootEntitySetFromODataQuery(query);
    if (!rootEntitySetName) {
      return { ok: false, code: "InvalidArguments", message: "The OData query does not contain a valid root entity set." };
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
      const resultDetails = describeBoundedResult(data);
      const recordSummary = resultDetails.recordCount === undefined
        ? "Response payload returned."
        : `${resultDetails.recordCount} record${resultDetails.recordCount === 1 ? "" : "s"} returned${resultDetails.truncated ? " (bounded result truncated)" : ""}.`;
      return {
        ok: true,
        summary: `Read-only OData GET completed with status ${result.executionContext.statusCode ?? "unknown"}. ${recordSummary}`,
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
      const structuredError = mapStructuredExecutionError(error, parsed.normalized, rootEntitySetName);
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
    const [m2oResult, o2mResult, m2mResult] = await Promise.allSettled([
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/ManyToOneRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencingEntityNavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/OneToManyRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedEntityNavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet<any>({ baseUrl, path: `/EntityDefinitions(LogicalName='${safe}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName`, token, timeoutMs: this.config.requestTimeoutMs })
    ]);
    const fulfilled = (result: PromiseSettledResult<any>) => result.status === "fulfilled" ? result.value : undefined;
    const m2o = fulfilled(m2oResult);
    const o2m = fulfilled(o2mResult);
    const m2m = fulfilled(m2mResult);
    if (!m2o && !o2m && !m2m) {
      throw m2oResult.status === "rejected" ? m2oResult.reason : o2mResult.status === "rejected" ? o2mResult.reason : (m2mResult as PromiseRejectedResult).reason;
    }
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

  private async fetchEntityCatalogue(baseEnvironmentUrl: string, token: string): Promise<DvqrMetadataEntityCandidate[]> {
    const result = await mcpDataverseGet<any>({
      baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
      path: "/EntityDefinitions?$select=LogicalName,SchemaName,EntitySetName,DisplayName,Description,PrimaryIdAttribute,PrimaryNameAttribute,IsCustomEntity,IsManaged,OwnershipType",
      token,
      timeoutMs: this.config.requestTimeoutMs
    });
    const rows = (result.data as any)?.value;
    return Array.isArray(rows) ? rows : [];
  }

  private async resolveRuntimeTargetCandidates(
    context: { baseEnvironmentUrl: string; token: string },
    targetTable: string,
    expandTargetConcept: boolean,
    maxTargetCandidates: number
  ): Promise<readonly string[]> {
    const exact = targetTable.trim().toLowerCase();
    if (!expandTargetConcept) {
      return [targetTable];
    }
    const catalogue = await this.fetchEntityCatalogue(context.baseEnvironmentUrl, context.token);
    const ranked = rankDvqrMetadataEntities(targetTable, catalogue, Math.max(4, maxTargetCandidates * 2));
    const candidates = [targetTable, ...ranked.map((match) => match.logicalName)]
      .filter((value, index, all) => value && all.findIndex((candidate) => candidate.toLowerCase() === value.toLowerCase()) === index);
    const taskLike = /^(task|tasks)$/i.test(targetTable)
      ? candidates.filter((value) => value.toLowerCase() === exact || /task|workitem|activity/.test(value.toLowerCase()))
      : candidates;
    return taskLike.slice(0, Math.max(1, Math.min(6, maxTargetCandidates)));
  }

  private async probeRankedRelationshipPath(
    context: { baseEnvironmentUrl: string; token: string },
    path: McpRankedRelationshipPath,
    sourceRecordId: string,
    maxRecordsPerStep: number,
    budget: { remaining: number }
  ): Promise<{
    readonly observation: McpRelationshipRuntimeObservation;
    readonly reachedTarget: boolean;
    readonly finalTargetRecordIds: readonly string[];
    readonly steps: readonly unknown[];
    readonly probeRequestsUsed: number;
  }> {
    const shapes = await Promise.all(path.tables.map((table) => this.fetchEntityShape(context.baseEnvironmentUrl, context.token, table)));
    const generated = generateRelationshipQuery(path, shapes, sourceRecordId, maxRecordsPerStep);
    let currentIds = [sourceRecordId];
    const probeSteps: any[] = [];
    let probeRequestsUsed = 0;
    let intermediateRowsObserved = 0;
    let budgetExhausted = false;

    for (const step of generated.stagedQueries) {
      const targetShape = shapes.find((shape) => shape.logicalName.toLowerCase() === step.toTable.toLowerCase())!;
      const nextIds: string[] = [];
      const attempts: any[] = [];
      for (const currentId of currentIds.slice(0, maxRecordsPerStep)) {
        if (budget.remaining <= 0) {
          budgetExhausted = true;
          break;
        }
        budget.remaining -= 1;
        probeRequestsUsed += 1;
        const query = step.queryTemplate.replace(/<[^>]+>/, currentId);
        const result = await mcpDataverseGet<any>({
          baseUrl: `${context.baseEnvironmentUrl}/api/data/v9.2`,
          path: `/${query}`,
          token: context.token,
          timeoutMs: this.config.requestTimeoutMs
        });
        const data: any = result.data;
        const rows = Array.isArray(data?.value) ? data.value : data && typeof data === "object" ? [data] : [];
        for (const row of rows.slice(0, maxRecordsPerStep)) {
          const value = row?.[targetShape.primaryIdAttribute];
          if (typeof value === "string" && value) {
            nextIds.push(value);
          }
        }
        attempts.push({ sourceRecordId: currentId, query, returnedRecords: rows.length, transport: result.transport });
      }
      probeSteps.push({
        ...step,
        attempts,
        continuationRecordCount: nextIds.length,
        status: nextIds.length ? "DataObserved" : budgetExhausted ? "ProbeBudgetExhausted" : "NoMatchingDataObserved"
      });
      if (step.index < generated.stagedQueries.length) {
        intermediateRowsObserved += nextIds.length;
      }
      currentIds = [...new Set(nextIds)].slice(0, maxRecordsPerStep);
      if (!currentIds.length || budgetExhausted) {
        break;
      }
    }

    const reachedTarget = !budgetExhausted && probeSteps.length === path.hops.length && currentIds.length > 0;
    const observation = buildRuntimeObservation({
      path,
      reachedTarget,
      completedHops: probeSteps.length,
      intermediateRowsObserved,
      finalTargetRecordCount: reachedTarget ? currentIds.length : 0,
      probeBudgetExhausted: budgetExhausted
    });
    return {
      observation,
      reachedTarget,
      finalTargetRecordIds: reachedTarget ? currentIds : [],
      steps: probeSteps,
      probeRequestsUsed
    };
  }

  private async discoverRankedPaths(context: { baseEnvironmentUrl: string; token: string }, sourceTable: string, targetTable: string, maxDepth: number, maxPaths: number): Promise<{ ranked: readonly McpRankedRelationshipPath[]; nodes: Set<string>; edges: McpRelationshipEdge[]; coverage: { tablesInspected: number; directPathsFound: number; bridgedPathsFound: number; operationalHubsInspected: readonly string[]; explorationComplete: boolean } }> {
    const maxNodes = 200;
    const maxTablesInspected = 80;
    const nodes = new Set<string>([sourceTable.toLowerCase(), targetTable.toLowerCase()]);
    const edges: McpRelationshipEdge[] = [];
    const inspected = new Set<string>();
    const operationalHubsInspected = new Set<string>();
    const queue: Array<{ table: string; depth: number; priority: number }> = [{ table: sourceTable, depth: 0, priority: 1000 }];

    const workflowPriority = (table: string): number => {
      const value = table.toLowerCase();
      if (/(careplan|care_plan|careplanactivity|care_plan_activity)/.test(value)) return 120;
      if (/(case|incident|episode|encounter|order|workorder|booking|appointment|plan|activity|process|journey)/.test(value)) return 80;
      if (/(task|workitem)/.test(value)) return 60;
      if (/^(systemuser|team|businessunit|organization|role|principal|owner)$/.test(value)) return -100;
      return 0;
    };

    while (queue.length && nodes.size <= maxNodes && inspected.size < maxTablesInspected) {
      queue.sort((left, right) => right.priority - left.priority || left.depth - right.depth || left.table.localeCompare(right.table));
      const current = queue.shift()!;
      const currentKey = current.table.toLowerCase();
      if (inspected.has(currentKey)) continue;
      inspected.add(currentKey);
      if (workflowPriority(current.table) >= 60 && currentKey !== sourceTable.toLowerCase() && currentKey !== targetTable.toLowerCase()) {
        operationalHubsInspected.add(current.table);
      }
      const tableEdges = await this.fetchRelationships(context.baseEnvironmentUrl, context.token, current.table);
      edges.push(...tableEdges);
      for (const candidate of tableEdges.map((edge) => edge.toTable)) {
        const candidateKey = candidate.toLowerCase();
        if (!nodes.has(candidateKey)) nodes.add(candidateKey);
        if (nodes.size < maxNodes && current.depth + 1 < maxDepth && !inspected.has(candidateKey)) {
          queue.push({ table: candidate, depth: current.depth + 1, priority: workflowPriority(candidate) - current.depth * 5 });
        }
      }
      // Intentionally do not stop when enough direct paths are found. Operational workflow
      // candidates may only become visible after expanding materially different bridge tables.
    }
    const graph: McpRelationshipGraph = { nodes: [...nodes], edges };
    const discovered = findRelationshipPaths(graph, sourceTable, targetTable, { maxDepth, maxPaths: Math.max(maxPaths * 5, 50) });
    const allRanked = rankRelationshipPaths(discovered);
    const ranked = selectDiverseRelationshipPaths(allRanked, { maxFamilies: Math.min(8, maxPaths), maxCandidates: maxPaths });
    return {
      ranked,
      nodes,
      edges,
      coverage: {
        tablesInspected: inspected.size,
        directPathsFound: discovered.filter((path) => path.length === 1).length,
        bridgedPathsFound: discovered.filter((path) => path.length > 1).length,
        operationalHubsInspected: [...operationalHubsInspected].sort(),
        explorationComplete: queue.length === 0
      }
    };
  }


  public async discoverOperationalAnchors(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    if (!sourceTable) {
      return { ok: false, code: "InvalidArguments", message: "sourceTable is required." };
    }
    try {
      const context = await this.metadataContext(args);
      if ("ok" in context) return context;
      const maxDepth = Math.max(1, Math.min(5, Number(args.maxDepth ?? 3)));
      const maxResults = Math.max(1, Math.min(20, Number(args.maxResults ?? 8)));
      const maxTablesInspected = Math.max(10, Math.min(100, Number(args.maxTablesInspected ?? 60)));
      const catalogue = await this.fetchEntityCatalogue(context.baseEnvironmentUrl, context.token);
      const queue: Array<{ table: string; depth: number }> = [{ table: sourceTable, depth: 0 }];
      const inspected = new Set<string>();
      const depthByTable = new Map<string, number>([[sourceTable.toLowerCase(), 0]]);
      const edges: McpRelationshipEdge[] = [];
      while (queue.length && inspected.size < maxTablesInspected) {
        const current = queue.shift()!;
        const key = current.table.toLowerCase();
        if (inspected.has(key)) continue;
        inspected.add(key);
        if (current.depth >= maxDepth) continue;
        const tableEdges = await this.fetchRelationships(context.baseEnvironmentUrl, context.token, current.table);
        edges.push(...tableEdges);
        for (const edge of tableEdges) {
          const next = edge.toTable.toLowerCase();
          const nextDepth = current.depth + 1;
          if (!depthByTable.has(next) || nextDepth < depthByTable.get(next)!) depthByTable.set(next, nextDepth);
          if (nextDepth < maxDepth && !inspected.has(next)) queue.push({ table: edge.toTable, depth: nextDepth });
        }
      }
      const anchors = rankOperationalAnchors({ sourceTable, entities: catalogue, edges, depthByTable, maxResults });
      const operationalAnchors = anchors.filter((anchor) => anchor.role === "OperationalAnchor");
      const workItems = anchors.filter((anchor) => anchor.role === "WorkItem");
      const capabilityOrder = ["Governance", "Domain", "Scheduling", "Coordination", "Execution", "Integration"] as const;
      const capabilityModel = capabilityOrder.map((capability) => {
        const objects = anchors
          .filter((anchor) => anchor.capabilityProfile.some((signal) => signal.capability === capability))
          .map((anchor) => ({
            logicalName: anchor.logicalName,
            displayName: anchor.displayName,
            role: anchor.role,
            score: anchor.capabilityProfile.find((signal) => signal.capability === capability)!.score,
            evidence: anchor.capabilityProfile.find((signal) => signal.capability === capability)!.evidence
          }))
          .sort((left, right) => right.score - left.score || left.logicalName.localeCompare(right.logicalName));
        return objects.length ? { capability, confidence: objects[0].score >= 70 ? "high" : objects[0].score >= 40 ? "medium" : "low", objects } : undefined;
      }).filter((item): item is NonNullable<typeof item> => !!item);
      const primaryCapability = capabilityModel
        .filter((item) => item.objects.some((object) => object.role === "OperationalAnchor"))
        .sort((left, right) => right.objects[0].score - left.objects[0].score || left.capability.localeCompare(right.capability))[0];
      const confidenceState = (score?: number) => score === undefined
        ? "Unknown"
        : score >= 70
          ? "HighConfidence"
          : score >= 40
            ? "MediumConfidence"
            : "RuntimeVerificationRecommended";
      const capabilityLandscape = [
        { layer: "CoreDomain", label: "Core Domain", capabilities: ["Domain"] },
        { layer: "Coordination", label: "Coordination", capabilities: ["Coordination"] },
        { layer: "Execution", label: "Execution", capabilities: ["Execution", "Scheduling"] },
        { layer: "Governance", label: "Governance", capabilities: ["Governance"] },
        { layer: "Platform", label: "Platform", capabilities: ["Integration"] }
      ].map((layer) => ({
        ...layer,
        capabilities: capabilityModel
          .filter((item) => layer.capabilities.includes(item.capability))
          .map((item) => ({
            capability: item.capability,
            confidenceState: confidenceState(item.objects[0]?.score),
            evidenceType: "StructuralMetadata",
            objects: item.objects.slice(0, 5)
          }))
      })).filter((layer) => layer.capabilities.length > 0);
      const conclusionCard = (title: string, candidate: typeof anchors[number] | undefined) => candidate ? {
        title,
        subject: candidate.logicalName,
        displayName: candidate.displayName,
        confidenceState: confidenceState(candidate.score),
        score: candidate.score,
        evidenceType: "StructuralMetadata",
        whyWeBelieveThis: candidate.reasons.slice(0, 5).map((reason) => reason.message),
        runtimeStatus: "NotProbed",
        uncertainty: "This conclusion is metadata-derived. Runtime participation must be verified separately."
      } : {
        title,
        confidenceState: "Unknown",
        evidenceType: "InsufficientEvidence",
        whyWeBelieveThis: [],
        runtimeStatus: "NotProbed",
        uncertainty: "No bounded metadata candidate was strong enough to support this conclusion."
      };
      const learnFirst = [operationalAnchors[0], ...operationalAnchors.slice(1, 3), workItems[0]]
        .filter((item, index, all): item is NonNullable<typeof item> => !!item && all.findIndex((candidate) => candidate?.logicalName === item.logicalName) === index)
        .map((item) => ({ logicalName: item.logicalName, displayName: item.displayName, reason: item.reasons[0]?.message }));
      return {
        ok: true,
        summary: operationalAnchors.length
          ? `Top metadata-derived operational anchor: ${operationalAnchors[0].logicalName} (${operationalAnchors[0].score}/100).`
          : `No high-confidence operational anchor was found within depth ${maxDepth}.`,
        structuredContent: {
          contractVersion: "dvqr-mcp-business-capability-understanding-v3",
          sourceTable,
          searchBounds: { maxDepth, maxResults, maxTablesInspected },
          discoveryCoverage: { tablesInspected: inspected.size, graphEdgesInspected: edges.length, explorationComplete: queue.length === 0 },
          recommendationBasis: "StructuralMetadataFirstWithSupportingSemantics",
          investigationSummary: {
            primaryBusinessCapability: primaryCapability?.capability,
            primaryOperationalAnchor: operationalAnchors[0]?.logicalName,
            primaryWorkExecutionLayer: workItems[0]?.logicalName,
            overallConfidenceState: confidenceState(operationalAnchors[0]?.score),
            evidencePosture: "MetadataDerivedRuntimeUnverified",
            plainEnglishNarrative: operationalAnchors.length
              ? `${sourceTable} participates in a metadata-derived capability landscape organised around ${operationalAnchors[0].displayName ?? operationalAnchors[0].logicalName}. Downstream execution appears to occur through ${workItems[0]?.displayName ?? workItems[0]?.logicalName ?? "work-item-like tables"}. Runtime evidence is still required before claiming that any specific record follows this architecture.`
              : `DV Quick Run did not find enough bounded metadata evidence to describe a reliable operational architecture from ${sourceTable}.`
          },
          confidenceFramework: {
            HighConfidence: "Strong bounded structural evidence supports the conclusion; runtime may still be unverified.",
            MediumConfidence: "Meaningful structural evidence exists, but important corroboration is limited.",
            RuntimeVerificationRecommended: "Metadata suggests the conclusion, but bounded runtime probing is recommended before relying on it.",
            Unknown: "The available metadata and runtime evidence are insufficient to support a conclusion."
          },
          capabilityLandscape,
          architecturalConclusions: [
            conclusionCard("Primary Operational Anchor", operationalAnchors[0]),
            conclusionCard("Primary Work Execution Layer", workItems[0]),
            conclusionCard("Primary Governance Layer", anchors.find((anchor) => anchor.primaryCapability === "Governance")),
            conclusionCard("Primary Scheduling Layer", anchors.find((anchor) => anchor.primaryCapability === "Scheduling")),
            conclusionCard("Primary Integration Layer", anchors.find((anchor) => anchor.primaryCapability === "Integration"))
          ],
          businessCapabilityModel: capabilityModel,
          recommendedAnchor: operationalAnchors[0],
          operationalAnchors,
          supportingAnchors: anchors.filter((anchor) => anchor.role === "SupportingAnchor"),
          downstreamWorkItems: workItems,
          executiveSummary: {
            ifIJoinedTomorrow: {
              learnFirst,
              ignoreInitially: ["Generic platform infrastructure", "Low-signal administrative tables", "Unverified semantic matches"],
              onboardingValue: "Use this bounded architecture model to reduce initial manual schema exploration; no fixed time saving is claimed."
            }
          },
          suggestedNextActions: operationalAnchors.length
            ? [
                "Review capabilityLandscape and architecturalConclusions before choosing an investigation starting point.",
                "Run dvqr_find_relationship_paths from the source table to the recommended anchor.",
                "Then discover paths from the recommended anchor to task-like or activity-like work items.",
                "Provide sourceRecordId to dvqr_probe_relationship_path for bounded runtime evidence after the workflow path is metadata verified."
              ]
            : ["Increase maxDepth cautiously or inspect the supporting anchors."],
          limitations: [
            "Capability classification and anchor ranking are metadata-derived; they do not claim runtime data exists.",
            "A work-item table can be important evidence without being the business anchor that explains why the work exists.",
            "Runtime probing and domain interpretation remain separate from metadata anchor ranking."
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
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
      const { ranked, nodes, edges, coverage } = await this.discoverRankedPaths(context, sourceTable, targetTable, maxDepth, maxPaths);
      const relationshipHint = stringArg(args, "relationshipHint");
      const hintedPath = relationshipHint ? ranked.find((path) => pathMatchesRelationshipHint(path, relationshipHint)) : undefined;
      const presentationPaths = hintedPath
        ? [hintedPath, ...selectDiverseRelationshipPaths(ranked.filter((path) => path.pathId !== hintedPath.pathId), { maxFamilies: 4, maxCandidates: 4 })]
        : selectDiverseRelationshipPaths(ranked, { maxFamilies: 5, maxCandidates: 5 });
      const compactPaths = presentationPaths.slice(0, 5).map((path, index) => ({
        rank: index + 1,
        assessment: path.assessment,
        score: path.score,
        tables: path.tables,
        pathId: path.pathId,
        explainability: presentRelationshipExplainability(explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 })),
        whySelected: explainRelationshipPath(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint), rank: index + 1 }).whySelected,
        guidance: buildRelationshipPathGuidance(path, { relationshipHintHonoured: !!relationshipHint && pathMatchesRelationshipHint(path, relationshipHint) }),
        hops: path.hops.map((hop) => ({ fromTable: hop.fromTable, toTable: hop.toTable, navigationProperty: hop.navigationProperty, relationshipType: hop.relationshipType, direction: hop.direction, referencingAttribute: hop.referencingAttribute, polymorphicTargetQualified: hop.polymorphicTargetQualified, purpose: presentRelationshipPurpose(describeRelationshipPurpose(hop)) }))
      }));
      return { ok:true, summary: presentationPaths.length ? `Top metadata-ranked path: ${presentationPaths[0].tables.join(" → ")} · ${compactPaths[0]?.explainability.confidence ?? "metadata verified"}.` : `No verified relationship path was found within depth ${maxDepth}.`, structuredContent: {
        contractVersion:"dvqr-mcp-relationship-paths-v6", sourceTable, targetTable, relationshipHint, relationshipHintMatched: relationshipHint ? !!hintedPath : undefined, searchBounds:{ maxDepth, maxPaths, graphNodesInspected:nodes.size, graphEdgesInspected:edges.length },
        discoveryCoverage: coverage,
        recommendationBasis: relationshipHint && hintedPath ? "ExplicitRelationshipIntent" : "DeterministicMetadataRanking",
        recommendedPath:compactPaths[0], alternatives:compactPaths.slice(1),
        suggestedNextActions: ranked.length ? ["Run dvqr_generate_relationship_query with this source and target to create metadata-verified query templates.", "Provide sourceRecordId to dvqr_probe_relationship_path for bounded evidence-guided traversal across materially different path families.", "For a generic target such as task, allow deterministic target-concept expansion so custom task tables can be evaluated separately from the standard activity table."] : ["Increase maxDepth cautiously or verify the table logical names."],
        limitations:["Metadata-valid paths are not proof that matching records exist.", "Up to five diverse path families are returned inline to avoid near-identical relationships consuming the entire MCP response.", "Discovery continues beyond direct matches so bounded operational workflow bridges can be considered."]
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
      return { ok: true, summary: `Generated a ${generated.recommendedMode} query plan for ${selected.tables.join(" → ")} · metadata confidence ${explainability.confidenceDisplay}.`, structuredContent: { contractVersion: "dvqr-mcp-relationship-query-v6", relationshipHint, relationshipHintHonoured: relationshipHint ? relationshipHintHonoured : undefined, selectedPath: { assessment: selected.assessment, score: selected.score, tables: selected.tables, explainability: presentRelationshipExplainability(explainability), guidance: buildRelationshipPathGuidance(selected, { relationshipHintHonoured }) }, generated } };
    } catch (error) { const structuredError = mapStructuredExecutionError(error); return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError }; }
  }

  public async probeRelationshipPath(args: Record<string, unknown>): Promise<DvqrMcpFreeToolResult> {
    const sourceTable = stringArg(args, "sourceTable");
    const targetTable = stringArg(args, "targetTable");
    const sourceRecordId = stringArg(args, "sourceRecordId");
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
      const maxProbeRequests = Math.max(1, Math.min(20, Number(args.maxProbeRequests ?? 8)));
      const maxFamilies = Math.max(1, Math.min(8, Number(args.maxFamilies ?? 4)));
      const maxCandidatePaths = Math.max(1, Math.min(12, Number(args.maxCandidatePaths ?? 6)));
      const requestedTargetExpansion = args.expandTargetConcept;
      const expandTargetConcept = typeof requestedTargetExpansion === "boolean"
        ? requestedTargetExpansion
        : /^(task|tasks)$/i.test(targetTable);
      const selectedPathId = stringArg(args, "pathId");
      const relationshipHint = stringArg(args, "relationshipHint");
      const explicitSelection = Boolean(selectedPathId || relationshipHint);

      const targetCandidates = await this.resolveRuntimeTargetCandidates(
        context,
        targetTable,
        !explicitSelection && expandTargetConcept,
        Math.min(4, maxFamilies)
      );
      const discovered: McpRankedRelationshipPath[] = [];
      const targetDiscovery: Array<{ targetTable: string; pathCount: number }> = [];
      for (const candidateTarget of targetCandidates) {
        const result = await this.discoverRankedPaths(context, sourceTable, candidateTarget, maxDepth, 20);
        targetDiscovery.push({ targetTable: candidateTarget, pathCount: result.ranked.length });
        discovered.push(...result.ranked);
      }

      const deduped = [...new Map(discovered.map((path) => [path.pathId, path])).values()]
        .sort((left, right) => right.score - left.score || left.pathId.localeCompare(right.pathId));
      if (!deduped.length) {
        return { ok: false, code: "InvalidArguments", message: `No verified relationship path was found from ${sourceTable} to ${targetTable}.` };
      }

      const metadataRecommendation = deduped.find((path) =>
        path.tables[path.tables.length - 1]?.toLowerCase() === targetTable.toLowerCase()
      ) ?? deduped[0];
      let candidates: readonly McpRankedRelationshipPath[];
      if (explicitSelection) {
        const selected = selectRelationshipPath(deduped, selectedPathId, relationshipHint);
        if (!selected) {
          return {
            ok: false,
            code: relationshipHint ? "UnknownNavigationProperty" : "InvalidArguments",
            message: relationshipHint
              ? `No verified path matched the requested relationship ${relationshipHint}. No runtime probe was executed.`
              : "pathId did not match a verified relationship path."
          };
        }
        candidates = [selected];
      } else {
        candidates = selectDiverseRelationshipPaths(deduped, { maxFamilies, maxCandidates: maxCandidatePaths });
      }

      const budget = { remaining: maxProbeRequests };
      const probeResults: Array<Awaited<ReturnType<DvqrMcpFreeApplicationAdapter["probeRankedRelationshipPath"]>>> = [];
      for (const candidate of candidates) {
        if (budget.remaining <= 0) {
          break;
        }
        probeResults.push(await this.probeRankedRelationshipPath(context, candidate, sourceRecordId, maxRecordsPerStep, budget));
      }

      const observations = rankRuntimeObservations(probeResults.map((result) => result.observation));
      const runtimeWinner = observations.find((observation) => observation.reachedTarget);
      const runtimeRecommendationPath = runtimeWinner
        ? deduped.find((path) => path.pathId === runtimeWinner.pathId)
        : undefined;
      const probesUsed = maxProbeRequests - budget.remaining;
      const runtimeRecommendation = runtimeWinner && runtimeRecommendationPath
        ? {
            pathId: runtimeWinner.pathId,
            tables: runtimeWinner.tables,
            targetTable: runtimeWinner.targetTable,
            family: runtimeWinner.family,
            investigationScore: runtimeWinner.investigationScore,
            runtimeEvidenceScore: runtimeWinner.runtimeEvidenceScore,
            finalTargetRecordCount: runtimeWinner.finalTargetRecordCount,
            explainability: presentRelationshipExplainability(explainRelationshipPath(runtimeRecommendationPath, { rank: 1 })),
            guidance: buildRelationshipPathGuidance(runtimeRecommendationPath)
          }
        : undefined;

      const summary = runtimeRecommendation
        ? `Evidence-guided probing observed ${runtimeRecommendation.finalTargetRecordCount} target record${runtimeRecommendation.finalTargetRecordCount === 1 ? "" : "s"} through ${runtimeRecommendation.tables.join(" → ")}. Metadata ranking remains unchanged; this is the top observed workflow for the current investigation.`
        : `Evidence-guided probing found no target rows across ${probeResults.length} bounded candidate path${probeResults.length === 1 ? "" : "s"}. The metadata recommendation remains valid, but no runtime workflow was observed for this source record.`;

      return {
        ok: true,
        summary,
        structuredContent: {
          contractVersion: "dvqr-mcp-relationship-probe-v5",
          mode: explicitSelection ? "ExplicitPathProbe" : "EvidenceGuidedTraversal",
          sourceTable,
          requestedTargetTable: targetTable,
          resolvedTargetCandidates: targetCandidates,
          targetDiscovery,
          sourceRecordId,
          metadataRecommendation: {
            pathId: metadataRecommendation.pathId,
            tables: metadataRecommendation.tables,
            targetTable: metadataRecommendation.tables[metadataRecommendation.tables.length - 1],
            score: metadataRecommendation.score,
            scoreKind: metadataRecommendation.scoreKind,
            family: relationshipPathFamily(metadataRecommendation),
            explainability: presentRelationshipExplainability(explainRelationshipPath(metadataRecommendation, { rank: 1 })),
            guidance: buildRelationshipPathGuidance(metadataRecommendation)
          },
          runtimeRecommendation,
          runtimeEvidence: {
            status: runtimeRecommendation ? "ObservedWorkflowRecommended" : "NoObservedWorkflow",
            observations,
            candidatesConsidered: candidates.map((candidate) => ({
              pathId: candidate.pathId,
              tables: candidate.tables,
              targetTable: candidate.tables[candidate.tables.length - 1],
              family: relationshipPathFamily(candidate),
              metadataScore: candidate.score
            })),
            probesUsed,
            probesRemaining: budget.remaining,
            familiesExplored: [...new Set(observations.map((observation) => observation.family))].length,
            pathsProbed: probeResults.length
          },
          probeResults: probeResults.map((result) => ({
            observation: result.observation,
            reachedTarget: result.reachedTarget,
            finalTargetRecordIds: result.finalTargetRecordIds,
            probeRequestsUsed: result.probeRequestsUsed,
            steps: result.steps
          })),
          bounds: {
            maxDepth,
            maxRecordsPerStep,
            maxProbeRequests,
            maxFamilies,
            maxCandidatePaths,
            expandTargetConcept
          },
          suggestedNextActions: runtimeRecommendation
            ? [
                "Use the observed workflow recommendation for this investigation while preserving the separate metadata recommendation.",
                "Generate a metadata-verified query for the observed path by passing its exact pathId to dvqr_generate_relationship_query.",
                "Treat the runtime result as source-record-specific evidence, not persistent organisational truth."
              ]
            : [
                "Retain the top metadata path as structurally valid.",
                "Try a different representative source record or increase the bounded probe budget cautiously.",
                "Do not infer that an empty sampled path is invalid."
              ],
          limitations: [
            "Runtime evidence is investigation-scoped and is never persisted into metadata ranking.",
            "A successful probe proves only that matching records were observed for this source record at this time.",
            "No-match results do not invalidate metadata relationships.",
            "Concept expansion is deterministic and bounded; related target tables still require business interpretation."
          ]
        }
      };
    } catch (error) {
      const structuredError = mapStructuredExecutionError(error);
      return { ok: false, code: "ExecutionFailed", message: structuredError.summary, structuredError };
    }
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
