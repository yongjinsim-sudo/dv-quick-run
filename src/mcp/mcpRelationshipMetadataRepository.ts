import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { findRelationshipPaths, rankRelationshipPaths, type McpRankedRelationshipPath, type McpRelationshipEdge, type McpRelationshipGraph } from "./mcpRelationshipIntelligence.js";
import { rankDvqrMetadataEntities, type DvqrMetadataEntityCandidate } from "./mcpMetadataSearch.js";
import { selectDiverseRelationshipPaths } from "./mcpRelationshipRuntimeEvidence.js";
import { type McpEntityShape } from "./mcpRelationshipQueryGenerator.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { environmentUrl } from "./mcpRequestArguments.js";
import type { DvqrMcpFreeToolFailure } from "./mcpToolResults.js";

export interface McpMetadataContext {
  readonly baseEnvironmentUrl: string;
  readonly token: string;
}

export interface McpRelationshipPathDiscovery {
  readonly ranked: readonly McpRankedRelationshipPath[];
  readonly nodes: Set<string>;
  readonly edges: McpRelationshipEdge[];
  readonly coverage: {
    readonly tablesInspected: number;
    readonly directPathsFound: number;
    readonly bridgedPathsFound: number;
    readonly operationalHubsInspected: readonly string[];
    readonly explorationComplete: boolean;
  };
}

export class McpRelationshipMetadataRepository {
  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {}

  public async metadataContext(args: Record<string, unknown>): Promise<McpMetadataContext | DvqrMcpFreeToolFailure> {
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

  public async fetchRelationships(baseEnvironmentUrl: string, token: string, logicalName: string): Promise<McpRelationshipEdge[]> {
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


  public async fetchEntityShape(baseEnvironmentUrl: string, token: string, logicalName: string): Promise<McpEntityShape> {
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

  public async fetchEntityCatalogue(baseEnvironmentUrl: string, token: string): Promise<DvqrMetadataEntityCandidate[]> {
    const result = await mcpDataverseGet<any>({
      baseUrl: `${baseEnvironmentUrl}/api/data/v9.2`,
      path: "/EntityDefinitions?$select=LogicalName,SchemaName,EntitySetName,DisplayName,Description,PrimaryIdAttribute,PrimaryNameAttribute,IsCustomEntity,IsManaged,OwnershipType",
      token,
      timeoutMs: this.config.requestTimeoutMs
    });
    const rows = (result.data as any)?.value;
    return Array.isArray(rows) ? rows : [];
  }

  public async resolveRuntimeTargetCandidates(
    context: McpMetadataContext,
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

  public async discoverRankedPaths(context: McpMetadataContext, sourceTable: string, targetTable: string, maxDepth: number, maxPaths: number): Promise<McpRelationshipPathDiscovery> {
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



}
