export type RelationshipKind = "ManyToOne" | "OneToMany" | "ManyToMany";
export type RelationshipDirection = "manyToOne" | "oneToMany" | "manyToMany";

export interface McpRelationshipEdge {
  readonly fromTable: string;
  readonly toTable: string;
  readonly navigationProperty: string;
  readonly relationshipSchemaName?: string;
  readonly referencingAttribute?: string;
  readonly relationshipType: RelationshipKind;
  readonly direction: RelationshipDirection;
  readonly collectionValued: boolean;
  readonly polymorphicTargetQualified?: boolean;
}

export interface McpRelationshipGraph {
  readonly nodes: readonly string[];
  readonly edges: readonly McpRelationshipEdge[];
}

export interface McpTraversalScoreReason {
  readonly code: string;
  readonly points: number;
  readonly message: string;
}

export interface McpRankedRelationshipPath {
  readonly pathId: string;
  readonly tables: readonly string[];
  readonly bridgeTables: readonly string[];
  readonly hops: readonly McpRelationshipEdge[];
  readonly assessment: "Recommended" | "Viable" | "Possible" | "NotRecommended";
  readonly score: number;
  readonly scoreKind: "DeterministicTraversalScore";
  readonly reasons: readonly McpTraversalScoreReason[];
  readonly penalties: readonly McpTraversalScoreReason[];
  readonly limitations: readonly string[];
}

const normalize = (value: string) => value.trim().toLowerCase();

function pathId(edges: readonly McpRelationshipEdge[]): string {
  return edges.map((edge) => `${normalize(edge.fromTable)}:${edge.navigationProperty}:${normalize(edge.toTable)}`).join("|");
}

function classify(score: number): McpRankedRelationshipPath["assessment"] {
  if (score >= 80) {
    return "Recommended";
  }
  if (score >= 60) {
    return "Viable";
  }
  if (score >= 35) {
    return "Possible";
  }
  return "NotRecommended";
}

function isAdministrative(table: string): boolean {
  return /^(systemuser|team|businessunit|organization|role|principal|owner)$/.test(normalize(table));
}

function isGenericActivity(table: string): boolean {
  return /^(activitypointer|activityparty|activitymimeattachment)$/.test(normalize(table));
}

export function findRelationshipPaths(
  graph: McpRelationshipGraph,
  sourceTable: string,
  targetTable: string,
  options: { readonly maxDepth?: number; readonly maxPaths?: number } = {}
): readonly McpRelationshipEdge[][] {
  const source = normalize(sourceTable);
  const target = normalize(targetTable);
  const maxDepth = Math.max(1, Math.min(6, options.maxDepth ?? 4));
  const maxPaths = Math.max(1, Math.min(100, options.maxPaths ?? 20));
  const adjacency = new Map<string, McpRelationshipEdge[]>();
  for (const edge of graph.edges) {
    const key = normalize(edge.fromTable);
    const list = adjacency.get(key) ?? [];
    list.push(edge);
    adjacency.set(key, list);
  }

  const results: McpRelationshipEdge[][] = [];
  const queue: Array<{ table: string; edges: McpRelationshipEdge[]; visited: Set<string> }> = [
    { table: source, edges: [], visited: new Set([source]) }
  ];

  while (queue.length && results.length < maxPaths) {
    const current = queue.shift()!;
    if (current.edges.length >= maxDepth) {
      continue;
    }
    for (const edge of adjacency.get(current.table) ?? []) {
      const next = normalize(edge.toTable);
      if (!next || current.visited.has(next)) {
        continue;
      }
      const edges = [...current.edges, edge];
      if (next === target) {
        results.push(edges);
        if (results.length >= maxPaths) {
          break;
        }
        continue;
      }
      queue.push({ table: next, edges, visited: new Set([...current.visited, next]) });
    }
  }

  const seen = new Set<string>();
  return results.filter((path) => {
    const id = pathId(path);
    if (seen.has(id)) {
      return false;
    }
    seen.add(id);
    return true;
  });
}

export function rankRelationshipPath(edges: readonly McpRelationshipEdge[]): McpRankedRelationshipPath {
  const tables = edges.length ? [edges[0].fromTable, ...edges.map((edge) => edge.toTable)] : [];
  const reasons: McpTraversalScoreReason[] = [];
  const penalties: McpTraversalScoreReason[] = [];
  let score = 100;

  reasons.push({ code: "metadata_verified", points: 20, message: "Every hop is backed by Dataverse relationship metadata." });
  if (edges.every((edge) => !!edge.navigationProperty)) {
    reasons.push({ code: "navigation_resolved", points: 10, message: "Every hop has an exact navigation property." });
  }
  const hopPenalty = Math.max(0, edges.length - 1) * 10;
  if (hopPenalty) {
    score -= hopPenalty;
    penalties.push({ code: "additional_hops", points: -hopPenalty, message: `${edges.length - 1} additional hop${edges.length === 2 ? "" : "s"} beyond a direct relationship.` });
  }
  const bridgeTables = tables.slice(1, -1);
  if (bridgeTables.length === 1) {
    reasons.push({ code: "single_bridge", points: 6, message: `A single bridge table (${bridgeTables[0]}) connects the endpoints.` });
  }
  for (const table of bridgeTables) {
    if (isAdministrative(table)) {
      score -= 28;
      penalties.push({ code: "administrative_detour", points: -28, message: `${table} is an administrative detour.` });
    }
    if (isGenericActivity(table)) {
      score -= 20;
      penalties.push({ code: "generic_activity_detour", points: -20, message: `${table} is a generic activity infrastructure table.` });
    }
  }
  const ambiguous = edges.filter((edge) => edge.polymorphicTargetQualified === false).length;
  if (ambiguous) {
    const amount = ambiguous * 18;
    score -= amount;
    penalties.push({ code: "polymorphic_ambiguity", points: -amount, message: `${ambiguous} polymorphic hop${ambiguous === 1 ? " is" : "s are"} not target-qualified.` });
  }
  score = Math.max(0, Math.min(100, score));

  return {
    pathId: pathId(edges),
    tables,
    bridgeTables,
    hops: edges,
    assessment: classify(score),
    score,
    scoreKind: "DeterministicTraversalScore",
    reasons,
    penalties,
    limitations: [
      "This ranking describes metadata quality and path shape; it does not prove that matching business data exists.",
      "Runtime path probing is required before treating the path as data-bearing evidence."
    ]
  };
}

export function rankRelationshipPaths(paths: readonly (readonly McpRelationshipEdge[])[]): readonly McpRankedRelationshipPath[] {
  return paths.map(rankRelationshipPath).sort((left, right) => right.score - left.score || left.pathId.localeCompare(right.pathId));
}
