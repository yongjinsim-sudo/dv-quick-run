import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { runAction } from "../shared/actionRunner.js";
import { buildPlannedTraversalRoute } from "../shared/traversal/traversalPlanGenerator.js";
import { buildRankedTraversalRoutes } from "../shared/traversal/traversalSelection.js";
import type { ContinueTraversalRequest } from "../shared/traversal/traversalTypes.js";
import {
  getActiveTraversalProgress,
  isActiveTraversalSession
} from "../shared/traversal/traversalProgressStore.js";
import {
  pickExecutionPlanFromQuickPick,
  pickTraversalRouteFromQuickPick
} from "./traversalRoutePickerService.js";
import { executeFirstStepDefault } from "./traversalStartExecution.js";

export async function runChangeTraversalRouteAction(
  ctx: CommandContext,
  request?: Pick<ContinueTraversalRequest, "traversalSessionId">
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Change Guided Traversal route failed. Check Output.", async () => {
    const progress = getActiveTraversalProgress();

    if (request?.traversalSessionId) {
      if (!progress || !isActiveTraversalSession(request.traversalSessionId)) {
        void ctx.output.show(true);
        logWarn(ctx.output, "This traversal session is no longer active.");
        return;
      }
    }

    if (!progress) {
      logInfo(ctx.output, "No active traversal is available to change route.");
      return;
    }

    const routeOptions = progress.routeOptions ?? [progress.route];
    if (routeOptions.length <= 1) {
      logInfo(ctx.output, "No alternate traversal routes are available for this active session.");
      return;
    }

    logInfo(ctx.output, "Change Guided Traversal Route");
    logInfo(ctx.output, `Current route: ${progress.route.entities.join(" → ")}`);

    const selectedRoute = await pickTraversalRouteFromQuickPick(ctx, progress.graph, routeOptions);
    if (!selectedRoute) {
      logInfo(ctx.output, "Change route cancelled.");
      return;
    }

    const plannedRoute = buildPlannedTraversalRoute(selectedRoute);
    const selectedPlan = await pickExecutionPlanFromQuickPick(progress.graph, plannedRoute);
    if (!selectedPlan) {
      logInfo(ctx.output, "Change route cancelled.");
      return;
    }

    const isBestMatchRoute = buildRankedTraversalRoutes(routeOptions)
      .some((item) => item.route.routeId === selectedRoute.routeId && item.isBestMatch);

    await executeFirstStepDefault(ctx, progress.graph, selectedRoute, selectedPlan, undefined, {
      isBestMatchRoute,
      routeOptions
    });
  });
}
