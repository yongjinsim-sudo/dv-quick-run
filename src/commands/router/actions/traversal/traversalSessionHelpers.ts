import type {
  TraversalExecutionPlan,
  TraversalViewerContext
} from "../shared/traversal/traversalTypes.js";
import type { TraversalExplainVerbosity } from "../shared/traversal/traversalTypes.js";
import { buildTraversalBannerContext } from "./traversalExplainability.js";

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
  verbosity: TraversalExplainVerbosity;
}): TraversalViewerContext {
  const nextStep = args.itinerary.steps[args.currentStepIndex + 1];

  const banner = buildTraversalBannerContext({
    itinerary: args.itinerary,
    currentStepIndex: args.currentStepIndex,
    currentEntityName: args.currentEntityName,
    requiredCarryField: args.requiredCarryField,
    canSiblingExpand: args.canSiblingExpand,
    verbosity: args.verbosity
  });

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
    canSiblingExpand: args.canSiblingExpand,
    showBanner: banner.showBanner,
    bannerTitle: banner.bannerTitle,
    bannerSubtitle: banner.bannerSubtitle
  };
}
