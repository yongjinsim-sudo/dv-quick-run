import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { canRunTraversalBatch, canRunTraversalOptimizedBatch } from "../../../../product/capabilities/capabilityResolver.js";
import { runAction } from "../shared/actionRunner.js";
import { executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import { appendTraversalInsightActions } from "../shared/traversal/traversalInsightActions.js";
import type { ContinueTraversalRequest, TraversalStepQuery } from "../shared/traversal/traversalTypes.js";
import {
  getActiveTraversalProgress,
  isActiveTraversalSession,
  setActiveTraversalProgress
} from "../shared/traversal/traversalProgressStore.js";
import { buildTraversalViewerContext } from "./traversalSessionHelpers.js";
import { getTraversalExplainVerbosity } from "./traversalExplainConfig.js";
import {
  buildExecutionStrategyHintLines,
  buildLegExplanationLines,
  buildNoResultGuidanceLines
} from "./traversalExplainability.js";

function flattenExecutedQueriesThroughStep(
  executedQueriesByStep: Record<number, TraversalStepQuery[]> | undefined,
  stepIndex: number
): TraversalStepQuery[] {
  if (!executedQueriesByStep) {
    return [];
  }

  const queries: TraversalStepQuery[] = [];
  for (let index = 0; index <= stepIndex; index += 1) {
    queries.push(...(executedQueriesByStep[index] ?? []));
  }

  return queries;
}

function getStartingQuerySequence(
  executedQueriesByStep: Record<number, TraversalStepQuery[]> | undefined,
  stepIndex: number
): number {
  const firstQuery = executedQueriesByStep?.[stepIndex]?.[0];
  return firstQuery?.queryNumber ?? 1;
}

export async function runBackTraversalAction(
  ctx: CommandContext,
  request?: Pick<ContinueTraversalRequest, "traversalSessionId">
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Back Traversal failed. Check Output.", async () => {
    const progress = getActiveTraversalProgress();

    if (request?.traversalSessionId) {
      if (!progress || !isActiveTraversalSession(request.traversalSessionId)) {
        void ctx.output.show(true);
        logWarn(ctx.output, "This traversal session is no longer active.");
        return;
      }
    }

    if (!progress) {
      logInfo(ctx.output, "No active traversal is available to step back.");
      return;
    }

    const currentSiblingExpandClause = progress.siblingExpandClausesByStep?.[progress.currentStepIndex]
      ?? progress.currentStepSiblingExpandClause;

    if (currentSiblingExpandClause) {
      const currentStep = progress.itinerary.steps[progress.currentStepIndex];
      if (!currentStep) {
        logWarn(ctx.output, "The current traversal step is no longer available.");
        return;
      }

      const explainVerbosity = getTraversalExplainVerbosity();
      const currentInput = progress.selectedInputsByStep?.[progress.currentStepIndex] ?? progress.currentStepInput;
      const startingQuerySequence = getStartingQuerySequence(progress.executedQueriesByStep, progress.currentStepIndex);

      logInfo(ctx.output, "Undo Sibling Expand");
      logInfo(
        ctx.output,
        `Re-running Step ${progress.currentStepIndex + 1}/${progress.itinerary.steps.length} without sibling expand: ${currentStep.stageLabel}`
      );

      const landedNode = progress.graph.entities[currentStep.toEntity];
      const execution = await executeTraversalStep(
        ctx,
        progress.graph,
        progress.itinerary,
        currentStep,
        currentInput,
        startingQuerySequence,
        {
          traversalContext: buildTraversalViewerContext({
            sessionId: progress.sessionId,
            isBestMatchRoute: progress.isBestMatchRoute,
            itinerary: progress.itinerary,
            currentStepIndex: progress.currentStepIndex,
            currentEntityName: currentStep.toEntity,
            requiredCarryField: landedNode?.primaryIdAttribute,
            canSiblingExpand: true,
            canRunBatch: canRunTraversalBatch() && progress.currentStepIndex >= progress.itinerary.steps.length - 1,
            canRunOptimizedBatch: canRunTraversalOptimizedBatch() && progress.currentStepIndex >= progress.itinerary.steps.length - 1,
            canGoBack: progress.currentStepIndex > 0,
            canChangeRoute: !!progress.routeOptions?.length,
            verbosity: explainVerbosity
          })
        }
      );

      for (const line of buildExecutionStrategyHintLines({ executionPlan: execution.executionPlan, verbosity: explainVerbosity })) {
        logInfo(ctx.output, line);
      }

      if (execution.landing.ids.length === 0) {
        logInfo(ctx.output, "No usable rows were returned after removing sibling expand.");
        for (const line of buildNoResultGuidanceLines({ step: currentStep, verbosity: explainVerbosity })) {
          logInfo(ctx.output, line);
        }
      }

      for (const line of buildLegExplanationLines({
        itinerary: progress.itinerary,
        step: currentStep,
        stepIndex: progress.currentStepIndex,
        rowCount: execution.landing.ids.length,
        verbosity: explainVerbosity
      })) {
        logInfo(ctx.output, line);
      }

      const insightActions = appendTraversalInsightActions({
        route: progress.route,
        itinerary: progress.itinerary,
        step: currentStep,
        executionPlan: execution.executionPlan,
        landing: execution.landing
      });

      const retainedSiblingExpandClausesByStep = { ...(progress.siblingExpandClausesByStep ?? {}) };
      delete retainedSiblingExpandClausesByStep[progress.currentStepIndex];

      const retainedExecutedQueriesByStep: Record<number, TraversalStepQuery[]> = {};
      for (let index = 0; index <= progress.currentStepIndex; index += 1) {
        retainedExecutedQueriesByStep[index] = index === progress.currentStepIndex
          ? execution.executedQueries
          : progress.executedQueriesByStep?.[index] ?? [];
      }

      setActiveTraversalProgress({
        ...progress,
        lastLanding: execution.landing,
        currentStepInput: currentInput,
        selectedInputsByStep: {
          ...(progress.selectedInputsByStep ?? {}),
          [progress.currentStepIndex]: currentInput
        },
        currentStepSiblingExpandClause: undefined,
        siblingExpandClausesByStep: retainedSiblingExpandClausesByStep,
        currentStepInsightActions: insightActions,
        nextQuerySequenceNumber: startingQuerySequence + execution.executedQueryCount,
        executedQueriesByStep: retainedExecutedQueriesByStep,
        executedQueries: flattenExecutedQueriesThroughStep(retainedExecutedQueriesByStep, progress.currentStepIndex),
        isCompleted: progress.currentStepIndex >= progress.itinerary.steps.length - 1
      });

      logInfo(ctx.output, "Sibling expand removed. Continue from the current traversal step or choose another route.");
      return;
    }

    if (progress.currentStepIndex <= 0) {
      logInfo(ctx.output, "Guided Traversal is already at the first step.");
      return;
    }

    const previousStepIndex = progress.currentStepIndex - 1;
    const previousStep = progress.itinerary.steps[previousStepIndex];

    if (!previousStep) {
      logWarn(ctx.output, "The previous traversal step is no longer available.");
      return;
    }

    const explainVerbosity = getTraversalExplainVerbosity();
    const previousInput = progress.selectedInputsByStep?.[previousStepIndex];
    const startingQuerySequence = getStartingQuerySequence(progress.executedQueriesByStep, previousStepIndex);

    logInfo(ctx.output, "Back Guided Traversal");
    logInfo(
      ctx.output,
      `Re-running Step ${previousStepIndex + 1}/${progress.itinerary.steps.length}: ${previousStep.stageLabel}`
    );
    logInfo(ctx.output, `Landing target: ${previousStep.toEntity}`);

    const landedNode = progress.graph.entities[previousStep.toEntity];
    const execution = await executeTraversalStep(
      ctx,
      progress.graph,
      progress.itinerary,
      previousStep,
      previousInput,
      startingQuerySequence,
      {
        traversalContext: buildTraversalViewerContext({
          sessionId: progress.sessionId,
          isBestMatchRoute: progress.isBestMatchRoute,
          itinerary: progress.itinerary,
          currentStepIndex: previousStepIndex,
          currentEntityName: previousStep.toEntity,
          requiredCarryField: landedNode?.primaryIdAttribute,
          canSiblingExpand: true,
          canRunBatch: canRunTraversalBatch() && previousStepIndex >= progress.itinerary.steps.length - 1,
          canRunOptimizedBatch: canRunTraversalOptimizedBatch() && previousStepIndex >= progress.itinerary.steps.length - 1,
          canGoBack: previousStepIndex > 0,
          canChangeRoute: !!progress.routeOptions?.length,
          verbosity: explainVerbosity
        }),
        siblingExpandClause: progress.siblingExpandClausesByStep?.[previousStepIndex]
      }
    );

    for (const line of buildExecutionStrategyHintLines({ executionPlan: execution.executionPlan, verbosity: explainVerbosity })) {
      logInfo(ctx.output, line);
    }

    if (execution.landing.ids.length === 0) {
      logInfo(ctx.output, "No usable rows were returned while stepping back through this path.");
      for (const line of buildNoResultGuidanceLines({ step: previousStep, verbosity: explainVerbosity })) {
        logInfo(ctx.output, line);
      }
      return;
    }

    for (const line of buildLegExplanationLines({
      itinerary: progress.itinerary,
      step: previousStep,
      stepIndex: previousStepIndex,
      rowCount: execution.landing.ids.length,
      verbosity: explainVerbosity
    })) {
      logInfo(ctx.output, line);
    }

    const insightActions = appendTraversalInsightActions({
      route: progress.route,
      itinerary: progress.itinerary,
      step: previousStep,
      executionPlan: execution.executionPlan,
      landing: execution.landing
    });

    const retainedExecutedQueriesByStep: Record<number, TraversalStepQuery[]> = {};
    for (let index = 0; index <= previousStepIndex; index += 1) {
      retainedExecutedQueriesByStep[index] = index === previousStepIndex
        ? execution.executedQueries
        : progress.executedQueriesByStep?.[index] ?? [];
    }

    const updatedProgress = {
      ...progress,
      currentStepIndex: previousStepIndex,
      lastLanding: execution.landing,
      currentStepInput: previousInput,
      selectedInputsByStep: {
        ...(progress.selectedInputsByStep ?? {}),
        [previousStepIndex]: previousInput
      },
      currentStepSiblingExpandClause: progress.siblingExpandClausesByStep?.[previousStepIndex],
      currentStepInsightActions: insightActions,
      nextQuerySequenceNumber: startingQuerySequence + execution.executedQueryCount,
      executedQueriesByStep: retainedExecutedQueriesByStep,
      executedQueries: flattenExecutedQueriesThroughStep(retainedExecutedQueriesByStep, previousStepIndex),
      isCompleted: false
    };

    setActiveTraversalProgress(updatedProgress);

    const followingStep = progress.itinerary.steps[previousStepIndex + 1];
    if (followingStep) {
      logInfo(ctx.output, `Back complete. Next: ${followingStep.stageLabel}`);
    } else {
      logInfo(ctx.output, "Back complete.");
    }
  });
}
