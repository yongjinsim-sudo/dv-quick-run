import type { TraversalPath } from "./traversalTypes.js";

export type TraversalStage = {
  stageNumber: number;
  fromEntity: string;
  toEntity: string;
  queryTemplate: string;
  relationshipHops: number;
  hopRelationships: string[];
  pathLabel: string;
  stageLabel: string;
};

export type PlannedTraversal = {
  path: TraversalPath;
  stages: TraversalStage[];
};

function buildEntitySequence(path: TraversalPath): string[] {
  const sequence: string[] = [];

  for (const leg of path.legs) {
    if (sequence.length === 0) {
      sequence.push(leg.fromEntity);
    }

    if (sequence[sequence.length - 1] !== leg.toEntity) {
      sequence.push(leg.toEntity);
    }
  }

  return sequence;
}

function buildPathLabel(path: TraversalPath): string {
  return buildEntitySequence(path).join(" → ");
}

export function buildTraversalStages(path: TraversalPath): TraversalStage[] {
  const firstLeg = path.legs[0];
  if (!firstLeg) {
    return [];
  }

  const lastLeg = path.legs[path.legs.length - 1] ?? firstLeg;
  const hopRelationships = path.legs
    .map((leg) => leg.viaRelationship)
    .filter((value): value is string => !!value && value.trim().length > 0);

  return [
    {
      stageNumber: 1,
      fromEntity: firstLeg.fromEntity,
      toEntity: lastLeg.toEntity,
      queryTemplate: firstLeg.queryTemplate,
      relationshipHops: path.hops,
      hopRelationships,
      pathLabel: buildPathLabel(path),
      stageLabel: `${firstLeg.fromEntity} → ${lastLeg.toEntity}`
    }
  ];
}

export function buildPlannedTraversal(path: TraversalPath): PlannedTraversal {
  return {
    path,
    stages: buildTraversalStages(path)
  };
}