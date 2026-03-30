import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo, logWarn } from "../../../../utils/logger.js";
import { runAction } from "../shared/actionRunner.js";
import { buildPlannedTraversalRoute } from "../shared/traversal/traversalPlanGenerator.js";
import { buildTraversalRoutes } from "../shared/traversal/traversalRouteExplorer.js";
import {
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription,
  getPracticalTraversalRoutes
} from "../shared/traversal/traversalSelection.js";
import { getActiveTraversalProgress, clearActiveTraversalProgress } from "../shared/traversal/traversalProgressStore.js";
import { TraversalCacheService } from "../shared/traversal/traversalCacheService.js";
import type {
  PlannedTraversalRoute,
  TraversalExecutionPlan,
  TraversalGraph,
  TraversalRoute
} from "../shared/traversal/traversalTypes.js";
import type {
  TraversalEntityOption,
  TraversalProgressReporter
} from "./traversalActionTypes.js";
import {
  applyTraversalScopeToGraph,
  loadTraversalScopeSettings,
  normalizeTraversalTableName
} from "./traversalScope.js";
import {
  buildFocusedTraversalGraph,
  loadTraversalEntityOptions,
  pickTraversalEntityOption
} from "./traversalGraphBuilder.js";
import {
  pickExecutionPlanFromQuickPick,
  pickTraversalRouteFromQuickPick
} from "./traversalRoutePickerService.js";
import { executeFirstStepDefault } from "./traversalStartExecution.js";

type FindPathToTableDeps = {
  loadEntityOptions: (ctx: CommandContext) => Promise<TraversalEntityOption[]>;
  pickSourceEntity: (options: TraversalEntityOption[]) => Promise<TraversalEntityOption | undefined>;
  pickTargetEntity: (
    options: TraversalEntityOption[],
    source: TraversalEntityOption
  ) => Promise<TraversalEntityOption | undefined>;
  buildTraversalGraph: (
    ctx: CommandContext,
    source: TraversalEntityOption,
    target: TraversalEntityOption
  ) => Promise<TraversalGraph>;
  pickTraversalRoute: (
    graph: TraversalGraph,
    routes: TraversalRoute[]
  ) => Promise<TraversalRoute | undefined>;
  pickExecutionPlan: (
    graph: TraversalGraph,
    plannedRoute: PlannedTraversalRoute
  ) => Promise<TraversalExecutionPlan | undefined>;
  executeFirstStep: (
    ctx: CommandContext,
    graph: TraversalGraph,
    route: TraversalRoute,
    itinerary: TraversalExecutionPlan,
    progress?: TraversalProgressReporter
  ) => Promise<void>;
  showInfoMessage: (message: string) => Thenable<unknown> | void;
};

function buildRouteCacheKey(
  ctx: CommandContext,
  source: TraversalEntityOption,
  target: TraversalEntityOption,
  traversalScope: ReturnType<typeof loadTraversalScopeSettings>
): {
  environmentKey: string;
  routeCacheKey: {
    environmentId: string;
    sourceTable: string;
    targetTable: string;
    maxDepth: number;
  };
} {
  const activeEnvironment = ctx.envContext.getActiveEnvironment();

  const environmentKey =
    activeEnvironment?.url?.trim().toLowerCase() ??
    activeEnvironment?.name?.trim().toLowerCase() ??
    "default";

  const normalizedSource = normalizeTraversalTableName(source.logicalName);
  const normalizedTarget = normalizeTraversalTableName(target.logicalName);
  const maxDepth = 5;

  return {
    environmentKey,
    routeCacheKey: {
      environmentId: `${environmentKey}::${traversalScope.scopeSignature}`,
      sourceTable: normalizedSource,
      targetTable: normalizedTarget,
      maxDepth
    }
  };
}

async function resolveGraphAndRoutes(
  ctx: CommandContext,
  deps: FindPathToTableDeps,
  source: TraversalEntityOption,
  target: TraversalEntityOption
): Promise<{ graph: TraversalGraph; routes: TraversalRoute[] }> {
  return vscode.window.withProgress(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Finding routes (${source.logicalName} -> ${target.logicalName})`,
      cancellable: false
    },
    async (routeProgress) => {
      const traversalScope = loadTraversalScopeSettings(ctx);
      const { environmentKey, routeCacheKey } = buildRouteCacheKey(ctx, source, target, traversalScope);

      routeProgress.report({ message: "Checking cached traversal routes...", increment: 10 });
      const cachedRoutes = TraversalCacheService.getRoute(routeCacheKey);

      if (cachedRoutes) {
        logDebug(ctx.output, "Route discovery cache: HIT");
        logDebug(ctx.output, `Using cached routes for ${routeCacheKey.sourceTable} -> ${routeCacheKey.targetTable}`);

        routeProgress.report({ message: "Using cached traversal routes...", increment: 70 });

        const cachedGraph = TraversalCacheService.getMetadata(environmentKey);
        if (cachedGraph) {
          routeProgress.report({
            message: `Found ${cachedRoutes.length} practical route${cachedRoutes.length === 1 ? "" : "s"}.`,
            increment: 20
          });

          return {
            graph: cachedGraph,
            routes: cachedRoutes
          };
        }

        logWarn(
          ctx.output,
          "Route cache hit but traversal metadata cache was empty. Rebuilding graph."
        );
      } else {
        logDebug(ctx.output, "Route discovery cache: MISS");
      }

      routeProgress.report({ message: "Checking cached Dataverse traversal metadata...", increment: 10 });
      let graph = TraversalCacheService.getMetadata(environmentKey);

      if (graph) {
        logDebug(ctx.output, "Traversal metadata cache: HIT");
        routeProgress.report({ message: "Using cached Dataverse traversal metadata...", increment: 25 });
      } else {
        logDebug(ctx.output, "Traversal metadata cache: MISS");
        routeProgress.report({ message: "Building traversal graph...", increment: 25 });

        const graphStart = Date.now();
        graph = await deps.buildTraversalGraph(ctx, source, target);
        TraversalCacheService.setMetadata(environmentKey, graph);
        logDebug(ctx.output, `Traversal metadata build: ${Date.now() - graphStart}ms`);
      }

      routeProgress.report({ message: "Exploring practical routes...", increment: 35 });

      const routeStart = Date.now();
      const scopedGraph = applyTraversalScopeToGraph(
        graph,
        source.logicalName,
        target.logicalName,
        traversalScope
      );

      const discoveredRoutes = buildTraversalRoutes(scopedGraph, {
        sourceEntity: source.logicalName,
        targetEntity: target.logicalName
      });

      const routes = getPracticalTraversalRoutes(discoveredRoutes);
      TraversalCacheService.setRoute(routeCacheKey, routes);

      logDebug(ctx.output, `Route exploration: ${Date.now() - routeStart}ms`);
      logDebug(ctx.output, "Route discovery cache: STORED");

      routeProgress.report({
        message: `Found ${routes.length} practical route${routes.length === 1 ? "" : "s"}.`,
        increment: 20
      });

      return { graph, routes };
    }
  );
}

function createDefaultDeps(ctx: CommandContext): FindPathToTableDeps {
  return {
    loadEntityOptions: loadTraversalEntityOptions,
    pickSourceEntity: async (options) =>
      pickTraversalEntityOption(
        "DV Quick Run: Find Path to Table",
        "Pick the starting table",
        options
      ),
    pickTargetEntity: async (options, source) =>
      pickTraversalEntityOption(
        "DV Quick Run: Find Path to Table",
        `Pick the destination table (source: ${source.logicalName})`,
        options.filter((option) => option.logicalName !== source.logicalName)
      ),
    buildTraversalGraph: buildFocusedTraversalGraph,
    pickTraversalRoute: async (graph, routes) =>
      pickTraversalRouteFromQuickPick(ctx, graph, routes),
    pickExecutionPlan: pickExecutionPlanFromQuickPick,
    executeFirstStep: executeFirstStepDefault,
    showInfoMessage: (message) => vscode.window.showInformationMessage(message)
  };
}

export async function runFindPathToTableWorkflow(
  ctx: CommandContext,
  deps: FindPathToTableDeps,
  progress?: TraversalProgressReporter
): Promise<void> {
  progress?.report("Loading Dataverse tables...", 5);
  const entityOptions = await deps.loadEntityOptions(ctx);

  if (!entityOptions.length) {
    await deps.showInfoMessage("DV Quick Run: No Dataverse tables were available for traversal.");
    return;
  }

  const source = await deps.pickSourceEntity(entityOptions);
  if (!source) {
    return;
  }

  const target = await deps.pickTargetEntity(entityOptions, source);
  if (!target) {
    return;
  }

  if (source.logicalName === target.logicalName) {
    await deps.showInfoMessage("DV Quick Run: Source and destination tables are the same.");
    return;
  }

  const { graph, routes } = await resolveGraphAndRoutes(ctx, deps, source, target);

  if (!routes.length) {
    logWarn(ctx.output, `No traversal route found from ${source.logicalName} to ${target.logicalName}.`);
    await deps.showInfoMessage(
      `DV Quick Run: No route found from ${source.logicalName} to ${target.logicalName}.`
    );
    return;
  }

  const selectedRoute = await deps.pickTraversalRoute(graph, routes);
  if (!selectedRoute) {
    return;
  }

  progress?.report(`Planning execution for ${selectedRoute.sourceEntity} -> ${selectedRoute.targetEntity}...`, 10);
  const plannedRoute = buildPlannedTraversalRoute(selectedRoute);
  const selectedPlan = await deps.pickExecutionPlan(graph, plannedRoute);

  if (!selectedPlan) {
    return;
  }

  await deps.executeFirstStep(ctx, graph, selectedRoute, selectedPlan, progress);
}

async function confirmTraversalReplacement(ctx: CommandContext): Promise<boolean> {
  const existingProgress = getActiveTraversalProgress();

  if (!existingProgress) {
    return true;
  }

  const replaceChoice = await vscode.window.showWarningMessage(
    "You have an active guided traversal in progress. Starting a new traversal will end the current one.",
    { modal: false },
    "Start New Traversal",
    "Cancel"
  );

  if (replaceChoice !== "Start New Traversal") {
    return false;
  }

  clearActiveTraversalProgress();
  logInfo(ctx.output, `Replaced active traversal session: ${existingProgress.debugLabel}`);
  return true;
}

export async function runFindPathToTableAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Find Path to Table failed. Check Output.", async () => {
    if (!(await confirmTraversalReplacement(ctx))) {
      return;
    }

    await vscode.window.withProgress(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DV Quick Run: Find Path to Table",
        cancellable: false
      },
      async (progress) => {
        const reporter: TraversalProgressReporter = {
          report: (message: string, increment?: number) => progress.report({ message, increment })
        };

        await runFindPathToTableWorkflow(ctx, createDefaultDeps(ctx), reporter);
      }
    );
  });
}

export {
  buildFocusedTraversalGraph,
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription
};
