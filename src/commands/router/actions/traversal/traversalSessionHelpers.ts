import type {
  TraversalExecutionPlan,
  TraversalViewerContext
} from "../shared/traversal/traversalTypes.js";

export function buildTraversalSessionId(): string {
  return `trv_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function buildTraversalDebugLabel(
  sourceEntity: string,
  targetEntity: string,
  routeId: string,
  environmentKey: string
): string {
  return `${sourceEntity}->${targetEntity}:${routeId}:${environmentKey}`;
}

export function buildTraversalViewerContext(args: {
  sessionId: string;
  itinerary: TraversalExecutionPlan;
  currentStepIndex: number;
  currentEntityName?: string;
  requiredCarryField?: string;
  canSiblingExpand?: boolean;
}): TraversalViewerContext {
  const nextStep = args.itinerary.steps[args.currentStepIndex + 1];

  return {
    openedFrom: "guidedTraversal",
    traversalSessionId: args.sessionId,
    legIndex: args.currentStepIndex,
    legCount: args.itinerary.steps.length,
    hasNextLeg: !!nextStep,
    nextLegLabel: nextStep?.stageLabel,
    nextLegEntityName: nextStep?.toEntity,
    requiredCarryField: args.requiredCarryField,
    currentEntityName: args.currentEntityName,
    isFinalLeg: !nextStep,
    canSiblingExpand: args.canSiblingExpand
  };
}
