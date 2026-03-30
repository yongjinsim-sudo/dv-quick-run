import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { runAction } from "../shared/actionRunner.js";
import { executeTraversalStep } from "../shared/traversal/traversalStepExecutor.js";
import { appendTraversalInsightActions } from "../shared/traversal/traversalInsightActions.js";
import type {
  ContinueTraversalRequest,
  TraversalLandingContext
} from "../shared/traversal/traversalTypes.js";
import {
  clearActiveTraversalProgress,
  getActiveTraversalProgress,
  isActiveTraversalSession,
  setActiveTraversalProgress
} from "../shared/traversal/traversalProgressStore.js";
import { buildTraversalViewerContext } from "./traversalSessionHelpers.js";
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
    const nextStep = progress.itinerary.steps[nextStepIndex];

    if (!nextStep) {
      logInfo(ctx.output, "Traversal is already complete.");
      logInfo(ctx.output, `Reached: ${progress.lastLanding?.entityName ?? progress.itinerary.steps[progress.currentStepIndex]?.toEntity ?? progress.route.targetEntity}`);
      logInfo(ctx.output, "Sibling expand remains available on this landed result.");
      return;
    }

    const effectiveLanding: TraversalLandingContext | undefined = request?.carryValue
      ? {
          entityName: progress.lastLanding?.entityName ?? nextStep.fromEntity,
          ids: [request.carryValue]
        }
      : progress.lastLanding;

    logInfo(ctx.output, "Continue Traversal");
    logInfo(
      ctx.output,
      `Executing Step ${nextStepIndex + 1}/${progress.itinerary.steps.length}: ${nextStep.stageLabel}`
    );
    logInfo(ctx.output, `Main mission target: ${nextStep.toEntity}`);
    logInfo(ctx.output, "Queries executed:");

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
          itinerary: progress.itinerary,
          currentStepIndex: nextStepIndex,
          currentEntityName: nextStep.toEntity,
          requiredCarryField: landedNode?.primaryIdAttribute,
          canSiblingExpand: true
        }),
        siblingExpandClause: progress.siblingExpandClausesByStep?.[nextStepIndex]
      }
    );

    if (execution.landing.ids.length === 0) {
      clearActiveTraversalProgress();
      logInfo(ctx.output, `No usable rows were returned for this path.`);
      logInfo(ctx.output, `This variant did not produce usable data at ${nextStep.toEntity}. Try another variant.`);
      return;
    }

    const insightActions = appendTraversalInsightActions({
      route: progress.route,
      itinerary: progress.itinerary,
      step: nextStep,
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

    const updatedProgress = {
      ...progress,
      currentStepIndex: nextStepIndex,
      lastLanding: execution.landing,
      currentStepInput: effectiveLanding,
      currentStepSiblingExpandClause: progress.siblingExpandClausesByStep?.[nextStepIndex],
      currentStepInsightActions: insightActions,
      nextQuerySequenceNumber:
        (progress.nextQuerySequenceNumber ?? 1) + execution.executedQueryCount
    };

    if (nextStepIndex >= progress.itinerary.steps.length - 1) {
      if (execution.landing.ids.length > 0) {
        await recordSuccessfulTraversalRoute(ctx, progress.route);
      }

      setActiveTraversalProgress({
        ...updatedProgress,
        isCompleted: true
      });
      logInfo(ctx.output, "Guided Traversal complete.");
      logInfo(ctx.output, `Reached: ${nextStep.toEntity}`);
      logInfo(ctx.output, "Sibling expand remains available on this landed result.");
      return;
    }

    setActiveTraversalProgress(updatedProgress);

    const followingStep = progress.itinerary.steps[nextStepIndex + 1];
    if (followingStep) {
      logInfo(ctx.output, `Next step available: ${followingStep.stageLabel}`);
    }
  });
}