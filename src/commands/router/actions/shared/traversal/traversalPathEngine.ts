import { normalizeReasoningName } from "../metadataReasoning/metadataReasoningCommon.js";
import type {
  TraversalEntityNode,
  TraversalGraph,
  TraversalLeg,
  TraversalPath,
  TraversalRelationshipEdge,
  TraversalRequest,
  TraversalPlan
} from "./traversalTypes.js";

export function buildTraversalPlan(
  graph: TraversalGraph,
  request: TraversalRequest
): TraversalPlan {
  const sourceEntity = normalizeReasoningName(request.sourceEntity);
  const targetEntity = normalizeReasoningName(request.targetEntity);

  const sourceNode = graph.entities[sourceEntity];
  const targetNode = graph.entities[targetEntity];

  if (!sourceNode || !targetNode || sourceEntity === "" || targetEntity === "") {
    return {
      sourceEntity,
      targetEntity,
      candidatePaths: []
    };
  }

  const directPaths = buildDirectPaths(graph, sourceNode, targetNode);
  const twoHopPaths = buildTwoHopPaths(graph, sourceNode, targetNode);

  const candidatePaths = dedupePaths([...directPaths, ...twoHopPaths]).sort(comparePaths);

  return {
    sourceEntity,
    targetEntity,
    candidatePaths
  };
}

function buildDirectPaths(
  graph: TraversalGraph,
  sourceNode: TraversalEntityNode,
  targetNode: TraversalEntityNode
): TraversalPath[] {
  return sourceNode.outboundRelationships
    .filter((edge) => normalizeReasoningName(edge.toEntity) === targetNode.logicalName)
    .map((edge) => buildDirectPath(graph, sourceNode, targetNode, edge));
}

function buildTwoHopPaths(
  graph: TraversalGraph,
  sourceNode: TraversalEntityNode,
  targetNode: TraversalEntityNode
): TraversalPath[] {
  const paths: TraversalPath[] = [];

  for (const firstEdge of sourceNode.outboundRelationships) {
    const midEntityName = normalizeReasoningName(firstEdge.toEntity);

    if (!midEntityName || midEntityName === sourceNode.logicalName) {
      continue;
    }

    const midNode = graph.entities[midEntityName];
    if (!midNode) {
      continue;
    }

    for (const secondEdge of midNode.outboundRelationships) {
      const secondTargetName = normalizeReasoningName(secondEdge.toEntity);

      if (secondTargetName !== targetNode.logicalName) {
        continue;
      }

      if (midNode.logicalName === targetNode.logicalName) {
        continue;
      }

      paths.push(buildTwoHopPath(graph, sourceNode, midNode, targetNode, firstEdge, secondEdge));
    }
  }

  return paths;
}

function buildDirectPath(
  graph: TraversalGraph,
  sourceNode: TraversalEntityNode,
  targetNode: TraversalEntityNode,
  edge: TraversalRelationshipEdge
): TraversalPath {
  const continuationField = getContinuationField(sourceNode, edge);
  const targetFilterField = getTargetFilterField(sourceNode, targetNode, edge);
  const firstPlaceholder = buildPlaceholder(1, continuationField);

  const legs: TraversalLeg[] = [
    {
      legNumber: 1,
      fromEntity: sourceNode.logicalName,
      toEntity: targetNode.logicalName,
      viaRelationship: edge.navigationPropertyName,
      fromField: continuationField,
      toField: targetFilterField,
      queryTemplate: buildSourceLegQuery(sourceNode, continuationField),
      requiredValueField: continuationField,
      nextPlaceholder: firstPlaceholder,
      isFinal: false
    },
    {
      legNumber: 2,
      fromEntity: targetNode.logicalName,
      toEntity: targetNode.logicalName,
      viaRelationship: edge.navigationPropertyName,
      fromField: targetFilterField,
      toField: targetFilterField,
      queryTemplate: buildFilteredLegQuery(targetNode, targetFilterField, firstPlaceholder),
      requiredValueField: targetFilterField,
      isFinal: true
    }
  ];

  return {
    pathId: buildPathId(legs),
    hops: 1,
    confidence: "high",
    summaryLabel: `${sourceNode.logicalName} → ${edge.navigationPropertyName} → ${targetNode.logicalName}`,
    legs
  };
}

function buildTwoHopPath(
  graph: TraversalGraph,
  sourceNode: TraversalEntityNode,
  midNode: TraversalEntityNode,
  targetNode: TraversalEntityNode,
  firstEdge: TraversalRelationshipEdge,
  secondEdge: TraversalRelationshipEdge
): TraversalPath {
  const firstContinuationField = getContinuationField(sourceNode, firstEdge);
  const firstTargetFilterField = getTargetFilterField(sourceNode, midNode, firstEdge);
  const firstPlaceholder = buildPlaceholder(1, firstContinuationField);

  const secondContinuationField = getContinuationField(midNode, secondEdge);
  const secondTargetFilterField = getTargetFilterField(midNode, targetNode, secondEdge);
  const secondPlaceholder = buildPlaceholder(2, secondContinuationField);

  const legs: TraversalLeg[] = [
    {
      legNumber: 1,
      fromEntity: sourceNode.logicalName,
      toEntity: midNode.logicalName,
      viaRelationship: firstEdge.navigationPropertyName,
      fromField: firstContinuationField,
      toField: firstTargetFilterField,
      queryTemplate: buildSourceLegQuery(sourceNode, firstContinuationField),
      requiredValueField: firstContinuationField,
      nextPlaceholder: firstPlaceholder,
      isFinal: false
    },
    {
      legNumber: 2,
      fromEntity: midNode.logicalName,
      toEntity: targetNode.logicalName,
      viaRelationship: secondEdge.navigationPropertyName,
      fromField: secondContinuationField,
      toField: secondTargetFilterField,
      queryTemplate: buildFilteredLegQuery(
        midNode,
        firstTargetFilterField,
        firstPlaceholder,
        secondContinuationField
      ),
      requiredValueField: secondContinuationField,
      nextPlaceholder: secondPlaceholder,
      isFinal: false
    },
    {
      legNumber: 3,
      fromEntity: targetNode.logicalName,
      toEntity: targetNode.logicalName,
      viaRelationship: secondEdge.navigationPropertyName,
      fromField: secondTargetFilterField,
      toField: secondTargetFilterField,
      queryTemplate: buildFilteredLegQuery(targetNode, secondTargetFilterField, secondPlaceholder),
      requiredValueField: secondTargetFilterField,
      isFinal: true
    }
  ];

  return {
    pathId: buildPathId(legs),
    hops: 2,
    confidence: "medium",
    summaryLabel: `${sourceNode.logicalName} → ${midNode.logicalName} → ${targetNode.logicalName}`,
    legs
  };
}

function buildSourceLegQuery(
  entity: TraversalEntityNode,
  requiredValueField: string
): string {
  const selectFields = buildSelectFields(entity, requiredValueField);
  return `${entity.entitySetName}?$select=${selectFields.join(",")}`;
}

function buildFilteredLegQuery(
  entity: TraversalEntityNode,
  filterField: string,
  placeholder: string,
  requiredValueField?: string
): string {
  const selectFields = buildSelectFields(entity, requiredValueField);
  return `${entity.entitySetName}?$select=${selectFields.join(",")}&$filter=${filterField} eq {{${placeholder}}}`;
}

function buildSelectFields(
  entity: TraversalEntityNode,
  requiredValueField?: string
): string[] {
  const fields = [
    entity.primaryIdAttribute,
    entity.primaryNameAttribute,
    requiredValueField
  ].filter((value): value is string => !!value && value.trim().length > 0);

  return Array.from(new Set(fields));
}

function getContinuationField(
  sourceNode: TraversalEntityNode,
  edge: TraversalRelationshipEdge
): string {
  if (edge.direction === "manyToOne") {
    return normalizeReasoningName(edge.referencingAttribute ?? edge.navigationPropertyName);
  }

  return normalizeReasoningName(sourceNode.primaryIdAttribute ?? `${sourceNode.logicalName}id`);
}

function getTargetFilterField(
  sourceNode: TraversalEntityNode,
  targetNode: TraversalEntityNode,
  edge: TraversalRelationshipEdge
): string {
  if (edge.direction === "oneToMany") {
    return normalizeReasoningName(edge.referencingAttribute ?? `${sourceNode.logicalName}id`);
  }

  return normalizeReasoningName(targetNode.primaryIdAttribute ?? `${targetNode.logicalName}id`);
}

function buildPlaceholder(legNumber: number, fieldName: string): string {
  return `LEG${legNumber}_${normalizeReasoningName(fieldName).toUpperCase()}`;
}

function buildPathId(legs: TraversalLeg[]): string {
  return legs
    .map((leg) => `${leg.fromEntity}:${leg.viaRelationship}:${leg.toEntity}`)
    .join("|");
}

function dedupePaths(paths: TraversalPath[]): TraversalPath[] {
  const seen = new Set<string>();
  const result: TraversalPath[] = [];

  for (const path of paths) {
    if (seen.has(path.pathId)) {
      continue;
    }

    seen.add(path.pathId);
    result.push(path);
  }

  return result;
}

function comparePaths(left: TraversalPath, right: TraversalPath): number {
  if (left.hops !== right.hops) {
    return left.hops - right.hops;
  }

  return left.summaryLabel.localeCompare(right.summaryLabel);
}