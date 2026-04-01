import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo } from "../../../../utils/logger.js";
import { getTraversalExplainVerbosity } from "./traversalExplainConfig.js";
import {
  buildExecutionStrategyHintLines,
  buildLegExplanationLines,
  buildNoResultGuidanceLines,
  buildRouteExplanationLines
} from "./traversalExplainability.js";
import { appendTraversalInsightActions } from "../shared/traversal/traversalInsightActions.js";
import {
  clearActiveTraversalProgress,
  setActiveTraversalProgress
} from "../shared/traversal/traversalProgressStore.js";
import { executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import type {
  TraversalExecutionPlan,
  TraversalGraph,
  TraversalRoute
} from "../shared/traversal/traversalTypes.js";
import type { TraversalProgressReporter } from "./traversalActionTypes.js";
import {
  buildTraversalDebugLabel,
  buildTraversalSessionId,
  buildTraversalViewerContext
} from "./traversalSessionHelpers.js";
import {
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription
} from "../shared/traversal/traversalSelection.js";

export async function executeFirstStepDefault(
  ctx: CommandContext,
  graph: TraversalGraph,
  route: TraversalRoute,
  itinerary: TraversalExecutionPlan,
  progress?: TraversalProgressReporter
): Promise<void> {
  const firstStep = itinerary.steps[0];
  const explainVerbosity = getTraversalExplainVerbosity();

  if (!firstStep) {
    return;
  }

  clearActiveTraversalProgress();

  logInfo(ctx.output, "Find Path to Table");
  logInfo(
    ctx.output,
    `Selected route: ${buildReadableTraversalRouteLabel(route)} (${buildTraversalRouteDescription(route)})`
  );
  logInfo(ctx.output, `Selected itinerary: ${itinerary.label}`);

  for (const line of buildRouteExplanationLines(route, explainVerbosity)) {
    logInfo(ctx.output, line);
  }
  logInfo(ctx.output, `Executing Step 1/${itinerary.steps.length}: ${firstStep.stageLabel}`);
  logInfo(ctx.output, `Main mission target: ${firstStep.toEntity}`);
  logInfo(ctx.output, "Queries executed:");

  progress?.report(`Running step 1 of ${itinerary.steps.length}: ${firstStep.stageLabel}`, 70);

  const landedNodeForViewer = graph.entities[firstStep.toEntity];
  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  const environmentKey = activeEnvironment?.name ?? "default";
  const sessionId = buildTraversalSessionId();
  const debugLabel = buildTraversalDebugLabel(
    route.sourceEntity,
    route.targetEntity,
    route.routeId,
    environmentKey
  );

  const execution = await executeTraversalStep(
    ctx,
    graph,
    itinerary,
    firstStep,
    undefined,
    1,
    {
      traversalContext: buildTraversalViewerContext({
        sessionId,
        itinerary,
        currentStepIndex: 0,
        currentEntityName: firstStep.toEntity,
        requiredCarryField: landedNodeForViewer?.primaryIdAttribute,
        canSiblingExpand: firstStep.toEntity !== route.targetEntity ? true : true,
        verbosity: explainVerbosity
      })
    }
  );

  for (const line of buildExecutionStrategyHintLines({ executionPlan: execution.executionPlan, verbosity: explainVerbosity })) {
    logInfo(ctx.output, line);
  }

  if (execution.landing.ids.length === 0) {
    for (const line of buildNoResultGuidanceLines({ step: firstStep, verbosity: explainVerbosity })) {
      logInfo(ctx.output, line);
    }
    logInfo(
      ctx.output,
      `This variant did not produce usable data at ${firstStep.toEntity}. Try another variant.`
    );
    return;
  }

  for (const line of buildLegExplanationLines({
    itinerary,
    step: firstStep,
    stepIndex: 0,
    rowCount: execution.landing.ids.length,
    verbosity: explainVerbosity
  })) {
    logInfo(ctx.output, line);
  }

  logInfo(ctx.output, `Step 1/${itinerary.steps.length} complete: landed on ${execution.landing.entityName}`);

  const landedNode = graph.entities[execution.landing.entityName];
  if (landedNode?.primaryIdAttribute) {
    logInfo(ctx.output, `PKs: ${landedNode.primaryIdAttribute}`);
  }

  const insightActions = appendTraversalInsightActions({
    route,
    itinerary,
    step: firstStep,
    executionPlan: execution.executionPlan,
    landing: execution.landing
  });

  if (insightActions.length) {
    logInfo(ctx.output, "Enhance results (optional):");

    for (const action of insightActions) {
      logInfo(ctx.output, `  - ${action.title} — ${action.description}`);
    }

    logInfo(
      ctx.output,
      "These actions apply to the current leg only. Continue Traversal carries only traversal continuation state."
    );
  }

  const traversalProgress = {
    sessionId,
    debugLabel,
    route,
    itinerary,
    currentStepIndex: 0,
    graph,
    lastLanding: execution.landing,
    currentStepInput: undefined,
    currentStepSiblingExpandClause: undefined,
    currentStepInsightActions: insightActions,
    nextQuerySequenceNumber: 1 + execution.executedQueryCount,
    isCompleted: itinerary.steps.length <= 1
  };

  progress?.report(`Step 1 complete: landed on ${execution.landing.entityName}`, 25);

  setActiveTraversalProgress(traversalProgress);

  if (itinerary.steps.length > 1) {
    const nextStep = itinerary.steps[1];
    if (nextStep) {
      logInfo(ctx.output, `Next step available: ${nextStep.stageLabel}`);
      logInfo(ctx.output, "👉 Run: DV Quick Run: Continue Traversal");
    }
    return;
  }

  logInfo(ctx.output, "Guided Traversal complete.");
  logInfo(ctx.output, `Reached: ${execution.landing.entityName}`);
  logInfo(ctx.output, "Sibling expand remains available on this landed result.");
}
