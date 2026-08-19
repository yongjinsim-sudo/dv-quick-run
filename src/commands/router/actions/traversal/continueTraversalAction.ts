import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { canRunTraversalBatch, canRunTraversalOptimizedBatch } from "../../../../product/capabilities/capabilityResolver.js";
import { runAction } from "../shared/actionRunner.js";
import { executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import { appendTraversalInsightActions } from "../shared/traversal/traversalInsightActions.js";
import type {
  ContinueTraversalRequest,
  TraversalLandingContext
} from "../shared/traversal/traversalTypes.js";
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
import { recordSuccessfulTraversalRoute } from "../shared/traversal/traversalHistoryStore.js";

export async function runContinueTraversalAction(
  ctx: CommandContext,
  request?: ContinueTraversalRequest
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Continue Traversal failed. Check Output.", async () => {
    const progress = getActiveTraversalProgress();

    if (request?.traversalSessionId) {
      if (!progress || !isActiveTraversalSession(request.traversalSessionId)) {
        void ctx.output.show(true);
        logWarn(ctx.output, "This traversal session is no longer active.");
        return;
      }
    }

    if (!progress) {
      logInfo(ctx.output, "No active traversal is available to continue.");
      return;
    }

    const nextStepIndex = progress.currentStepIndex + 1;
    const explainVerbosity = getTraversalExplainVerbosity();
    const nextStep = progress.itinerary.steps[nextStepIndex];

    if (!nextStep) {
      logInfo(ctx.output, "Traversal is already complete.");
      logInfo(ctx.output, `Reached: ${progress.lastLanding?.entityName ?? progress.itinerary.steps[progress.currentStepIndex]?.toEntity ?? progress.route.targetEntity}`);
      logInfo(ctx.output, "Sibling expand remains available on this landed result.");
      return;
    }

    const selectedCarryValue = request?.carryValue?.trim();
    const effectiveLanding: TraversalLandingContext | undefined = selectedCarryValue
      ? {
          entityName: progress.lastLanding?.entityName ?? nextStep.fromEntity,
          ids: [selectedCarryValue]
        }
      : progress.lastLanding;

    if (
      !effectiveLanding
      || !Array.isArray(effectiveLanding.ids)
      || effectiveLanding.ids.length === 0
    ) {
      logWarn(
        ctx.output,
        `Traversal cannot continue to ${nextStep.toEntity} because the previous landing contains no record IDs.`
      );
      return;
    }

    if (effectiveLanding.entityName !== nextStep.fromEntity) {
      logWarn(
        ctx.output,
        `Traversal cannot continue because the active landing is ${effectiveLanding.entityName}, but the next hop expects ${nextStep.fromEntity}.`
      );
      return;
    }

    if (selectedCarryValue) {
      logInfo(ctx.output, `Continuation scope: selected row only (${selectedCarryValue}).`);
    } else if (effectiveLanding?.ids.length) {
      const boundedCount = Math.min(effectiveLanding.ids.length, 5);
      logInfo(
        ctx.output,
        `Continuation scope: landed-row frontier (${boundedCount}/${effectiveLanding.ids.length} row(s) considered; bounded at 5).`
      );
    }

    logInfo(ctx.output, "Continue Traversal");
    logInfo(
      ctx.output,
      `Executing Step ${nextStepIndex + 1}/${progress.itinerary.steps.length}: ${nextStep.stageLabel}`
    );
    logInfo(ctx.output, `Landing target: ${nextStep.toEntity}`);
  
    const landedNode = progress.graph.entities[nextStep.toEntity];

    const execution = await executeTraversalStep(
      ctx,
      progress.graph,
      progress.itinerary,
      nextStep,
      effectiveLanding,
      progress.nextQuerySequenceNumber ?? 1,
      {
        traversalContext: buildTraversalViewerContext({
          sessionId: progress.sessionId,
          isBestMatchRoute: progress.isBestMatchRoute,
          itinerary: progress.itinerary,
          currentStepIndex: nextStepIndex,
          currentEntityName: nextStep.toEntity,
          requiredCarryField: landedNode?.primaryIdAttribute,
          canSiblingExpand: true,
          canRunBatch: canRunTraversalBatch() && nextStepIndex >= progress.itinerary.steps.length - 1,
          canRunOptimizedBatch: canRunTraversalOptimizedBatch() && nextStepIndex >= progress.itinerary.steps.length - 1,
          canGoBack: nextStepIndex > 0,
          canChangeRoute: !!progress.routeOptions?.length,
          verbosity: explainVerbosity
        }),
        siblingExpandClause: progress.siblingExpandClausesByStep?.[nextStepIndex]
      }
    );

    for (const line of buildExecutionStrategyHintLines({ executionPlan: execution.executionPlan, verbosity: explainVerbosity })) {
      logInfo(ctx.output, line);
    }

    if (execution.landing.ids.length === 0) {
      setActiveTraversalProgress({
        ...progress,
        currentStepIndex: nextStepIndex,
        lastLanding: execution.landing,
        currentStepInput: effectiveLanding,
        selectedInputsByStep: {
          ...(progress.selectedInputsByStep ?? {}),
          [nextStepIndex]: effectiveLanding
        },
        selectedCarryValuesByStep: {
          ...(progress.selectedCarryValuesByStep ?? {}),
          [nextStepIndex]: selectedCarryValue || undefined
        },
        currentStepSiblingExpandClause: progress.siblingExpandClausesByStep?.[nextStepIndex],
        currentStepInsightActions: [],
        nextQuerySequenceNumber:
          (progress.nextQuerySequenceNumber ?? 1) + execution.executedQueryCount,
        executedQueries: [...(progress.executedQueries ?? []), ...execution.executedQueries],
        executedQueriesByStep: {
          ...(progress.executedQueriesByStep ?? {}),
          [nextStepIndex]: execution.executedQueries
        },
        isCompleted: false
      });

      logInfo(
        ctx.output,
        selectedCarryValue
          ? "No usable rows were returned for this selected branch."
          : "No usable rows were returned for the bounded landed-row frontier at this hop."
      );
      for (const line of buildNoResultGuidanceLines({ step: nextStep, verbosity: explainVerbosity })) {
        logInfo(ctx.output, line);
      }
      logInfo(
        ctx.output,
        selectedCarryValue
          ? `This selected row did not continue to ${nextStep.toEntity}. Use Back, then Continue to keep the previous landed rows in scope, or choose another row.`
          : `No bounded continuation was observed at ${nextStep.toEntity}. Use Back to inspect individual branches or Route for another path variant.`
      );
      return;
    }

    for (const line of buildLegExplanationLines({
      itinerary: progress.itinerary,
      step: nextStep,
      stepIndex: nextStepIndex,
      rowCount: execution.landing.ids.length,
      verbosity: explainVerbosity
    })) {
      logInfo(ctx.output, line);
    }

    const insightActions = appendTraversalInsightActions({
      route: progress.route,
      itinerary: progress.itinerary,
      step: nextStep,
      executionPlan: execution.executionPlan,
      landing: execution.landing
    });

    if (insightActions.length) {
      logInfo(ctx.output, "Optional enrichments:");

      for (const action of insightActions) {
        logInfo(ctx.output, `  - ${action.title} — ${action.description}`);
      }

    }

    const updatedProgress = {
      ...progress,
      currentStepIndex: nextStepIndex,
      lastLanding: execution.landing,
      currentStepInput: effectiveLanding,
      selectedInputsByStep: {
        ...(progress.selectedInputsByStep ?? {}),
        [nextStepIndex]: effectiveLanding
      },
      selectedCarryValuesByStep: {
        ...(progress.selectedCarryValuesByStep ?? {}),
        [nextStepIndex]: selectedCarryValue || undefined
      },
      currentStepSiblingExpandClause: progress.siblingExpandClausesByStep?.[nextStepIndex],
      currentStepInsightActions: insightActions,
      nextQuerySequenceNumber:
        (progress.nextQuerySequenceNumber ?? 1) + execution.executedQueryCount,
      executedQueries: [...(progress.executedQueries ?? []), ...execution.executedQueries],
      executedQueriesByStep: {
        ...(progress.executedQueriesByStep ?? {}),
        [nextStepIndex]: execution.executedQueries
      }
    };

    if (nextStepIndex >= progress.itinerary.steps.length - 1) {
      if (execution.landing.ids.length > 0) {
        await recordSuccessfulTraversalRoute(ctx, progress.route);
      }

      setActiveTraversalProgress({
        ...updatedProgress,
        isCompleted: true
      });
      
      logInfo(ctx.output, `Reached: ${nextStep.toEntity}`);
      logInfo(ctx.output, "Sibling expand remains available on this landed result.");
      if (canRunTraversalBatch() && (updatedProgress.executedQueries?.length ?? 0) >= 2) {
        logInfo(ctx.output, "Run completed traversal as $batch from the Result Viewer toolbar.");
      }
      logInfo(ctx.output, "- Guided Traversal complete -");
      return;
    }

    setActiveTraversalProgress(updatedProgress);

    const followingStep = progress.itinerary.steps[nextStepIndex + 1];
    if (followingStep) {
      logInfo(ctx.output, `Next: ${followingStep.stageLabel}`);
    }
  });
}
