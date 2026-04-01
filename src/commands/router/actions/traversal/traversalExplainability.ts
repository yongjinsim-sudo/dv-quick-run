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

function buildSqlMentalModel(route: TraversalRoute): string[] {
  return route.edges.map((edge) => {
    const leftField = edge.referencingAttribute?.trim() || edge.navigationPropertyName;
    const rightField = `${edge.toEntity}id`;
    return `${edge.fromEntity}.${leftField} = ${edge.toEntity}.${rightField}`;
  });
}

export function buildRouteExplanationLines(
  route: TraversalRoute,
  verbosity: TraversalExplainVerbosity
): string[] {
  if (verbosity === "off") {
    return [];
  }

  const lines: string[] = [
    `Traversal route selected: ${route.entities.join(" → ")}`
  ];

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

  lines.push("Meaning:");
  lines.push(`This path will ${meaningParts.join(", ")}.`);

  const sqlLines = buildSqlMentalModel(route);
  if (sqlLines.length) {
    lines.push("SQL mental model:");
    sqlLines.forEach((line) => lines.push(line));
  }

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

  const relationship = safeRelationshipName(args.step);
  const lines = [
    `Traversal leg summary: ${args.stepIndex + 1}/${args.itinerary.steps.length} ${args.step.fromEntity} → ${args.step.toEntity} via ${relationship}.`,
    `Rows returned: ${args.rowCount}.`
  ];

  const nextStep = args.itinerary.steps[args.stepIndex + 1];
  if (nextStep) {
    lines.push(`Next step: ${nextStep.stageLabel}.`);
  }

  if (args.verbosity === "verbose") {
    lines.push(
      `Meaning: this leg follows ${humanize(relationship)} from ${args.step.fromEntity} to ${args.step.toEntity}.`
    );
  }

  return lines;
}

export function buildExecutionStrategyHintLines(args: {
  executionPlan: TraversalStepExecutionPlan;
  verbosity: TraversalExplainVerbosity;
}): string[] {
  if (args.verbosity === "off") {
    return [];
  }

  const modeLabel = args.executionPlan.mode.replace(/_/g, " ");
  const lines = [`Traversal strategy hint: ${modeLabel}.`];

  if (args.verbosity === "verbose") {
    if (args.executionPlan.mode === "direct") {
      lines.push("This leg is being executed as a direct expand-first traversal.");
    } else if (args.executionPlan.mode === "nested_expand") {
      lines.push("This leg is being executed using nested expand shape while keeping traversal explicit.");
    } else {
      lines.push("Traversal remains step-based and explicit even when fallback planning is used.");
    }
  }

  return lines;
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
