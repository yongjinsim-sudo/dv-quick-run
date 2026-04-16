import type { TraversalGraphUiModelMessage } from "../commands/router/actions/traversal/graph/openTraversalGraphViewAction.js";

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";

  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return value;
}

export function getTraversalGraphHtml(args: {
  panelTitle: string;
  initialRenderMessage: TraversalGraphUiModelMessage;
}): string {
  const script = getTraversalGraphScript(args.initialRenderMessage);
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src https: data:; script-src 'nonce-${nonce}'; style-src 'unsafe-inline'; font-src https: data:;" />
  <title>${args.panelTitle}</title>
  <style>
${TRAVERSAL_GRAPH_STYLES}
  </style>
</head>
<body>
  <div class="graph-shell">
    <header class="toolbar">
      <div>
        <div class="eyebrow">Guided Traversal</div>
        <h1>${args.panelTitle}</h1>
      </div>
      <div class="toolbar-actions">
        <button id="closeGraphBtn" type="button">Close</button>
      </div>
    </header>

    <section class="status-row">
      <div id="rangeBadge" class="badge"></div>
      <div id="selectionBadge" class="badge"></div>
      <div id="metaSummary" class="meta-summary"></div>
    </section>

    <section class="content-grid">
      <div class="graph-column card">
        <div class="section-header">
          <h2>Graph view</h2>
          <span id="countsText" class="muted"></span>
        </div>
        <div class="route-strip"><div id="routeChips" class="route-chips"></div><button id="fetchMoreBtn" class="fetch-more-btn" type="button" hidden>Fetch more</button></div>
        <div id="graphCanvas" class="graph-canvas"></div>
      </div>

      <aside class="side-panel card">
        <div class="section-header">
          <h2>Selected route</h2>
        </div>
        <div id="sidePanelEmpty" class="empty-state" hidden>No route selected.</div>
        <div id="sidePanelContent" hidden>
          <h3 id="routeTitle"></h3>
          <p id="routeSubtitle" class="muted"></p>
          <dl class="metrics">
            <div><dt>Rank</dt><dd id="routeRank"></dd></div>
            <div><dt>Hops</dt><dd id="routeHops"></dd></div>
            <div><dt>Confidence</dt><dd id="routeConfidence"></dd></div>
          </dl>
          <div class="reason-section">
            <h4>Why this route</h4>
            <ul id="positiveReasons"></ul>
          </div>
          <div class="reason-section">
            <h4>Warnings</h4>
            <ul id="warningReasons"></ul>
          </div>
          <div class="reason-section">
            <h4>Variants</h4>
            <div id="variantList" class="variant-list"></div>
          </div>
          <button id="useRouteBtn" type="button">Use this route</button>
        </div>
      </aside>
    </section>
  </div>

  <script nonce="${nonce}">
${script}
  </script>
</body>
</html>`;
}

const TRAVERSAL_GRAPH_STYLES = `
:root {
  color-scheme: var(--vscode-color-scheme, dark);
  --bg: var(--vscode-editor-background);
  --surface: var(--vscode-editorWidget-background, var(--vscode-editor-background));
  --surface-alt: color-mix(in srgb, var(--vscode-editor-background) 92%, var(--vscode-editor-foreground) 8%);
  --border: var(--vscode-panel-border, rgba(128, 128, 128, 0.35));
  --text: var(--vscode-editor-foreground);
  --muted: var(--vscode-descriptionForeground, var(--vscode-editor-foreground));
  --accent: var(--vscode-button-background, #0e639c);
  --accent-foreground: var(--vscode-button-foreground, #ffffff);
  --accent-soft: color-mix(in srgb, var(--accent) 16%, transparent);
  --best: var(--vscode-testing-iconPassed, #388a34);
  --warning: var(--vscode-testing-iconQueued, #cca700);
  --blocked: var(--vscode-errorForeground, #f14c4c);
}
body {
  margin: 0;
  padding: 18px;
  background: var(--bg);
  color: var(--text);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.graph-shell {
  max-width: 1400px;
  margin: 0 auto;
  display: grid;
  gap: 12px;
}
.toolbar, .card, .status-row {
  border: 1px solid var(--border);
  border-radius: 14px;
  background: var(--surface);
  box-shadow: none;
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
}
.toolbar h1 {
  margin: 4px 0 0;
  font-size: 20px;
}
.eyebrow {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: var(--muted);
}
.toolbar-actions button, #useRouteBtn, .route-chip {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--vscode-button-secondaryBackground, var(--surface-alt));
  color: var(--vscode-button-secondaryForeground, var(--text));
}
.toolbar-actions button, #useRouteBtn {
  padding: 8px 12px;
  cursor: pointer;
}
#useRouteBtn {
  margin-top: 14px;
}
.status-row {
  display: flex;
  gap: 10px;
  align-items: center;
  padding: 10px 14px;
}
.badge {
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 12px;
  font-weight: 600;
}
.meta-summary {
  margin-left: auto;
  font-size: 12px;
  color: var(--muted);
}
.content-grid {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(320px, 1fr);
  gap: 12px;
}
.card {
  padding: 14px 16px;
}
.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}
.section-header h2, .reason-section h4 {
  margin: 0;
}
.muted { color: var(--muted); }
.route-strip {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.route-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  flex: 1;
}
.fetch-more-btn {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--vscode-button-secondaryBackground, var(--surface-alt));
  color: var(--vscode-button-secondaryForeground, var(--text));
  padding: 8px 12px;
  cursor: pointer;
  white-space: nowrap;
}
.route-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
}
.route-chip.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.route-chip.best {
  border-color: rgba(26, 127, 55, 0.3);
}

.graph-canvas {
  min-height: 460px;
  border-radius: 12px;
  border: 1px solid rgba(31,35,40,0.08);
  background: var(--surface);
  overflow: hidden;
  position: relative;
}
.graph-svg {
  width: 100%;
  height: 100%;
  min-height: 460px;
}
.edge-group { cursor: pointer; }
.edge-line {
  stroke: #3aa0ff;   
  stroke-width: 2;
}
.edge-group.best-route .edge-line {
  stroke: #3aa0ff;
  stroke-width: 2.5;
}
.edge-group.selected-route .edge-line {
  stroke: #60a5fa; 
  stroke-width: 3;
}
.edge-group.focused .edge-line { stroke: #7c4dff; stroke-width: 3; }
.edge-group.loop-warning .edge-line {
  stroke: #3aa0ff;
}
.edge-group.blocked .edge-line { stroke: var(--blocked); stroke-dasharray: 7 5; }
.edge-group.dimmed .edge-line {
  opacity: 0.22;
}
.edge-label {
  font-size: 11px;
  fill: var(--muted);
  user-select: none;
}
.node-group { cursor: grab; }
.node-group:active { cursor: grabbing; }
.node-group:hover .node-shape {
  stroke: var(--vscode-focusBorder);
  stroke-width: 2;
}
.node-shape {
  fill: #1f2a33;        
  stroke: #3aa0ff;      
  stroke-width: 2;
  rx: 14;
  ry: 14;
  filter: drop-shadow(0 3px 10px rgba(0, 0, 0, 0.45));
}
.node-group.role-source .node-shape,
.node-group.role-target .node-shape {
  stroke-width: 2.5;
}
.node-group.best-route .node-shape {
  stroke: #3aa0ff;
  stroke-width: 2.5;
}
.node-group.selected-route .node-shape {
  stroke: #60a5fa;      
  stroke-width: 3;
  fill: #1e3a5f;       
}
.node-group.focused .node-shape {
  stroke: #7c4dff;
  stroke-width: 2.5;
}
.node-group.loop-warning .node-shape { 
  stroke: #3aa0ff; 
}
.node-group.system-heavy .node-shape {
  fill: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--warning) 18%);
  stroke: color-mix(in srgb, var(--warning) 55%, white 45%);
}
.node-group.dimmed {
  opacity: 0.62;
}
.node-group.dimmed .node-label {
  fill: var(--muted);
}
.node-label {
  font-size: 12px;
  font-weight: 600;
  fill: color-mix(in srgb, var(--text) 88%, white 12%);
  text-anchor: middle;
  dominant-baseline: central;
  pointer-events: none;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 12px 0 14px;
}
.metrics div {
  padding: 10px;
  border-radius: 12px;
  background: rgba(9,105,218,0.06);
}
.metrics dt {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--muted);
}
.metrics dd {
  margin: 4px 0 0;
  font-weight: 700;
}
.reason-section ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.reason-section li {
  margin-bottom: 6px;
}
.variant-list {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.variant-btn {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--vscode-button-secondaryBackground, var(--surface-alt));
  color: var(--vscode-button-secondaryForeground, var(--text));
  cursor: pointer;
}
.variant-btn.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.variant-title {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  font-weight: 600;
}
.variant-subtitle {
  margin-top: 4px;
  color: var(--muted);
  font-size: 11px;
}
.empty-state {
  color: var(--muted);
  padding: 12px 0;
}
`;

function getTraversalGraphScript(initialRenderMessage: TraversalGraphUiModelMessage): string {
  const initialRenderMessageJson = JSON.stringify(initialRenderMessage);
  return `
const vscode = acquireVsCodeApi();
const initialRenderMessage = ${initialRenderMessageJson};

const state = {
  renderMessage: initialRenderMessage,
  localNodePositions: {},
  dragState: null,
  suppressNextNodeClick: false
};

const graphCanvas = document.getElementById("graphCanvas");
const routeChips = document.getElementById("routeChips");
const fetchMoreBtn = document.getElementById("fetchMoreBtn");
const rangeBadge = document.getElementById("rangeBadge");
const selectionBadge = document.getElementById("selectionBadge");
const metaSummary = document.getElementById("metaSummary");
const countsText = document.getElementById("countsText");
const sidePanelEmpty = document.getElementById("sidePanelEmpty");
const sidePanelContent = document.getElementById("sidePanelContent");
const routeTitle = document.getElementById("routeTitle");
const routeSubtitle = document.getElementById("routeSubtitle");
const routeRank = document.getElementById("routeRank");
const routeHops = document.getElementById("routeHops");
const routeConfidence = document.getElementById("routeConfidence");
const positiveReasons = document.getElementById("positiveReasons");
const warningReasons = document.getElementById("warningReasons");
const variantList = document.getElementById("variantList");
const useRouteBtn = document.getElementById("useRouteBtn");
const closeGraphBtn = document.getElementById("closeGraphBtn");

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || message.type !== "renderGraph") {
    return;
  }

  state.renderMessage = message;
  state.localNodePositions = Object.fromEntries(
    (message.graphViewModel?.nodes || [])
      .filter((node) => node.layout && typeof node.layout.x === 'number' && typeof node.layout.y === 'number')
      .map((node) => [node.id, { x: node.layout.x, y: node.layout.y }])
  );
  renderGraphSurface();
});

closeGraphBtn?.addEventListener("click", () => {
  vscode.postMessage({ type: "closeRequested" });
});

useRouteBtn?.addEventListener("click", () => {
  const routeId = state.renderMessage?.graphViewModel?.sidePanel?.action?.routeId;
  if (!routeId) {
    return;
  }

  vscode.postMessage({ type: "useRouteRequested", routeId });
});

fetchMoreBtn?.addEventListener("click", () => {
  vscode.postMessage({ type: "showMoreRequested" });
});

function renderGraphSurface() {
  const renderMessage = state.renderMessage;
  const graph = renderMessage.graphViewModel;
  const cyElements = renderMessage.cyElements;

  renderHeader(graph, cyElements);
  renderRouteChips(graph);
  renderSvgGraph(graph, cyElements);
  renderSidePanel(graph);
}

function renderHeader(graph, cyElements) {
  const startOrdinal = graph.routeWindow.totalRoutes > 0 ? graph.routeWindow.startIndex + 1 : 0;
  const endOrdinal = Math.min(graph.routeWindow.startIndex + graph.routeWindow.visibleCount, graph.routeWindow.totalRoutes);
  rangeBadge.textContent = 'Showing paths ' + startOrdinal + '–' + endOrdinal;
  const selectedVariant = graph.sidePanel?.variants?.find((item) => item.isSelected);
  const selectedBadgeText = selectedVariant?.subtitle || graph.selectedRouteId;
  selectionBadge.textContent = selectedBadgeText ? 'Selected: ' + selectedBadgeText : 'Selected: none';
  metaSummary.textContent = graph.sourceEntity + ' → ' + graph.targetEntity;
  const selectedContext = getSelectedRouteContext(graph, state.renderMessage?.cyElements || []);
  const visibleNodeCount = selectedContext.selectedRoute ? selectedContext.selectedNodeIds.size : graph.nodes.length;
  const visibleEdgeCount = selectedContext.selectedRoute ? selectedContext.selectedEdgeIds.size : graph.edges.length;
  countsText.textContent = visibleNodeCount + ' nodes • ' + visibleEdgeCount + ' edges • ' + graph.routeGroups.length + ' grouped paths';
}

function renderRouteChips(graph) {
  routeChips.innerHTML = '';

  for (const group of graph.routeGroups || []) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'route-chip' + (group.isSelected ? ' selected' : '') + (group.isBestMatch ? ' best' : '');
    const suffix = group.variantCount > 1 ? ' (' + group.variantCount + ' variants)' : '';
    button.innerHTML = '<span>' + escapeHtml(group.label + suffix) + '</span>';
    button.addEventListener('click', () => {
      vscode.postMessage({ type: 'routeClicked', routeId: group.selectedVariantRouteId || group.bestVariantRouteId });
    });
    routeChips.appendChild(button);
  }

  const canFetchMore = !!graph.controls?.canExpandToMax;
  fetchMoreBtn.hidden = !canFetchMore;
  fetchMoreBtn.disabled = !canFetchMore;
}

function getSelectedRouteContext(graph, cyElements) {
  const selectedRouteId = graph?.selectedRouteId;
  const selectedRoute = graph?.routes?.find(
    (route) => route.routeId === selectedRouteId
  );

  const selectedEdgeIds = new Set(selectedRoute?.edgeIds || []);
  const selectedNodeIds = new Set();

  for (const item of cyElements || []) {
    if (item.group !== 'edges') {
      continue;
    }

    const edgeId = item?.data?.id;
    if (!selectedEdgeIds.has(edgeId)) {
      continue;
    }

    if (item?.data?.source) {
      selectedNodeIds.add(item.data.source);
    }
    if (item?.data?.target) {
      selectedNodeIds.add(item.data.target);
    }
  }

  for (const entityId of selectedRoute?.entities || []) {
    selectedNodeIds.add(entityId);
  }

  return {
    selectedRoute,
    selectedEdgeIds,
    selectedNodeIds
  };
}

function renderSvgGraph(graph, cyElements) {
  const allNodes = cyElements.filter((item) => item.group === 'nodes');
  const allEdges = cyElements.filter((item) => item.group === 'edges');
  const selectedContext = getSelectedRouteContext(graph, cyElements);
  const nodes = selectedContext.selectedRoute
    ? allNodes.filter((node) => selectedContext.selectedNodeIds.has(node.data.id))
    : allNodes;
  const edges = selectedContext.selectedRoute
    ? allEdges.filter((edge) => selectedContext.selectedEdgeIds.has(edge.data.id))
    : allEdges;
  const layoutGraph = {
    ...graph,
    nodes: (graph.nodes || []).filter((node) => !selectedContext.selectedRoute || selectedContext.selectedNodeIds.has(node.id)),
    routeGroups: selectedContext.selectedRoute
      ? (graph.routeGroups || []).filter((group) => group.bestVariantRouteId === selectedContext.selectedRoute.routeId || group.selectedVariantRouteId === selectedContext.selectedRoute.routeId || (group.variants || []).some((variant) => variant.routeId === selectedContext.selectedRoute.routeId))
      : graph.routeGroups,
    routes: selectedContext.selectedRoute ? [selectedContext.selectedRoute] : graph.routes
  };
  const layout = buildLayoutPositions(layoutGraph, state.localNodePositions);
  const positions = layout.positions;
  const width = 920;
  const height = layout.height;

  const edgeMarkup = edges.map((edge) => buildEdgeMarkup(edge, positions, selectedContext)).join('');
  const nodeMarkup = nodes.map((node) => buildNodeMarkup(node, positions, selectedContext)).join('');

  graphCanvas.innerHTML =
    '<svg class="graph-svg" viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="Guided traversal graph">'
    + edgeMarkup
    + nodeMarkup
    + '</svg>';

  for (const edgeElement of graphCanvas.querySelectorAll('[data-edge-id]')) {
    edgeElement.addEventListener('click', () => {
      try {
        const routeIds = JSON.parse(edgeElement.getAttribute('data-route-ids') || '[]');
        vscode.postMessage({
          type: 'edgeClicked',
          edgeId: edgeElement.getAttribute('data-edge-id'),
          routeIds
        });
      } catch {
        // ignore malformed payload
      }
    });
  }

  for (const nodeElement of graphCanvas.querySelectorAll('[data-node-id]')) {
    const nodeId = nodeElement.getAttribute('data-node-id');
    if (!nodeId) {
      continue;
    }

    nodeElement.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();

      if (state.suppressNextNodeClick) {
        state.suppressNextNodeClick = false;
        return;
      }

      const routeId = resolveRouteIdForNodeClick(graph, nodeId);
      if (routeId) {
        vscode.postMessage({ type: 'routeClicked', routeId });
      }
    });

    nodeElement.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      event.stopPropagation();
      beginNodeDrag(event, graph, nodeId);
    });
  }
}

function buildLayoutPositions(graph, localNodePositions = {}) {
  const visibleGroups = Array.isArray(graph.routeGroups) && graph.routeGroups.length > 0
    ? graph.routeGroups
    : (graph.routes || []).map((route) => ({ entities: route.entities }));
  const maxColumn = Math.max(1, ...visibleGroups.map((group) => Math.max(0, (group.entities?.length || 1) - 1)));
  const leftPadding = 120;
  const rightPadding = 800;
  const topPadding = 120;
  const bottomPadding = 110;
  const rowSpacing = 112;
  const positions = {};
  const preferredColumns = new Map();
  const nodesById = new Map((graph.nodes || []).map((node) => [node.id, node]));

  for (const node of graph.nodes) {
    const localPosition = localNodePositions[node.id];
    if (localPosition && typeof localPosition.x === 'number' && typeof localPosition.y === 'number') {
      positions[node.id] = { x: localPosition.x, y: localPosition.y };
      continue;
    }
    if (node.layout && typeof node.layout.x === 'number' && typeof node.layout.y === 'number') {
      positions[node.id] = { x: node.layout.x, y: node.layout.y };
      continue;
    }

    const occurrences = [];
    for (const group of visibleGroups) {
      const entities = Array.isArray(group.entities) ? group.entities : [];
      entities.forEach((entity, entityIndex) => {
        if (entity === node.id) {
          occurrences.push(entityIndex);
        }
      });
    }

    let column = 0;
    if (node.role === 'source') {
      column = 0;
    } else if (node.role === 'target') {
      column = maxColumn;
    } else if (occurrences.length > 0) {
      const averageIndex = occurrences.reduce((sum, value) => sum + value, 0) / occurrences.length;
      column = Math.max(1, Math.min(maxColumn - 1, Math.round(averageIndex)));
    } else {
      column = Math.max(1, Math.floor(maxColumn / 2));
    }

    preferredColumns.set(node.id, column);
  }

  const buckets = new Map();
  for (const node of graph.nodes) {
    if (positions[node.id]) {
      continue;
    }
    const column = preferredColumns.get(node.id) ?? 0;
    const bucket = buckets.get(column) || [];
    bucket.push(node);
    buckets.set(column, bucket);
  }

  let maxBucketSize = 1;
  for (const bucket of buckets.values()) {
    maxBucketSize = Math.max(maxBucketSize, bucket.length);
    bucket.sort((left, right) => {
      const leftPriority = nodePriority(left);
      const rightPriority = nodePriority(right);
      if (leftPriority !== rightPriority) {
        return leftPriority - rightPriority;
      }
      const rightCount = right.metrics?.visibleRouteCount || 0;
      const leftCount = left.metrics?.visibleRouteCount || 0;
      if (rightCount !== leftCount) {
        return rightCount - leftCount;
      }
      return String(left.label || left.id).localeCompare(String(right.label || right.id));
    });
  }

  const height = Math.max(520, topPadding + bottomPadding + ((maxBucketSize - 1) * rowSpacing));
  const usableHeight = height - topPadding - bottomPadding;

  for (const [column, bucket] of buckets.entries()) {
    const x = leftPadding + ((Number(column) / Math.max(1, maxColumn)) * (rightPadding - leftPadding));
    const groupHeight = (bucket.length - 1) * rowSpacing;
    const startY = topPadding + Math.max(0, (usableHeight - groupHeight) / 2);
    bucket.forEach((node, index) => {
      positions[node.id] = {
        x,
        y: startY + (index * rowSpacing)
      };
    });
  }

  return { positions, height };
}

function nodePriority(node) {
  if (node.styling?.isOnSelectedRoute) {
    return 0;
  }
  if (node.styling?.isOnBestRoute) {
    return 1;
  }
  if (node.role === 'source') {
    return -1;
  }
  if (node.role === 'target') {
    return 2;
  }
  return 3;
}

function buildEdgeMarkup(edge, positions, selectedContext) {
  const source = positions[edge.data.source];
  const target = positions[edge.data.target];
  if (!source || !target) {
    return '';
  }

  const routeIds = edge.data.routeIds || [];
  const isSelectedEdge = selectedContext.selectedEdgeIds.has(edge.data.id);

  const midX = (source.x + target.x) / 2;
  const midY = (source.y + target.y) / 2 - 10;

  const preservedClasses = (edge.data.classes || []).filter(
    (className) => className !== 'selected-route' && className !== 'best-route' && className !== 'dimmed'
  );

  const classes = [
    'edge-group',
    ...preservedClasses,
    isSelectedEdge ? 'selected-route' : 'dimmed'
  ].join(' ');

  return '<g class="' + classes + '" data-edge-id="' + escapeHtml(edge.data.id) + '" data-route-ids="' + escapeHtml(JSON.stringify(routeIds)) + '">'
    + '<line class="edge-line" x1="' + source.x + '" y1="' + source.y + '" x2="' + target.x + '" y2="' + target.y + '"></line>'
    + (isSelectedEdge
      ? '<text class="edge-label" x="' + midX + '" y="' + midY + '">' + escapeHtml(edge.data.label || '') + '</text>'
      : '')
    + '</g>';
}

function buildNodeMarkup(node, positions, selectedContext) {
  const position = positions[node.data.id];
  if (!position) {
    return '';
  }

  const isSelectedNode = selectedContext.selectedNodeIds.has(node.data.id);

  const width = 132;
  const height = 42;
  const x = position.x - (width / 2);
  const y = position.y - (height / 2);

  const preservedClasses = (node.data.classes || []).filter(
    (className) => className !== 'selected-route' && className !== 'best-route' && className !== 'dimmed'
  );

  const classes = [
    'node-group',
    ...preservedClasses,
    isSelectedNode ? 'selected-route' : 'dimmed'
  ].join(' ');

  return '<g class="' + classes + '" data-node-id="' + escapeHtml(node.data.id) + '">'
    + '<rect class="node-shape" x="' + x + '" y="' + y + '" width="' + width + '" height="' + height + '"></rect>'
    + '<text class="node-label" x="' + position.x + '" y="' + position.y + '">' + escapeHtml(node.data.label || node.data.id) + '</text>'
    + '</g>';
}


function resolveRouteIdForNodeClick(graph, nodeId) {
  const matchingGroups = (graph.routeGroups || []).filter((group) => Array.isArray(group.entities) && group.entities.includes(nodeId));
  if (matchingGroups.length === 0) {
    return undefined;
  }

  const sortedGroups = [...matchingGroups].sort((left, right) => {
    const leftSelected = left.isSelected ? 1 : 0;
    const rightSelected = right.isSelected ? 1 : 0;
    if (leftSelected !== rightSelected) {
      return rightSelected - leftSelected;
    }

    const leftHops = Math.max(0, (left.entities?.length || 1) - 1);
    const rightHops = Math.max(0, (right.entities?.length || 1) - 1);
    if (leftHops !== rightHops) {
      return leftHops - rightHops;
    }

    if (left.rank !== right.rank) {
      return left.rank - right.rank;
    }

    return String(left.label || left.groupId).localeCompare(String(right.label || right.groupId));
  });

  const bestGroup = sortedGroups[0];
  return bestGroup.selectedVariantRouteId || bestGroup.bestVariantRouteId;
}

function beginNodeDrag(event, graph, nodeId) {
  const layout = buildLayoutPositions(graph, state.localNodePositions);
  const startPosition = layout.positions[nodeId];
  if (!startPosition) {
    return;
  }

  const svg = graphCanvas.querySelector('.graph-svg');
  if (!svg) {
    return;
  }

  const viewBox = svg.viewBox.baseVal;
  const rect = svg.getBoundingClientRect();
  const scaleX = rect.width > 0 ? viewBox.width / rect.width : 1;
  const scaleY = rect.height > 0 ? viewBox.height / rect.height : 1;

  state.dragState = {
    draggedNodeId: nodeId,
    pointerId: event.pointerId,
    startClientX: event.clientX,
    startClientY: event.clientY,
    originX: startPosition.x,
    originY: startPosition.y,
    scaleX,
    scaleY,
    moved: false
  };

  if (svg.setPointerCapture) {
    try { svg.setPointerCapture(event.pointerId); } catch {}
  }
}

function handleGlobalPointerMove(event) {
  const dragState = state.dragState;
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  const deltaX = (event.clientX - dragState.startClientX) * dragState.scaleX;
  const deltaY = (event.clientY - dragState.startClientY) * dragState.scaleY;
  const nextPosition = {
    x: dragState.originX + deltaX,
    y: dragState.originY + deltaY
  };

  state.localNodePositions[dragState.draggedNodeId] = nextPosition;
  dragState.moved = dragState.moved || Math.abs(deltaX) > 3 || Math.abs(deltaY) > 3;
  renderGraphSurface();
}

function handleGlobalPointerUp(event) {
  const dragState = state.dragState;
  if (!dragState || dragState.pointerId !== event.pointerId) {
    return;
  }

  state.dragState = null;
  state.suppressNextNodeClick = !!dragState.moved;

  if (dragState.moved) {
    vscode.postMessage({
      type: 'nodePositionsChanged',
      positionsByNodeId: state.localNodePositions
    });
  }
}

window.addEventListener('pointermove', handleGlobalPointerMove);
window.addEventListener('pointerup', handleGlobalPointerUp);
window.addEventListener('pointercancel', handleGlobalPointerUp);

function renderSidePanel(graph) {
  const panel = graph.sidePanel;
  const hasSelection = !!panel.selectedRouteId;
  sidePanelEmpty.hidden = hasSelection;
  sidePanelContent.hidden = !hasSelection;

  if (!hasSelection) {
    positiveReasons.innerHTML = '';
    warningReasons.innerHTML = '';
    useRouteBtn.disabled = true;
    return;
  }

  routeTitle.textContent = panel.title || panel.selectedRouteId || 'Selected route';
  routeSubtitle.textContent = panel.subtitle || '';
  routeRank.textContent = panel.rank ? '#' + panel.rank : '—';
  routeHops.textContent = typeof panel.hopCount === 'number' ? String(panel.hopCount) : '—';
  routeConfidence.textContent = panel.confidence || '—';
  positiveReasons.innerHTML = renderReasonList(panel.positiveReasons, 'No explicit positive reasons yet.');
  warningReasons.innerHTML = renderReasonList(panel.warningReasons, 'No warnings.');
  renderVariants(panel.variants || []);
  useRouteBtn.disabled = panel.action.enabled !== true || !panel.action.routeId;
}

function renderVariants(variants) {
  variantList.innerHTML = '';

  if (!variants || variants.length <= 1) {
    variantList.innerHTML = '<div class="muted">No alternative variants.</div>';
    return;
  }

  for (const variant of variants) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'variant-btn' + (variant.isSelected ? ' selected' : '');
    button.innerHTML = '<div class="variant-title"><span>' + escapeHtml(variant.subtitle || variant.label || variant.routeId) + '</span><span>' + escapeHtml(variant.confidence || '') + '</span></div>';
        button.addEventListener('click', () => {
      vscode.postMessage({ type: 'routeClicked', routeId: variant.routeId });
    });
    variantList.appendChild(button);
  }
}

function renderReasonList(items, fallbackText) {
  if (!items || items.length === 0) {
    return '<li>' + escapeHtml(fallbackText) + '</li>';
  }

  return items.map((item) => '<li>' + escapeHtml(item) + '</li>').join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

try {
  renderGraphSurface();
} catch (error) {
  console.error('DV Quick Run graph initial render failed.', error);
}

queueMicrotask(() => {
  vscode.postMessage({ type: 'graphReady' });
});
`;
}
