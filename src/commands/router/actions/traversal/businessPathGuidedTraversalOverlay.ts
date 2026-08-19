import type {
  BusinessPathArtifact,
  BusinessPathMetadataProvider,
  BusinessPathMetadataRelationship,
  BusinessPathRevalidationResult,
  BusinessPathRepository
} from "../../../../core/businessPaths/index.js";
import { BusinessPathRevalidationService } from "../../../../core/businessPaths/index.js";
import type {
  TraversalGraph,
  TraversalRelationshipEdge,
  TraversalRoute
} from "../shared/traversal/traversalTypes.js";

export type GuidedTraversalPreferredPathState = "valid" | "stale" | "unknown";

export interface GuidedTraversalPreferredPath {
  readonly artifact: BusinessPathArtifact;
  readonly validation: BusinessPathRevalidationResult;
  readonly state: GuidedTraversalPreferredPathState;
  readonly route?: TraversalRoute;
  readonly duplicateDiscoveredRouteId?: string;
}

export interface GuidedTraversalBusinessPathOverlay {
  readonly preferredPaths: readonly GuidedTraversalPreferredPath[];
  readonly discoveredRoutes: readonly TraversalRoute[];
}

const normalize = (value: string | undefined): string => (value ?? "").trim().toLowerCase();

export function isExactBusinessPathRoute(
  artifact: BusinessPathArtifact,
  route: TraversalRoute
): boolean {
  if (
    normalize(artifact.sourceTable) !== normalize(route.sourceEntity)
    || normalize(artifact.targetTable) !== normalize(route.targetEntity)
    || artifact.hops.length !== route.edges.length
  ) {
    return false;
  }

  const orderedHops = [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal);
  return orderedHops.every((hop, index) => {
    const edge = route.edges[index];
    if (!edge) {
      return false;
    }

    return normalize(edge.fromEntity) === normalize(hop.fromTable)
      && normalize(edge.toEntity) === normalize(hop.toTable)
      && normalize(edge.schemaName) === normalize(hop.relationshipSchemaName)
      && edge.relationshipType === hop.relationshipType
      && (!hop.navigationProperty || normalize(edge.navigationPropertyName) === normalize(hop.navigationProperty))
      && (!hop.lookupAttribute || normalize(edge.referencingAttribute) === normalize(hop.lookupAttribute));
  });
}

function mapRelationshipType(value: TraversalRelationshipEdge["relationshipType"]): BusinessPathMetadataRelationship["relationshipType"] {
  return value;
}

class TraversalGraphBusinessPathMetadataProvider implements BusinessPathMetadataProvider {
  public constructor(private readonly graph: TraversalGraph) {}

  public async tableExists(logicalName: string): Promise<boolean> {
    return Boolean(this.graph.entities[normalize(logicalName)]);
  }

  public async relationshipsFrom(logicalName: string): Promise<readonly BusinessPathMetadataRelationship[]> {
    const node = this.graph.entities[normalize(logicalName)];
    if (!node) {
      return [];
    }

    return node.outboundRelationships
      .filter((edge) => Boolean(edge.schemaName?.trim()))
      .map((edge) => ({
        fromTable: edge.fromEntity,
        toTable: edge.toEntity,
        relationshipSchemaName: edge.schemaName!,
        relationshipType: mapRelationshipType(edge.relationshipType),
        navigationProperty: edge.navigationPropertyName,
        ...(edge.referencingAttribute ? { lookupAttribute: edge.referencingAttribute } : {})
      }));
  }
}

function buildRouteFromArtifact(
  artifact: BusinessPathArtifact,
  graph: TraversalGraph
): TraversalRoute | undefined {
  const edges: TraversalRelationshipEdge[] = [];
  const entities: string[] = [artifact.sourceTable];
  const orderedHops = [...artifact.hops].sort((left, right) => left.ordinal - right.ordinal);

  for (const hop of orderedHops) {
    const node = graph.entities[normalize(hop.fromTable)];
    if (!node) {
      return undefined;
    }

    const edge = node.outboundRelationships.find((candidate) =>
      normalize(candidate.fromEntity) === normalize(hop.fromTable)
      && normalize(candidate.toEntity) === normalize(hop.toTable)
      && normalize(candidate.schemaName) === normalize(hop.relationshipSchemaName)
      && candidate.relationshipType === hop.relationshipType
      && (!hop.navigationProperty || normalize(candidate.navigationPropertyName) === normalize(hop.navigationProperty))
      && (!hop.lookupAttribute || normalize(candidate.referencingAttribute) === normalize(hop.lookupAttribute))
    );

    if (!edge) {
      return undefined;
    }

    edges.push(edge);
    entities.push(edge.toEntity);
  }

  return {
    routeId: `business-path:${artifact.id}`,
    sourceEntity: artifact.sourceTable,
    targetEntity: artifact.targetTable,
    entities,
    edges,
    hopCount: edges.length,
    confidence: "high"
  };
}

function validationRank(state: GuidedTraversalPreferredPathState): number {
  switch (state) {
    case "valid": return 0;
    case "unknown": return 1;
    case "stale": return 2;
  }
}

function comparePreferredProjection(
  left: GuidedTraversalPreferredPath,
  right: GuidedTraversalPreferredPath
): number {
  const leftPriority = left.artifact.priority ?? Number.MAX_SAFE_INTEGER;
  const rightPriority = right.artifact.priority ?? Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  const validation = validationRank(left.state) - validationRank(right.state);
  if (validation !== 0) {
    return validation;
  }

  const leftVerifiedAt = left.artifact.verification?.verifiedAt ?? "";
  const rightVerifiedAt = right.artifact.verification?.verifiedAt ?? "";
  if (leftVerifiedAt !== rightVerifiedAt) {
    return rightVerifiedAt.localeCompare(leftVerifiedAt);
  }

  return left.artifact.id.localeCompare(right.artifact.id);
}

/**
 * Adds managed preference above existing Guided Traversal discovery.
 *
 * Existing route ranking is not changed. Saved paths are independently loaded,
 * metadata-revalidated against the current traversal graph, and projected as a
 * top-visible overlay.
 */
export async function buildGuidedTraversalBusinessPathOverlay(
  repository: BusinessPathRepository,
  graph: TraversalGraph,
  sourceTable: string,
  targetTable: string,
  discoveredRoutes: readonly TraversalRoute[],
  activeEnvironmentId?: string,
  metadataProvider?: BusinessPathMetadataProvider
): Promise<GuidedTraversalBusinessPathOverlay> {
  const matching = repository
    .findMatching(sourceTable, targetTable)
    .filter((artifact) => artifact.state === "preferred");

  if (!matching.length) {
    return {
      preferredPaths: [],
      discoveredRoutes
    };
  }

  const revalidator = new BusinessPathRevalidationService(
    metadataProvider ?? new TraversalGraphBusinessPathMetadataProvider(graph)
  );

  const preferredPaths: GuidedTraversalPreferredPath[] = [];

  for (const artifact of matching) {
    const validation = await revalidator.revalidate(artifact, activeEnvironmentId);
    const duplicate = discoveredRoutes.find((route) => isExactBusinessPathRoute(artifact, route));

    preferredPaths.push({
      artifact,
      validation,
      state: validation.state,
      ...(validation.state === "valid"
        ? { route: duplicate ?? buildRouteFromArtifact(artifact, graph) }
        : {}),
      ...(duplicate ? { duplicateDiscoveredRouteId: duplicate.routeId } : {})
    });
  }

  return {
    preferredPaths: preferredPaths.sort(comparePreferredProjection),
    discoveredRoutes
  };
}
