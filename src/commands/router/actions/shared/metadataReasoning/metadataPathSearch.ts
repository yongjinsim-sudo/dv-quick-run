import { normalizeReasoningName } from "./metadataReasoningCommon.js";
import type {
  MetadataPathCandidate,
  MetadataPathSegment,
  MetadataReasoningEntityNode,
  MetadataReasoningGraph,
  MetadataReasoningRelationshipEdge
} from "./metadataReasoningTypes.js";

function clonePath(pathSegments: MetadataPathSegment[]): MetadataPathSegment[] {
  return pathSegments.map((segment) => ({ ...segment }));
}

function toPathSegment(edge: MetadataReasoningRelationshipEdge): MetadataPathSegment {
  return {
    fromEntity: edge.fromEntity,
    toEntity: edge.toEntity,
    navigationPropertyName: edge.navigationPropertyName,
    relationshipType: edge.relationshipType,
    direction: edge.direction,
    schemaName: edge.schemaName,
    referencingAttribute: edge.referencingAttribute
  };
}

function getNode(graph: MetadataReasoningGraph, logicalName: string): MetadataReasoningEntityNode | undefined {
  const key = normalizeReasoningName(logicalName);
  return graph.entities[key];
}

function hasField(node: MetadataReasoningEntityNode | undefined, targetField: string): boolean {
  if (!node) {
    return false;
  }

  const normalizedTargetField = normalizeReasoningName(targetField);
  if (!normalizedTargetField) {
    return false;
  }

  return node.fieldLogicalNames.some((field) => normalizeReasoningName(field) === normalizedTargetField);
}

export function searchMetadataPaths(
  graph: MetadataReasoningGraph,
  startEntity: string,
  targetField: string,
  maxDepth: number
): MetadataPathCandidate[] {
  const normalizedStartEntity = normalizeReasoningName(startEntity);
  const normalizedTargetField = normalizeReasoningName(targetField);

  if (!normalizedStartEntity || !normalizedTargetField || maxDepth < 0) {
    return [];
  }

  const startNode = getNode(graph, normalizedStartEntity);
  if (!startNode) {
    return [];
  }

  const candidates: MetadataPathCandidate[] = [];
  const queue: Array<{
    entity: string;
    hopCount: number;
    pathSegments: MetadataPathSegment[];
    visitedEntities: Set<string>;
  }> = [
    {
      entity: normalizedStartEntity,
      hopCount: 0,
      pathSegments: [],
      visitedEntities: new Set([normalizedStartEntity])
    }
  ];

  while (queue.length > 0) {
    const current = queue.shift();
    if (!current) {
      continue;
    }

    const currentNode = getNode(graph, current.entity);
    if (!currentNode) {
      continue;
    }

    if (hasField(currentNode, normalizedTargetField)) {
      candidates.push({
        terminalEntity: current.entity,
        matchedField: normalizedTargetField,
        hopCount: current.hopCount,
        pathSegments: clonePath(current.pathSegments),
        reasons: buildReasons(current.entity, current.hopCount, current.pathSegments)
      });
    }

    if (current.hopCount >= maxDepth) {
      continue;
    }

    for (const edge of currentNode.outboundRelationships) {
      const nextEntity = normalizeReasoningName(edge.toEntity);
      if (!nextEntity || current.visitedEntities.has(nextEntity)) {
        continue;
      }

      const nextVisitedEntities = new Set(current.visitedEntities);
      nextVisitedEntities.add(nextEntity);

      queue.push({
        entity: nextEntity,
        hopCount: current.hopCount + 1,
        pathSegments: [...current.pathSegments, toPathSegment(edge)],
        visitedEntities: nextVisitedEntities
      });
    }
  }

  return candidates;
}

function buildReasons(entity: string, hopCount: number, pathSegments: MetadataPathSegment[]): string[] {
  if (hopCount === 0) {
    return [`Field is local to ${entity}.`];
  }

  if (pathSegments.length === 0) {
    return [`Field was matched on ${entity}.`];
  }

  const pathLabel = pathSegments.map((segment) => segment.navigationPropertyName).join(" -> ");
  return [`Field is reachable on ${entity} within ${hopCount} hop(s).`, `Path: ${pathLabel}`];
}
