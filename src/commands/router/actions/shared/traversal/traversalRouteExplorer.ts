import { normalizeReasoningName } from "../metadataReasoning/metadataReasoningCommon.js";
import type {
  TraversalConfidence,
  TraversalEntityNode,
  TraversalGraph,
  TraversalRelationshipEdge,
  TraversalRequest,
  TraversalRoute,
  TraversalSubpath
} from "./traversalTypes.js";

type ExplorationState = {
  entities: string[];
  edges: TraversalRelationshipEdge[];
};

const BRIDGE_HINTS = [
  "intersect",
  "association",
  "associationentity",
  "link",
  "xref",
  "bridge",
  "join",
  "mapping",
  "map",
  "relationship",
  "rel",
  "junction",
  "activityparty",
  "annotation",
  "codeableconcept",
  "codeable_concept",
  "coding"
];

export function buildTraversalRoutes(
  graph: TraversalGraph,
  request: TraversalRequest,
  maxDepthPerSide = 2
): TraversalRoute[] {
  const sourceEntity = normalizeReasoningName(request.sourceEntity);
  const targetEntity = normalizeReasoningName(request.targetEntity);

  if (!graph.entities[sourceEntity] || !graph.entities[targetEntity]) {
    return [];
  }

  if (sourceEntity === targetEntity) {
    return [
      {
        routeId: `${sourceEntity}|${targetEntity}`,
        sourceEntity,
        targetEntity,
        entities: [sourceEntity],
        edges: [],
        hopCount: 0,
        meetingEntity: sourceEntity,
        confidence: "high"
      }
    ];
  }

  const forwardSubpaths = exploreTraversalSubpaths(graph, sourceEntity, maxDepthPerSide);
  const reverseGraph = buildReverseTraversalGraph(graph);
  const reverseSubpaths = exploreTraversalSubpaths(reverseGraph, targetEntity, maxDepthPerSide);
  const normalizedReverseSubpaths = reverseSubpaths.map(reverseTraversalSubpath);

  const reverseByOrigin = new Map<string, TraversalSubpath[]>();

  for (const subpath of normalizedReverseSubpaths) {
    const key = normalizeReasoningName(subpath.originEntity);
    const existing = reverseByOrigin.get(key) ?? [];
    existing.push(subpath);
    reverseByOrigin.set(key, existing);
  }

  const routes: TraversalRoute[] = [];
  const seen = new Set<string>();

  for (const left of forwardSubpaths) {
    const directRoute = buildDirectTraversalRoute(sourceEntity, targetEntity, left);

    if (directRoute && !seen.has(directRoute.routeId)) {
      seen.add(directRoute.routeId);
      routes.push(directRoute);
    }

    const anchor = normalizeReasoningName(left.targetEntity);
    const rightCandidates = reverseByOrigin.get(anchor) ?? [];

    for (const right of rightCandidates) {
      const stitched = stitchTraversalRoute(sourceEntity, targetEntity, left, right);
      if (!stitched) {
        continue;
      }

      if (seen.has(stitched.routeId)) {
        continue;
      }

      seen.add(stitched.routeId);
      routes.push(stitched);
    }
  }

  return routes.sort(compareTraversalRoutes);
}

export function exploreTraversalSubpaths(
  graph: TraversalGraph,
  originEntity: string,
  maxDepth = 2
): TraversalSubpath[] {
  const origin = normalizeReasoningName(originEntity);
  const originNode = graph.entities[origin];

  if (!originNode || maxDepth <= 0) {
    return [];
  }

  const states: ExplorationState[] = [
    {
      entities: [origin],
      edges: []
    }
  ];

  const results: TraversalSubpath[] = [];
  const seen = new Set<string>();

  while (states.length > 0) {
    const state = states.shift()!;
    const currentEntity = state.entities[state.entities.length - 1]!;
    const currentNode = graph.entities[currentEntity];

    if (!currentNode) {
      continue;
    }

    if (state.edges.length >= maxDepth) {
      continue;
    }

    for (const edge of currentNode.outboundRelationships) {
      const nextEntity = normalizeReasoningName(edge.toEntity);

      if (!nextEntity || state.entities.includes(nextEntity)) {
        continue;
      }

      const nextState: ExplorationState = {
        entities: [...state.entities, nextEntity],
        edges: [...state.edges, edge]
      };

      const subpath = buildTraversalSubpath(origin, nextState.entities, nextState.edges);
      if (!seen.has(subpath.subpathId)) {
        seen.add(subpath.subpathId);
        results.push(subpath);
      }

      states.push(nextState);
    }
  }

  return results.sort(compareTraversalSubpaths);
}

export function buildReverseTraversalGraph(graph: TraversalGraph): TraversalGraph {
  const entities: Record<string, TraversalEntityNode> = Object.fromEntries(
    Object.entries(graph.entities).map(([logicalName, node]) => [
      logicalName,
      {
        ...node,
        outboundRelationships: []
      }
    ])
  ) as Record<string, TraversalEntityNode>;

  for (const node of Object.values(graph.entities)) {
    for (const edge of node.outboundRelationships) {
      const fromEntity = normalizeReasoningName(edge.fromEntity);
      const toEntity = normalizeReasoningName(edge.toEntity);

      if (!entities[toEntity]) {
        continue;
      }

      entities[toEntity].outboundRelationships.push({
        ...edge,
        fromEntity: toEntity,
        toEntity: fromEntity
      });
    }
  }

  return { entities };
}

export function reverseTraversalSubpath(subpath: TraversalSubpath): TraversalSubpath {
  const reversedEntities = [...subpath.entities].reverse();
  const reversedEdges = [...subpath.edges].reverse().map((edge, index) => ({
    ...edge,
    fromEntity: reversedEntities[index]!,
    toEntity: reversedEntities[index + 1]!
  }));

  return {
    subpathId: buildTraversalSubpathId(reversedEntities, reversedEdges),
    originEntity: reversedEntities[0]!,
    targetEntity: reversedEntities[reversedEntities.length - 1]!,
    entities: reversedEntities,
    edges: reversedEdges,
    hopCount: reversedEdges.length
  };
}

function buildDirectTraversalRoute(
  sourceEntity: string,
  targetEntity: string,
  subpath: TraversalSubpath
): TraversalRoute | undefined {
  if (normalizeReasoningName(subpath.originEntity) !== sourceEntity) {
    return undefined;
  }

  if (normalizeReasoningName(subpath.targetEntity) !== targetEntity) {
    return undefined;
  }

  return {
    routeId: buildTraversalRouteId(subpath.entities, subpath.edges),
    sourceEntity,
    targetEntity,
    entities: subpath.entities,
    edges: subpath.edges,
    hopCount: subpath.hopCount,
    meetingEntity: subpath.targetEntity,
    confidence: getRouteConfidence(subpath.hopCount, subpath.targetEntity)
  };
}

function stitchTraversalRoute(
  sourceEntity: string,
  targetEntity: string,
  left: TraversalSubpath,
  right: TraversalSubpath
): TraversalRoute | undefined {
  const leftTarget = normalizeReasoningName(left.targetEntity);
  const rightOrigin = normalizeReasoningName(right.originEntity);

  if (leftTarget !== rightOrigin) {
    return undefined;
  }

  const entities = [...left.entities, ...right.entities.slice(1)];
  const edges = [...left.edges, ...right.edges];
  const hopCount = edges.length;

  if (!entities.length || normalizeReasoningName(entities[0]!) !== sourceEntity) {
    return undefined;
  }

  if (normalizeReasoningName(entities[entities.length - 1]!) !== targetEntity) {
    return undefined;
  }

  return {
    routeId: buildTraversalRouteId(entities, edges),
    sourceEntity,
    targetEntity,
    entities,
    edges,
    hopCount,
    meetingEntity: left.targetEntity,
    confidence: getRouteConfidence(hopCount, left.targetEntity)
  };
}

function getRouteConfidence(hopCount: number, meetingEntity?: string): TraversalConfidence {
  const normalizedMeeting = normalizeReasoningName(meetingEntity);

  if (hopCount <= 2) {
    return "high";
  }

  if (normalizedMeeting && !looksLikeBridgeEntity(normalizedMeeting)) {
    return "high";
  }

  return "medium";
}

function looksLikeBridgeEntity(logicalName: string): boolean {
  const normalized = normalizeReasoningName(logicalName);

  if (!normalized) {
    return true;
  }

  return BRIDGE_HINTS.some((hint) => normalized.includes(hint));
}

function buildTraversalSubpath(
  originEntity: string,
  entities: string[],
  edges: TraversalRelationshipEdge[]
): TraversalSubpath {
  return {
    subpathId: buildTraversalSubpathId(entities, edges),
    originEntity,
    targetEntity: entities[entities.length - 1]!,
    entities,
    edges,
    hopCount: edges.length
  };
}

function buildTraversalSubpathId(
  entities: string[],
  edges: TraversalRelationshipEdge[]
): string {
  const edgeToken = edges.map((edge) => edge.navigationPropertyName).join("|");
  return `${entities.join("->")}::${edgeToken}`;
}

function buildTraversalRouteId(
  entities: string[],
  edges: TraversalRelationshipEdge[]
): string {
  const edgeToken = edges.map((edge) => edge.navigationPropertyName).join("|");
  return `${entities.join("->")}::${edgeToken}`;
}

function compareTraversalSubpaths(left: TraversalSubpath, right: TraversalSubpath): number {
  if (left.hopCount !== right.hopCount) {
    return left.hopCount - right.hopCount;
  }

  return left.subpathId.localeCompare(right.subpathId, undefined, {
    sensitivity: "base"
  });
}

function compareTraversalRoutes(left: TraversalRoute, right: TraversalRoute): number {
  if (left.hopCount !== right.hopCount) {
    return left.hopCount - right.hopCount;
  }

  const leftPenalty = looksLikeBridgeEntity(left.meetingEntity ?? "") ? 1 : 0;
  const rightPenalty = looksLikeBridgeEntity(right.meetingEntity ?? "") ? 1 : 0;

  if (leftPenalty !== rightPenalty) {
    return leftPenalty - rightPenalty;
  }

  return left.routeId.localeCompare(right.routeId, undefined, {
    sensitivity: "base"
  });
}