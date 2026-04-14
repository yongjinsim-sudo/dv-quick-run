import * as vscode from "vscode";
import type { CommandContext } from "../../../../context/commandContext.js";
import { runAction } from "../../shared/actionRunner.js";
import type { RankedTraversalRoute } from "../../shared/traversal/traversalSelection.js";
import { buildInitialTraversalGraphRouteWindow } from "./traversalGraphRouteWindow.js";
import { buildTraversalGraphViewModel } from "./traversalGraphViewModelBuilder.js";
import { mapTraversalGraphViewModelToCy, type TraversalGraphCyElement } from "./traversalGraphCyMapper.js";
import type {
  BuildTraversalGraphViewModelArgs,
  TraversalGraphSessionLayoutState,
  TraversalGraphViewModel
} from "./traversalGraphTypes.js";

const TRAVERSAL_GRAPH_PANEL_VIEW_TYPE = "dvQuickRunTraversalGraph";
const TRAVERSAL_GRAPH_PANEL_TITLE = "DV Quick Run Guided Traversal Graph";

let currentTraversalGraphPanel: vscode.WebviewPanel | undefined;

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

export type OpenTraversalGraphViewRequest = {
  sourceEntity: string;
  targetEntity: string;
  rankedRoutes: RankedTraversalRoute[];
  selectedRouteId?: string;
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
    graphState: TraversalGraphState;
    renderMessage: TraversalGraphUiModelMessage;
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

    const graphViewModel = deps.buildGraphViewModel({
      sourceEntity: graphState.sourceEntity,
      targetEntity: graphState.targetEntity,
      rankedRoutes: request.rankedRoutes,
      routeWindow: {
        startIndex: graphState.routeWindow.startIndex,
        visibleCount: graphState.routeWindow.visibleCount,
        maxVisibleCount: graphState.routeWindow.maxVisibleCount
      },
      selectedRouteId: graphState.selectedRouteId,
      focusedKeyword: graphState.focusedKeyword,
      layoutState: graphState.layoutState
    });
    const cy = deps.mapTraversalGraphViewModelToCy({
      graph: graphViewModel
    });

    await deps.openGraphSurface({
      ctx,
      graphState,
      renderMessage: {
        type: "renderGraph",
        graphViewModel,
        cyElements: cy.elements
      }
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

export function buildTraversalGraphWebviewHtml(args: {
  panelTitle: string;
  renderMessage: TraversalGraphUiModelMessage;
}): string {
  const escapedTitle = escapeHtml(args.panelTitle);
  const serializedMessage = JSON.stringify(JSON.stringify(args.renderMessage));

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapedTitle}</title>
  <style>
    :root {
      color-scheme: light;
      font-family: Consolas, "Courier New", monospace;
      background: #f7f5ef;
      color: #1f2328;
    }
    body {
      margin: 0;
      padding: 16px;
      background:
        radial-gradient(circle at top left, rgba(190, 214, 199, 0.35), transparent 35%),
        linear-gradient(180deg, #f8f7f1 0%, #f2eee3 100%);
    }
    .shell {
      max-width: 960px;
      margin: 0 auto;
      display: grid;
      gap: 12px;
    }
    .panel {
      border: 1px solid rgba(31, 35, 40, 0.15);
      border-radius: 12px;
      background: rgba(255, 255, 255, 0.84);
      box-shadow: 0 10px 24px rgba(31, 35, 40, 0.08);
      padding: 14px 16px;
    }
    h1, h2, p {
      margin: 0;
    }
    .meta {
      display: grid;
      gap: 6px;
      font-size: 12px;
      color: #57606a;
    }
    .counts {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .count {
      padding: 10px 12px;
      border-radius: 10px;
      background: #f1ede2;
    }
    pre {
      margin: 0;
      max-height: 340px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.45;
      white-space: pre-wrap;
      word-break: break-word;
    }
  </style>
</head>
<body>
  <div class="shell">
    <section class="panel">
      <h1>${escapedTitle}</h1>
      <div id="graph-meta" class="meta"></div>
    </section>
    <section class="panel counts" id="graph-counts"></section>
    <section class="panel">
      <h2>Hydration Payload</h2>
      <pre id="graph-payload"></pre>
    </section>
  </div>
  <script>
    const renderMessage = JSON.parse(${serializedMessage});
    const graph = renderMessage.graphViewModel;
    const meta = document.getElementById("graph-meta");
    const counts = document.getElementById("graph-counts");
    const payload = document.getElementById("graph-payload");

    meta.textContent = graph.sourceEntity + " -> " + graph.targetEntity + " | selected: " + (graph.selectedRouteId || "none");
    counts.innerHTML = [
      ["Visible routes", String(graph.routes.length)],
      ["Nodes", String(graph.nodes.length)],
      ["Cy elements", String(renderMessage.cyElements.length)]
    ].map(([label, value]) => '<div class="count"><strong>' + label + '</strong><div>' + value + '</div></div>').join("");
    payload.textContent = JSON.stringify(renderMessage, null, 2);
  </script>
</body>
</html>`;
}

function createDefaultOpenTraversalGraphViewDeps(): OpenTraversalGraphViewDeps {
  return {
    buildInitialGraphState: buildInitialTraversalGraphState,
    buildGraphViewModel: buildTraversalGraphViewModel,
    mapTraversalGraphViewModelToCy,
    openGraphSurface: openTraversalGraphSurface,
    showInfoMessage: (message) => vscode.window.showInformationMessage(message)
  };
}

async function openTraversalGraphSurface(args: {
  ctx: CommandContext;
  graphState: TraversalGraphState;
  renderMessage: TraversalGraphUiModelMessage;
}): Promise<void> {
  const panel = getOrCreateTraversalGraphPanel();
  panel.title = `${TRAVERSAL_GRAPH_PANEL_TITLE}: ${args.graphState.sourceEntity} -> ${args.graphState.targetEntity}`;
  panel.webview.html = buildTraversalGraphWebviewHtml({
    panelTitle: TRAVERSAL_GRAPH_PANEL_TITLE,
    renderMessage: args.renderMessage
  });
  panel.reveal(vscode.ViewColumn.Beside);
}

function getOrCreateTraversalGraphPanel(): vscode.WebviewPanel {
  if (currentTraversalGraphPanel) {
    return currentTraversalGraphPanel;
  }

  currentTraversalGraphPanel = vscode.window.createWebviewPanel(
    TRAVERSAL_GRAPH_PANEL_VIEW_TYPE,
    TRAVERSAL_GRAPH_PANEL_TITLE,
    vscode.ViewColumn.Beside,
    {
      enableScripts: true
    }
  );

  currentTraversalGraphPanel.onDidDispose(() => {
    currentTraversalGraphPanel = undefined;
  });

  return currentTraversalGraphPanel;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}
