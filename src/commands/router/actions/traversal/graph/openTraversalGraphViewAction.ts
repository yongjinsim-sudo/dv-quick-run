import * as vscode from "vscode";
import type { CommandContext } from "../../../../context/commandContext.js";
import { runAction } from "../../shared/actionRunner.js";
import type { RankedTraversalRoute } from "../../shared/traversal/traversalSelection.js";
import { buildPlannedTraversalRoute } from "../../shared/traversal/traversalPlanGenerator.js";
import type { TraversalGraph } from "../../shared/traversal/traversalTypes.js";
import { executeFirstStepDefault } from "../traversalStartExecution.js";
import { getTraversalGraphHtml } from "../../../../../webview/traversalGraphHtml.js";
import {
  buildInitialTraversalGraphRouteWindow,
  expandTraversalGraphRouteWindowToMax,
  shiftTraversalGraphRouteWindowNext,
  shiftTraversalGraphRouteWindowPrevious
} from "./traversalGraphRouteWindow.js";
import { buildTraversalGraphViewModel } from "./traversalGraphViewModelBuilder.js";
import { mapTraversalGraphViewModelToCy, type TraversalGraphCyElement } from "./traversalGraphCyMapper.js";
import { resolveTraversalGraphRouteSelectionFromClick } from "./traversalGraphSelection.js";
import type {
  BuildTraversalGraphViewModelArgs,
  TraversalGraphSelectableRoute,
  TraversalGraphSessionLayoutState,
  TraversalGraphViewModel
} from "./traversalGraphTypes.js";

const TRAVERSAL_GRAPH_PANEL_VIEW_TYPE = "dvQuickRunTraversalGraph";
const TRAVERSAL_GRAPH_PANEL_TITLE = "DV Quick Run Guided Traversal Graph";

let currentTraversalGraphPanel: vscode.WebviewPanel | undefined;
let currentTraversalGraphSession: TraversalGraphSurfaceSession | undefined;

export type TraversalGraphState = {
  sourceEntity: string;
  targetEntity: string;
  routeWindow: {
    startIndex: number;
    visibleCount: number;
    totalRoutes: number;
    maxVisibleCount: number;
  };
  selectedRouteId?: string;
  focusedKeyword?: string;
  layoutState: TraversalGraphSessionLayoutState;
};

export type TraversalGraphUiModelMessage = {
  type: "renderGraph";
  graphViewModel: TraversalGraphViewModel;
  cyElements: TraversalGraphCyElement[];
};

export type TraversalGraphUiEvent =
  | { type: "graphReady" }
  | { type: "routeClicked"; routeId?: string }
  | { type: "edgeClicked"; edgeId?: string; routeIds?: string[] }
  | { type: "useRouteRequested"; routeId?: string }
  | { type: "showMoreRequested" }
  | { type: "nextWindowRequested" }
  | { type: "previousWindowRequested" }
  | { type: "focusChanged"; focusedKeyword?: string }
  | { type: "resetLayoutRequested" }
  | { type: "closeRequested" }
  | { type: "nodePositionsChanged"; positionsByNodeId?: Record<string, { x: number; y: number }> };

export type OpenTraversalGraphViewRequest = {
  sourceEntity: string;
  targetEntity: string;
  graph: TraversalGraph;
  rankedRoutes: RankedTraversalRoute[];
  selectedRouteId?: string;
};

type TraversalGraphSurfaceSession = {
  ctx: CommandContext;
  graph: TraversalGraph;
  rankedRoutes: RankedTraversalRoute[];
  graphState: TraversalGraphState;
  onUseRouteRequested: (args: {
    ctx: CommandContext;
    graph: TraversalGraph;
    rankedRoutes: RankedTraversalRoute[];
    routeId: string;
    graphState: TraversalGraphState;
  }) => Promise<void>;
};

type OpenTraversalGraphViewDeps = {
  buildInitialGraphState: (args: {
    sourceEntity: string;
    targetEntity: string;
    totalRoutes: number;
    selectedRouteId?: string;
  }) => TraversalGraphState;
  buildGraphViewModel: (args: BuildTraversalGraphViewModelArgs) => TraversalGraphViewModel;
  mapTraversalGraphViewModelToCy: (args: {
    graph: TraversalGraphViewModel;
  }) => { elements: TraversalGraphCyElement[] };
  openGraphSurface: (args: {
    ctx: CommandContext;
    graph: TraversalGraph;
    graphState: TraversalGraphState;
    renderMessage: TraversalGraphUiModelMessage;
    rankedRoutes: RankedTraversalRoute[];
    onUseRouteRequested: (args: {
      ctx: CommandContext;
      graph: TraversalGraph;
      rankedRoutes: RankedTraversalRoute[];
      routeId: string;
      graphState: TraversalGraphState;
    }) => Promise<void>;
  }) => Promise<void>;
  onUseRouteRequested: (args: {
    ctx: CommandContext;
    graph: TraversalGraph;
    rankedRoutes: RankedTraversalRoute[];
    routeId: string;
    graphState: TraversalGraphState;
  }) => Promise<void>;
  showInfoMessage: (message: string) => Thenable<unknown> | void;
};

export async function runOpenTraversalGraphViewAction(
  ctx: CommandContext,
  request: OpenTraversalGraphViewRequest,
  deps: OpenTraversalGraphViewDeps = createDefaultOpenTraversalGraphViewDeps()
): Promise<void> {
  await runAction(ctx, "DV Quick Run: Open graph view failed. Check Output.", async () => {
    if (request.rankedRoutes.length === 0) {
      await deps.showInfoMessage("DV Quick Run: No traversal routes are available for graph view.");
      return;
    }

    const graphState = deps.buildInitialGraphState({
      sourceEntity: request.sourceEntity,
      targetEntity: request.targetEntity,
      totalRoutes: request.rankedRoutes.length,
      selectedRouteId: request.selectedRouteId
    });

    const renderMessage = buildTraversalGraphRenderMessage({
      graphState,
      rankedRoutes: request.rankedRoutes,
      buildGraphViewModel: deps.buildGraphViewModel,
      mapTraversalGraphViewModelToCy: deps.mapTraversalGraphViewModelToCy
    });

    await deps.openGraphSurface({
      ctx,
      graph: request.graph,
      graphState,
      renderMessage,
      rankedRoutes: request.rankedRoutes,
      onUseRouteRequested: deps.onUseRouteRequested
    });
  });
}

export function buildInitialTraversalGraphState(args: {
  sourceEntity: string;
  targetEntity: string;
  totalRoutes: number;
  selectedRouteId?: string;
}): TraversalGraphState {
  return {
    sourceEntity: args.sourceEntity,
    targetEntity: args.targetEntity,
    routeWindow: buildInitialTraversalGraphRouteWindow(args.totalRoutes),
    selectedRouteId: args.selectedRouteId,
    focusedKeyword: undefined,
    layoutState: {
      positionsByNodeId: {}
    }
  };
}

export function buildTraversalGraphRenderMessage(args: {
  graphState: TraversalGraphState;
  rankedRoutes: RankedTraversalRoute[];
  buildGraphViewModel: (args: BuildTraversalGraphViewModelArgs) => TraversalGraphViewModel;
  mapTraversalGraphViewModelToCy: (args: {
    graph: TraversalGraphViewModel;
  }) => { elements: TraversalGraphCyElement[] };
}): TraversalGraphUiModelMessage {
  const graphViewModel = args.buildGraphViewModel({
    sourceEntity: args.graphState.sourceEntity,
    targetEntity: args.graphState.targetEntity,
    rankedRoutes: args.rankedRoutes,
    routeWindow: {
      startIndex: args.graphState.routeWindow.startIndex,
      visibleCount: args.graphState.routeWindow.visibleCount,
      maxVisibleCount: args.graphState.routeWindow.maxVisibleCount
    },
    selectedRouteId: args.graphState.selectedRouteId,
    focusedKeyword: args.graphState.focusedKeyword,
    layoutState: args.graphState.layoutState
  });

  const cy = args.mapTraversalGraphViewModelToCy({
    graph: graphViewModel
  });

  return {
    type: "renderGraph",
    graphViewModel,
    cyElements: cy.elements
  };
}

export function buildTraversalGraphWebviewHtml(args: {
  panelTitle: string;
  renderMessage: TraversalGraphUiModelMessage;
}): string {
  return getTraversalGraphHtml({
    panelTitle: args.panelTitle,
    initialRenderMessage: args.renderMessage
  });
}

export function resolveTraversalGraphStateFromUiEvent(args: {
  event: TraversalGraphUiEvent;
  graphState: TraversalGraphState;
  graphViewModel: TraversalGraphViewModel;
}): TraversalGraphState {
  switch (args.event.type) {
    case "routeClicked": {
      const clickedRouteId = args.event.routeId;
      const selectedRouteId = getVisibleSelectableRoutes(args.graphViewModel).some(
        (route) => route.routeId === clickedRouteId
      )
        ? clickedRouteId
        : args.graphState.selectedRouteId;

      return {
        ...args.graphState,
        selectedRouteId
      };
    }

    case "edgeClicked": {
      const selectedRouteId = resolveTraversalGraphRouteSelectionFromClick({
        clickedEdgeRouteIds: args.event.routeIds,
        currentSelectedRouteId: args.graphState.selectedRouteId,
        visibleRoutes: getVisibleSelectableRoutes(args.graphViewModel)
      });

      return {
        ...args.graphState,
        selectedRouteId
      };
    }

    default:
      return args.graphState;
  }
}

function createDefaultOpenTraversalGraphViewDeps(): OpenTraversalGraphViewDeps {
  return {
    buildInitialGraphState: buildInitialTraversalGraphState,
    buildGraphViewModel: buildTraversalGraphViewModel,
    mapTraversalGraphViewModelToCy,
    openGraphSurface: openTraversalGraphSurface,
    onUseRouteRequested: async ({ ctx, graph, rankedRoutes, routeId, graphState }) => {
      const rankedRoute = rankedRoutes.find((item) => item.route.routeId === routeId);
      const route = rankedRoute?.route;

      if (!route) {
        await vscode.window.showWarningMessage(
          `DV Quick Run: Could not resolve selected graph route ${routeId}.`
        );
        return;
      }

      const plannedRoute = buildPlannedTraversalRoute(route);
      const recommendedPlan = plannedRoute.candidatePlans.find((plan) => plan.planId === plannedRoute.recommendedPlanId)
        ?? plannedRoute.candidatePlans[0];

      if (!recommendedPlan) {
        await vscode.window.showWarningMessage(
          `DV Quick Run: No runnable execution plan was available for ${graphState.sourceEntity} → ${graphState.targetEntity}.`
        );
        return;
      }

      await executeFirstStepDefault(
        ctx,
        graph,
        route,
        recommendedPlan,
        undefined,
        { isBestMatchRoute: rankedRoute?.isBestMatch }
      );

      ctx.output.show(true);
      currentTraversalGraphPanel?.dispose();
    },
    showInfoMessage: (message) => vscode.window.showInformationMessage(message)
  };
}

async function openTraversalGraphSurface(args: {
  ctx: CommandContext;
  graph: TraversalGraph;
  graphState: TraversalGraphState;
  renderMessage: TraversalGraphUiModelMessage;
  rankedRoutes: RankedTraversalRoute[];
  onUseRouteRequested: (args: {
    ctx: CommandContext;
    graph: TraversalGraph;
    rankedRoutes: RankedTraversalRoute[];
    routeId: string;
    graphState: TraversalGraphState;
  }) => Promise<void>;
}): Promise<void> {
  currentTraversalGraphSession = {
    ctx: args.ctx,
    graph: args.graph,
    rankedRoutes: args.rankedRoutes,
    graphState: args.graphState,
    onUseRouteRequested: args.onUseRouteRequested
  };

  if (currentTraversalGraphPanel) {
    currentTraversalGraphPanel.dispose();
    currentTraversalGraphPanel = undefined;
  }

  const panel = createTraversalGraphPanel();
  currentTraversalGraphPanel = panel;

  panel.title = `${TRAVERSAL_GRAPH_PANEL_TITLE}: ${args.graphState.sourceEntity} -> ${args.graphState.targetEntity}`;
  panel.webview.html = buildTraversalGraphWebviewHtml({
    panelTitle: TRAVERSAL_GRAPH_PANEL_TITLE,
    renderMessage: args.renderMessage
  });
}

function createTraversalGraphPanel(): vscode.WebviewPanel {
  const panel = vscode.window.createWebviewPanel(
    TRAVERSAL_GRAPH_PANEL_VIEW_TYPE,
    TRAVERSAL_GRAPH_PANEL_TITLE,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true
    }
  );

  panel.webview.onDidReceiveMessage(async (message: TraversalGraphUiEvent) => {
    await handleTraversalGraphUiEvent(message);
  });

  panel.onDidDispose(() => {
    currentTraversalGraphPanel = undefined;
    currentTraversalGraphSession = undefined;
  });

  return panel;
}

async function handleTraversalGraphUiEvent(message: TraversalGraphUiEvent): Promise<void> {
  const panel = currentTraversalGraphPanel;
  const session = currentTraversalGraphSession;

  if (!panel || !session) {
    return;
  }

  switch (message.type) {
    case "graphReady": {
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "routeClicked":
    case "edgeClicked": {
      const currentRender = buildTraversalGraphRenderMessage({
        graphState: session.graphState,
        rankedRoutes: session.rankedRoutes,
        buildGraphViewModel: buildTraversalGraphViewModel,
        mapTraversalGraphViewModelToCy
      });

      session.graphState = resolveTraversalGraphStateFromUiEvent({
        event: message,
        graphState: session.graphState,
        graphViewModel: currentRender.graphViewModel
      });

      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "showMoreRequested": {
      session.graphState = {
        ...session.graphState,
        routeWindow: expandTraversalGraphRouteWindowToMax(session.graphState.routeWindow)
      };
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "nextWindowRequested": {
      session.graphState = {
        ...session.graphState,
        routeWindow: shiftTraversalGraphRouteWindowNext(session.graphState.routeWindow)
      };
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "previousWindowRequested": {
      session.graphState = {
        ...session.graphState,
        routeWindow: shiftTraversalGraphRouteWindowPrevious(session.graphState.routeWindow)
      };
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "focusChanged": {
      session.graphState = {
        ...session.graphState,
        focusedKeyword: message.focusedKeyword?.trim() || undefined
      };
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "resetLayoutRequested": {
      session.graphState = {
        ...session.graphState,
        layoutState: { positionsByNodeId: {} }
      };
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "nodePositionsChanged": {
      session.graphState = {
        ...session.graphState,
        layoutState: {
          positionsByNodeId: {
            ...session.graphState.layoutState.positionsByNodeId,
            ...(message.positionsByNodeId || {})
          }
        }
      };
      return;
    }

    case "useRouteRequested": {
      if (!message.routeId) {
        return;
      }

      session.graphState = {
        ...session.graphState,
        selectedRouteId: message.routeId
      };
      await session.onUseRouteRequested({
        ctx: session.ctx,
        graph: session.graph,
        rankedRoutes: session.rankedRoutes,
        routeId: message.routeId,
        graphState: session.graphState
      });
      await rerenderTraversalGraphSurface(panel, session);
      return;
    }

    case "closeRequested": {
      panel.dispose();
      return;
    }
  }
}

async function rerenderTraversalGraphSurface(
  panel: vscode.WebviewPanel,
  session: TraversalGraphSurfaceSession
): Promise<void> {
  const renderMessage = buildTraversalGraphRenderMessage({
    graphState: session.graphState,
    rankedRoutes: session.rankedRoutes,
    buildGraphViewModel: buildTraversalGraphViewModel,
    mapTraversalGraphViewModelToCy
  });

  await panel.webview.postMessage(renderMessage);
}

function getVisibleSelectableRoutes(graphViewModel: TraversalGraphViewModel): TraversalGraphSelectableRoute[] {
  return graphViewModel.routes.map((route) => ({
    routeId: route.routeId,
    rank: route.rank,
    isBestMatch: route.semantics.isBestMatch,
    isFocusedByKeyword: route.semantics.isFocusedByKeyword
  }));
}
