import type {
  TraversalExecutionPlan,
  TraversalExecutionStep,
  TraversalExplainVerbosity,
  TraversalRoute,
  TraversalStepExecutionPlan,
  TraversalViewerContext
} from "../shared/traversal/traversalTypes.js";

function humanize(value: string | undefined): string {
  return String(value ?? "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function safeRelationshipName(step: TraversalExecutionStep): string {
  return step.edges[0]?.navigationPropertyName?.trim() || "unknown relationship";
}

export function buildRouteExplanationLines(
  route: TraversalRoute,
  verbosity: TraversalExplainVerbosity
): string[] {
  if (verbosity === "off") {
    return [];
  }

  const lines: string[] = [];

  route.edges.forEach((edge, index) => {
    lines.push(
      `Step ${index + 1}: ${edge.fromEntity} → ${edge.toEntity} via ${edge.navigationPropertyName}`
    );
  });

  if (verbosity === "minimal") {
    return lines;
  }

  const meaningParts = route.edges.map((edge, index) => {
    const relationship = humanize(edge.navigationPropertyName);
    return index === 0
      ? `follow ${relationship} from ${edge.fromEntity} to ${edge.toEntity}`
      : `then follow ${relationship} from ${edge.fromEntity} to ${edge.toEntity}`;
  });

  lines.push("Route meaning:");
  lines.push(`This path will ${meaningParts.join(", ")}.`);

  return lines;
}

export function buildLegExplanationLines(args: {
  itinerary: TraversalExecutionPlan;
  step: TraversalExecutionStep;
  stepIndex: number;
  rowCount: number;
  verbosity: TraversalExplainVerbosity;
}): string[] {
  if (args.verbosity === "off") {
    return [];
  }

  const lines = [
    `Step ${args.stepIndex + 1}/${args.itinerary.steps.length}: ${args.step.fromEntity} → ${args.step.toEntity}`,
    `Rows: ${args.rowCount}`
  ];

  const nextStep = args.itinerary.steps[args.stepIndex + 1];
  if (nextStep) {
    lines.push(`Next: ${nextStep.stageLabel}`);
  }

  return lines;
}

export function buildExecutionStrategyHintLines(args: {
  executionPlan: TraversalStepExecutionPlan;
  verbosity: TraversalExplainVerbosity;
}): string[] {
  void args.executionPlan;

  if (args.verbosity === "off") {
    return [];
  }

  return [];
}

export function buildNoResultGuidanceLines(args: {
  step: TraversalExecutionStep;
  verbosity: TraversalExplainVerbosity;
}): string[] {
  if (args.verbosity === "off") {
    return [];
  }

  const lines = [
    `No rows were returned for ${args.step.toEntity}.`,
    "This route is structurally valid, but valid routes do not guarantee matching data for the current dataset."
  ];

  if (args.verbosity === "verbose") {
    lines.push("Try another variant, a different source record, or continue only when a usable carry value exists.");
  }

  return lines;
}

export function buildTraversalBannerContext(args: {
  itinerary: TraversalExecutionPlan;
  currentStepIndex: number;
  currentEntityName?: string;
  requiredCarryField?: string;
  canSiblingExpand?: boolean;
  verbosity: TraversalExplainVerbosity;
}): Partial<TraversalViewerContext> {
  if (args.verbosity === "off") {
    return {
      showBanner: false
    };
  }

  const currentStep = args.itinerary.steps[args.currentStepIndex];
  const nextStep = args.itinerary.steps[args.currentStepIndex + 1];

  if (!currentStep) {
    return {
      showBanner: false
    };
  }

  const title = nextStep
    ? `Guided Traversal: leg ${args.currentStepIndex + 1} of ${args.itinerary.steps.length}`
    : "Guided Traversal complete";

  const subtitleParts = [
    `${currentStep.fromEntity} → ${currentStep.toEntity} (via ${safeRelationshipName(currentStep)})`
  ];

  if (nextStep) {
    subtitleParts.push(`Next: ${nextStep.toEntity}`);
  } else if (args.currentEntityName) {
    subtitleParts.push(`Reached: ${args.currentEntityName}`);
  }

  return {
    showBanner: true,
    bannerTitle: title,
    bannerSubtitle: subtitleParts.join(" • "),
    currentEntityName: args.currentEntityName,
    requiredCarryField: args.requiredCarryField,
    canSiblingExpand: args.canSiblingExpand
  };
}
