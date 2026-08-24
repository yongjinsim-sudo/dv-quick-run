import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import { findRelationshipPaths, rankRelationshipPath, rankRelationshipPaths, type McpRankedRelationshipPath, type McpRelationshipEdge, type McpRelationshipGraph } from "./mcpRelationshipIntelligence.js";
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
  private readonly entityCatalogueCache = new Map<string, DvqrMetadataEntityCandidate[]>();
  private readonly depthDiverseDiscoveryCache = new Map<string, McpRelationshipPathDiscovery>();
  private readonly discoveryRelationshipCache = new Map<string, { readonly expiresAt: number; readonly edges: readonly McpRelationshipEdge[] }>();

  private async fetchRelationshipsForDiscovery(baseEnvironmentUrl: string, token: string, logicalName: string): Promise<McpRelationshipEdge[]> {
    const key = `${baseEnvironmentUrl.toLowerCase()}|${logicalName.toLowerCase()}`;
    const now = Date.now();
    const cached = this.discoveryRelationshipCache.get(key);
    if (cached && cached.expiresAt > now) {
      return [...cached.edges];
    }
    const edges = await this.fetchRelationships(baseEnvironmentUrl, token, logicalName);
    this.discoveryRelationshipCache.set(key, { expiresAt: now + 60_000, edges: [...edges] });
    return edges;
  }

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
    const catalogue = Array.isArray(rows) ? rows : [];
    this.entityCatalogueCache.set(baseEnvironmentUrl.toLowerCase(), catalogue);
    return catalogue;
  }

  public getCachedEntityCatalogue(baseEnvironmentUrl: string): readonly DvqrMetadataEntityCandidate[] | undefined {
    return this.entityCatalogueCache.get(baseEnvironmentUrl.toLowerCase());
  }

  public getCachedDepthDiverseBusinessPaths(
    baseEnvironmentUrl: string,
    sourceTable: string,
    targetTable: string,
    maxDepth: number
  ): McpRelationshipPathDiscovery | undefined {
    return this.depthDiverseDiscoveryCache.get(
      `${baseEnvironmentUrl.toLowerCase()}|${sourceTable.toLowerCase()}|${targetTable.toLowerCase()}|${maxDepth}`
    );
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


  /**
   * Pass 10.1.1 business-path discovery.
   *
   * Unlike the generic relationship search, this exploration deliberately keeps
   * expanding high-value workflow hubs even when a source table (for example
   * contact) exposes hundreds of direct relationships. The existence of a
   * direct source->target relationship must not starve plausible multi-hop
   * business routes such as Contact -> Care Plan -> Care Plan Activity.
   */
  public async discoverDepthDiverseBusinessPaths(
    context: McpMetadataContext,
    sourceTable: string,
    targetTable: string,
    maxDepth: number,
    maxPaths: number,
    assertedPathTables?: readonly string[]
  ): Promise<McpRelationshipPathDiscovery> {
    // Performance envelope only. The ranking/path-selection algorithm below is intentionally
    // unchanged: these bounds govern metadata acquisition, not business semantics.
    const maxTablesInspected = 24;
    const maxQueuedTables = 56;
    const maxNeighboursPerExpansion = 28;
    const expansionBatchSize = 4;
    const discoveryTimeBudgetMs = 25_000;
    const discoveryStartedAt = Date.now();
    const nodes = new Set<string>([sourceTable.toLowerCase(), targetTable.toLowerCase()]);
    const edges: McpRelationshipEdge[] = [];
    const inspected = new Set<string>();
    const queued = new Set<string>([sourceTable.toLowerCase()]);
    const operationalHubsInspected = new Set<string>();
    const normalizedAssertedPath = (assertedPathTables ?? []).map((value) => value.trim()).filter(Boolean);
    const assertedIntermediateTables = normalizedAssertedPath.slice(1, -1);
    const queue: Array<{ table: string; depth: number; priority: number }> = [
      // Always inspect the requested source first. This preserves the established forward
      // discovery semantics and avoids target-side hints becoming authority.
      { table: sourceTable, depth: 0, priority: 3000 },
      // Pass 10.7.5: asserted business traversals are investigation-scoped hypotheses that
      // must be metadata-inspected even when generic breadth limits would otherwise starve
      // their intermediate tables. This is generic: no organisation/table names are encoded.
      ...assertedIntermediateTables.map((table, index) => ({ table, depth: index + 1, priority: 2800 - index }))
    ];
    for (const table of assertedIntermediateTables) queued.add(table.toLowerCase());

    const workflowPriority = (table: string): number => {
      const value = table.toLowerCase();
      if (value === targetTable.toLowerCase()) return 1000;
      if (/(careplan|care_plan|careplanactivity|care_plan_activity|healthcheck|health_check)/.test(value)) return 180;
      if (/(case|incident|episode|encounter|referral|order|workorder|booking|appointment|plan|activity|journey|application|claim|request|assessment)/.test(value)) return 120;
      if (/(task|workitem|action)/.test(value)) return 95;
      if (/(template|definition|goal)/.test(value)) return 80;
      if (/^(systemuser|team|businessunit|organization|role|principal|owner|activityparty|activitypointer)$/.test(value)) return -140;
      return 0;
    };

    // Target-aware acquisition hint: inspect the target metadata once, but do NOT add its
    // outgoing edges to the discovery graph. Its neighbours are only scheduling hints that
    // help us inspect likely predecessor tables earlier. Canonical forward edges still have
    // to be observed from those tables before a source -> target path can exist.
    try {
      const targetHintResult = await Promise.race([
        this.fetchRelationshipsForDiscovery(context.baseEnvironmentUrl, context.token, targetTable)
          .then((value) => ({ kind: "metadata" as const, value }))
          .catch(() => ({ kind: "unavailable" as const })),
        new Promise<{ readonly kind: "timeout" }>((resolve) => setTimeout(() => resolve({ kind: "timeout" }), 1_500))
      ]);
      const targetEdges = targetHintResult.kind === "metadata" ? targetHintResult.value : [];
      const hintedPredecessors = [...new Set(targetEdges.map((edge) => edge.toTable))]
        .filter((table) => {
          const key = table.toLowerCase();
          return key !== targetTable.toLowerCase() && !queued.has(key);
        })
        .sort((left, right) => workflowPriority(right) - workflowPriority(left) || left.localeCompare(right))
        .slice(0, 12);
      for (const table of hintedPredecessors) {
        if (queued.size >= maxQueuedTables) break;
        queued.add(table.toLowerCase());
        // The hint gets one inspection opportunity but no target-side recursive authority.
        queue.push({ table, depth: Math.max(1, maxDepth - 1), priority: 1800 + workflowPriority(table) });
      }
    } catch {
      // Target-side hinting is an optimisation only. A failure must not alter established
      // source-driven discovery behaviour or turn partial metadata into a false negative.
    }

    let timeBudgetReached = false;
    while (queue.length && inspected.size < maxTablesInspected) {
      if (Date.now() - discoveryStartedAt >= discoveryTimeBudgetMs) {
        timeBudgetReached = true;
        break;
      }

      queue.sort((left, right) =>
        right.priority - left.priority
        || left.depth - right.depth
        || left.table.localeCompare(right.table)
      );

      const batch: Array<{ table: string; depth: number; priority: number }> = [];
      while (queue.length && batch.length < expansionBatchSize && inspected.size + batch.length < maxTablesInspected) {
        const candidate = queue.shift()!;
        const key = candidate.table.toLowerCase();
        if (inspected.has(key) || batch.some((entry) => entry.table.toLowerCase() === key)) continue;
        batch.push(candidate);
      }
      if (!batch.length) continue;

      const fetched = await Promise.all(batch.map(async (current) => ({
        current,
        tableEdges: await this.fetchRelationshipsForDiscovery(context.baseEnvironmentUrl, context.token, current.table)
      })));

      for (const { current, tableEdges } of fetched) {
        const currentKey = current.table.toLowerCase();
        if (inspected.has(currentKey)) continue;
        inspected.add(currentKey);

        if (
          workflowPriority(current.table) >= 80
          && currentKey !== sourceTable.toLowerCase()
          && currentKey !== targetTable.toLowerCase()
        ) {
          operationalHubsInspected.add(current.table);
        }

        edges.push(...tableEdges);
        for (const edge of tableEdges) {
          nodes.add(edge.toTable.toLowerCase());
        }

        if (current.depth + 1 >= maxDepth || queued.size >= maxQueuedTables) {
          continue;
        }

        const expansionCandidates = [...new Set(tableEdges.map((edge) => edge.toTable))]
          .filter((candidate) => {
            const key = candidate.toLowerCase();
            return key !== currentKey && !inspected.has(key) && !queued.has(key);
          })
          .sort((left, right) =>
            workflowPriority(right) - workflowPriority(left)
            || left.localeCompare(right)
          )
          .slice(0, maxNeighboursPerExpansion);

        for (const candidate of expansionCandidates) {
          if (queued.size >= maxQueuedTables) break;
          const candidateKey = candidate.toLowerCase();
          queued.add(candidateKey);
          queue.push({
            table: candidate,
            depth: current.depth + 1,
            priority: workflowPriority(candidate) - current.depth * 4
          });
        }
      }
    }

    const graph: McpRelationshipGraph = { nodes: [...nodes], edges };
    const discovered = findRelationshipPaths(graph, sourceTable, targetTable, {
      maxDepth,
      maxPaths: Math.max(60, Math.min(100, maxPaths * 10))
    });

    // Pass 10.7.5.2: an asserted traversal must not depend on the generic path finder
    // rediscovering the exact chain from a highly connected graph. Build contiguous
    // asserted candidates directly from metadata-valid edges between every adjacent
    // asserted table pair. Relationship variants remain bounded and independent so
    // runtime evidence can decide which role/navigation actually carries data.
    const explicitAssertedRanked: McpRankedRelationshipPath[] = [];
    if (normalizedAssertedPath.length >= 2 && normalizedAssertedPath.length - 1 <= maxDepth) {
      const variantsPerHop: McpRelationshipEdge[][] = [];
      let assertedMetadataResolved = true;
      for (let index = 0; index < normalizedAssertedPath.length - 1; index += 1) {
        const from = normalizedAssertedPath[index].toLowerCase();
        const to = normalizedAssertedPath[index + 1].toLowerCase();
        const variants = edges
          .filter((edge) => edge.fromTable.toLowerCase() === from && edge.toTable.toLowerCase() === to)
          .sort((left, right) => left.navigationProperty.localeCompare(right.navigationProperty));
        if (!variants.length) {
          assertedMetadataResolved = false;
          break;
        }
        variantsPerHop.push(variants);
      }

      if (assertedMetadataResolved) {
        let combinations: McpRelationshipEdge[][] = [[]];
        for (const variants of variantsPerHop) {
          const next: McpRelationshipEdge[][] = [];
          for (const prefix of combinations) {
            for (const variant of variants) {
              next.push([...prefix, variant]);
              if (next.length >= 8) break;
            }
            if (next.length >= 8) break;
          }
          combinations = next;
          if (!combinations.length) break;
        }
        explicitAssertedRanked.push(...combinations.map((combination) => rankRelationshipPath(combination)));
      }
    }

    const allRankedById = new Map<string, McpRankedRelationshipPath>();
    for (const path of [...explicitAssertedRanked, ...rankRelationshipPaths(discovered)]) {
      if (!allRankedById.has(path.pathId)) allRankedById.set(path.pathId, path);
    }
    const allRanked = [...allRankedById.values()].sort((left, right) => right.score - left.score || left.pathId.localeCompare(right.pathId));

    // Preserve candidates across hop depths before any business scoring. This is
    // intentionally different from shortest-path-first selection: one-hop
    // routes are baselines, not a reason to suppress two-/three-hop workflows.
    const byDepth = new Map<number, McpRankedRelationshipPath[]>();
    for (const path of allRanked) {
      const depth = path.hops.length;
      const bucket = byDepth.get(depth) ?? [];
      bucket.push(path);
      byDepth.set(depth, bucket);
    }

    const selected: McpRankedRelationshipPath[] = [];
    const seen = new Set<string>();

    // Preserve an explicit investigator-asserted business chain in the discovery cohort when
    // the metadata graph resolves that exact table sequence. This makes the chain testable; it
    // does not make it true or preferred until runtime validation reaches the target.
    const normalizedAssertedPathLower = normalizedAssertedPath.map((value) => value.toLowerCase());
    if (normalizedAssertedPathLower.length >= 2) {
      // Preserve relationship variants that share the exact asserted table sequence. A table
      // chain can be correct even when one metadata-valid relationship role (for example an
      // author role) is empty while another role (for example a patient role) carries rows.
      // Keep the bounded variants so runtime evidence, not metadata tie-breaking, decides.
      for (const asserted of allRanked.filter((path) => path.tables.length === normalizedAssertedPathLower.length
        && path.tables.every((table, index) => table.toLowerCase() === normalizedAssertedPathLower[index])).slice(0, 8)) {
        selected.push(asserted);
        seen.add(asserted.pathId);
      }
    }
    const perDepthBudget = Math.max(2, Math.ceil(maxPaths / Math.max(1, Math.min(maxDepth, byDepth.size || 1))));
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      for (const path of (byDepth.get(depth) ?? []).slice(0, perDepthBudget)) {
        if (seen.has(path.pathId)) continue;
        selected.push(path);
        seen.add(path.pathId);
      }
    }

    // Fill remaining discovery budget by metadata quality without removing the
    // depth-diverse seed set.
    for (const path of allRanked) {
      if (selected.length >= Math.max(maxPaths * 3, 24)) break;
      if (seen.has(path.pathId)) continue;
      selected.push(path);
      seen.add(path.pathId);
    }

    const result: McpRelationshipPathDiscovery = {
      ranked: selected,
      nodes,
      edges,
      coverage: {
        tablesInspected: inspected.size,
        directPathsFound: discovered.filter((path) => path.length === 1).length,
        bridgedPathsFound: discovered.filter((path) => path.length > 1).length,
        operationalHubsInspected: [...operationalHubsInspected].sort(),
        explorationComplete: queue.length === 0 && !timeBudgetReached
      }
    };
    this.depthDiverseDiscoveryCache.set(
      `${context.baseEnvironmentUrl.toLowerCase()}|${sourceTable.toLowerCase()}|${targetTable.toLowerCase()}|${maxDepth}`,
      result
    );
    return result;
  }


}
