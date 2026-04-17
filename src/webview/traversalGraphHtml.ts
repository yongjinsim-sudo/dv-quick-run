import * as fs from "fs";

import type { TraversalGraphUiModelMessage } from "../commands/router/actions/traversal/graph/openTraversalGraphViewAction.js";

function getNonce(): string {
  const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";

  for (let index = 0; index < 32; index += 1) {
    value += possible.charAt(Math.floor(Math.random() * possible.length));
  }

  return value;
}

function getCytoscapeScript(): string {
  const resolvedMainPath = require.resolve("cytoscape");
  const preferredPath = resolvedMainPath.replace(
    /cytoscape\.cjs\.js$/,
    "cytoscape.min.js"
  );

  if (fs.existsSync(preferredPath)) {
    return fs.readFileSync(preferredPath, "utf8");
  }

  return fs.readFileSync(resolvedMainPath, "utf8");
}

export function getTraversalGraphHtml(args: {
  panelTitle: string;
  initialRenderMessage: TraversalGraphUiModelMessage;
}): string {
  const nonce = getNonce();
  const script = getTraversalGraphScript(args.initialRenderMessage);
  const cytoscapeScript = getCytoscapeScript();

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
    <header class="toolbar card">
      <div>
        <div class="eyebrow">Guided Traversal</div>
        <h1>${args.panelTitle}</h1>
      </div>
      <div class="toolbar-actions">
        <input id="focusInput" type="text" placeholder="Focus by table" />
        <button id="resetLayoutBtn" type="button">Reset layout</button>
        <button id="closeGraphBtn" type="button">Close</button>
      </div>
    </header>

    <section class="status-row card">
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
        <div class="route-strip">
          <div id="routeChips" class="route-chips"></div>
        </div>
        <div class="graph-controls">
          <button id="showMoreBtn" type="button">Show more</button>
          <button id="previousWindowBtn" type="button">Previous</button>
          <button id="nextWindowBtn" type="button">Next</button>
        </div>
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
            <h4>Confidence explained</h4>
            <ul id="confidenceExplanation"></ul>
          </div>
          <div class="reason-section">
            <h4>Why this route</h4>
            <ul id="positiveReasons"></ul>
          </div>
          <div class="reason-section">
            <h4>Why this over others</h4>
            <ul id="comparisonReasons"></ul>
          </div>
          <div class="reason-section">
            <h4>Warnings</h4>
            <ul id="warningReasons"></ul>
          </div>
          <div class="reason-section">
            <h4>Variants</h4>
            <div id="variantsFamily" class="muted variant-family"></div>
            <div id="variantList" class="variant-list"></div>
          </div>
          <button id="useRouteBtn" type="button">Use this route</button>
        </div>
      </aside>
    </section>
  </div>

  <script nonce="${nonce}">
${cytoscapeScript}
  </script>
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
}
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  gap: 12px;
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
.toolbar-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.toolbar-actions input {
  min-width: 180px;
  padding: 8px 10px;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-alt);
  color: var(--text);
}
button, #useRouteBtn, .route-chip, .variant-chip {
  border: 1px solid var(--border);
  border-radius: 10px;
  background: var(--vscode-button-secondaryBackground, var(--surface-alt));
  color: var(--vscode-button-secondaryForeground, var(--text));
}
button, #useRouteBtn {
  padding: 8px 12px;
  cursor: pointer;
}
button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
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
.route-chips, .variant-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.variant-list {
  flex-direction: column;
  align-items: stretch;
}
.variant-group {
  display: grid;
  gap: 8px;
  margin-top: 8px;
}
.variant-group-header {
  font-size: 12px;
  font-weight: 600;
  color: var(--muted);
}
.variant-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: flex-start;
  width: fit-content;
  padding: 6px 10px;
  font-size: 12px;
}
.variant-chip {
  justify-content: space-between;
  align-items: flex-start;
  text-align: left;
}
.variant-main {
  display: grid;
  gap: 4px;
  min-width: 0;
  flex: 1;
}
.variant-key {
  word-break: break-word;
}
.variant-meta {
  font-size: 12px;
  color: var(--muted);
  white-space: nowrap;
}
.confidence-pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.confidence-dot {
  width: 8px;
  height: 8px;
  border-radius: 999px;
  display: inline-block;
  flex: 0 0 auto;
}
.confidence-high { background: #22c55e; }
.confidence-medium { background: #f59e0b; }
.confidence-low { background: #ef4444; }
.graph-controls {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}
.route-chip, .variant-chip {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  font-size: 12px;
  cursor: pointer;
}
.route-chip.selected, .variant-chip.selected {
  border-color: var(--accent);
  background: var(--accent-soft);
}
.route-chip.best {
  border-color: rgba(26, 127, 55, 0.3);
}
.graph-canvas {
  min-height: 520px;
  border-radius: 12px;
  border: 1px solid rgba(31,35,40,0.08);
  background: var(--surface);
  overflow: hidden;
  position: relative;
}
.side-panel h3 {
  margin: 0 0 6px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 10px;
  margin: 0 0 14px;
}
.metrics dt {
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
}
.metrics dd {
  margin: 6px 0 0;
  font-weight: 600;
}
.reason-section {
  margin-top: 14px;
}
.reason-section ul {
  margin: 8px 0 0;
  padding-left: 18px;
}
.empty-state {
  padding: 20px 0;
  color: var(--muted);
}
@media (max-width: 1000px) {
  .content-grid {
    grid-template-columns: 1fr;
  }
}
`;

function getTraversalGraphScript(initialRenderMessage: TraversalGraphUiModelMessage): string {
  const serialized = JSON.stringify(initialRenderMessage)
    .replace(/</g, "\\u003c")
    .replace(/>/g, "\\u003e")
    .replace(/&/g, "\\u0026");

  return `
const vscode = acquireVsCodeApi();
let renderState = ${serialized};
let cy;
const expandedConfidenceGroups = new Set(["high"]);

const ids = [
  "rangeBadge",
  "selectionBadge",
  "metaSummary",
  "countsText",
  "routeChips",
  "showMoreBtn",
  "previousWindowBtn",
  "nextWindowBtn",
  "graphCanvas",
  "sidePanelEmpty",
  "sidePanelContent",
  "routeTitle",
  "routeSubtitle",
  "routeRank",
  "routeHops",
  "routeConfidence",
  "confidenceExplanation",
  "positiveReasons",
  "comparisonReasons",
  "warningReasons",
  "variantList",
  "variantsFamily",
  "useRouteBtn",
  "focusInput",
  "closeGraphBtn",
  "resetLayoutBtn"
];
const el = Object.fromEntries(ids.map((id) => [id, document.getElementById(id)]));

function toCyElements(message) {
  return (message.cyElements || []).map((element) => {
    const classes = Array.isArray(element?.data?.classes) ? element.data.classes.join(" ") : "";
    return {
      group: element.group,
      data: { ...element.data },
      position: element.position,
      classes
    };
  });
}

function getLayout(message) {
  const hasPresetPositions = (message.graphViewModel?.nodes || []).some((node) => node.layout && node.layout.x !== undefined && node.layout.y !== undefined);
  if (hasPresetPositions) {
    return { name: "preset", fit: true, padding: 40 };
  }
  return {
    name: "breadthfirst",
    directed: true,
    fit: true,
    padding: 56,
    spacingFactor: 2.2,
    avoidOverlap: true,
    animate: true,
    animationDuration: 250,
    roots: [message.graphViewModel?.sourceEntity].filter(Boolean)
  };
}

function bindCyEvents() {
  if (!cy) {
    return;
  }

  cy.removeAllListeners();

  cy.on("tap", "edge", (event) => {
    const data = event.target.data();
    vscode.postMessage({
      type: "edgeClicked",
      edgeId: data.id,
      routeIds: Array.isArray(data.routeIds) ? data.routeIds : []
    });
  });

  cy.on("tap", "node", (event) => {
    const nodeId = event.target.id();
    const selectedRouteId = pickRouteIdForNode(nodeId, renderState.graphViewModel);
    if (selectedRouteId) {
      vscode.postMessage({ type: "routeClicked", routeId: selectedRouteId });
    }
  });

  cy.on("dragfree", "node", () => {
    const positionsByNodeId = {};
    cy.nodes().forEach((node) => {
      const pos = node.position();
      positionsByNodeId[node.id()] = { x: pos.x, y: pos.y };
    });
    vscode.postMessage({ type: "nodePositionsChanged", positionsByNodeId });
  });
}

function pickRouteIdForNode(nodeId, graph) {
  const matchingRoutes = (graph?.routes || []).filter(
    (route) => Array.isArray(route.entities) && route.entities.includes(nodeId)
  );
  if (matchingRoutes.length === 0) {
    return undefined;
  }

  const selectedMatch = matchingRoutes.find(
    (route) => route.routeId === graph?.selectedRouteId
  );
  if (selectedMatch) {
    return selectedMatch.routeId;
  }

  if (matchingRoutes.length === 1) {
    return matchingRoutes[0]?.routeId;
  }

  return undefined;
}

function renderRouteChips(message) {
  el.routeChips.innerHTML = "";
  const groups = message.graphViewModel?.routeGroups || [];
  for (const group of groups) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "route-chip" + (group.isSelected ? " selected" : "") + (group.isBestMatch ? " best" : "");
    button.textContent = group.label + " (" + group.variantCount + ")";
    button.addEventListener("click", () => {
      const routeId = group.selectedVariantRouteId || group.bestVariantRouteId;
      vscode.postMessage({ type: "routeClicked", routeId });
    });
    el.routeChips.appendChild(button);
  }
}


function getConfidenceClass(confidence) {
  switch (confidence) {
    case "high": return "confidence-high";
    case "medium": return "confidence-medium";
    case "low": return "confidence-low";
    default: return "confidence-medium";
  }
}

function getConfidenceLabel(confidence) {
  switch (confidence) {
    case "high": return "High";
    case "medium": return "Medium";
    case "low": return "Low";
    default: return "—";
  }
}

function renderConfidenceValue(target, confidence) {
  target.innerHTML = "";
  if (!confidence) {
    target.textContent = "—";
    return;
  }
  const wrap = document.createElement("span");
  wrap.className = "confidence-pill";
  const dot = document.createElement("span");
  dot.className = "confidence-dot " + getConfidenceClass(confidence);
  const label = document.createElement("span");
  label.textContent = getConfidenceLabel(confidence);
  wrap.appendChild(dot);
  wrap.appendChild(label);
  target.appendChild(wrap);
}

function buildVariantConfidenceGroups(panel, graph) {
  const routesById = new Map((graph?.routes || []).map((route) => [route.routeId, route]));
  const groups = new Map();
  for (const variant of panel.variants || []) {
    const confidence = variant.confidence || "medium";
    const route = routesById.get(variant.routeId);
    const bucket = groups.get(confidence) || [];
    bucket.push({ variant, route });
    groups.set(confidence, bucket);
  }

  const order = { high: 0, medium: 1, low: 2 };
  const result = [];
  for (const [confidence, items] of groups.entries()) {
    items.sort((left, right) => {
      const selectedDelta = Number(right.variant.isSelected) - Number(left.variant.isSelected);
      if (selectedDelta !== 0) return selectedDelta;
      const rankDelta = left.variant.rank - right.variant.rank;
      if (rankDelta !== 0) return rankDelta;
      const leftChain = left.variant.navigationChain?.length || 0;
      const rightChain = right.variant.navigationChain?.length || 0;
      if (leftChain !== rightChain) return leftChain - rightChain;
      const leftPenalty = Number(Boolean(left.route?.semantics?.isLoopBack)) + Number(Boolean(left.route?.semantics?.isSystemHeavy));
      const rightPenalty = Number(Boolean(right.route?.semantics?.isLoopBack)) + Number(Boolean(right.route?.semantics?.isSystemHeavy));
      if (leftPenalty !== rightPenalty) return leftPenalty - rightPenalty;
      return left.variant.routeId.localeCompare(right.variant.routeId);
    });
    result.push({ confidence, items });
  }
  result.sort((a, b) => (order[a.confidence] ?? 99) - (order[b.confidence] ?? 99));
  return result;
}

function createVariantChip(variant) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "variant-chip" + (variant.isSelected ? " selected" : "");

  const main = document.createElement("div");
  main.className = "variant-main";

  const key = document.createElement("div");
  key.className = "variant-key";
  key.textContent = variant.variantKey || variant.subtitle || variant.label;
  main.appendChild(key);

  const meta = document.createElement("div");
  meta.className = "variant-meta";
  const wrap = document.createElement("span");
  wrap.className = "confidence-pill";
  const dot = document.createElement("span");
  dot.className = "confidence-dot " + getConfidenceClass(variant.confidence);
  const rank = document.createElement("span");
  rank.textContent = "#" + variant.rank;
  wrap.appendChild(dot);
  wrap.appendChild(rank);
  meta.appendChild(wrap);
  main.appendChild(meta);

  button.appendChild(main);
  button.addEventListener("click", () => {
    vscode.postMessage({ type: "routeClicked", routeId: variant.routeId });
  });
  return button;
}

function renderReasonList(target, values) {
  target.innerHTML = "";
  for (const reason of values || []) {
    const item = document.createElement("li");
    item.textContent = reason;
    target.appendChild(item);
  }
}

function renderSidePanel(message) {
  const panel = message.graphViewModel?.sidePanel;
  const hasSelection = !!panel?.selectedRouteId;
  el.sidePanelEmpty.hidden = hasSelection;
  el.sidePanelContent.hidden = !hasSelection;
  if (!hasSelection) {
    return;
  }

  el.routeTitle.textContent = panel.title || "";
  el.routeSubtitle.textContent = panel.subtitle || "";
  el.routeRank.textContent = panel.rank ? "#" + panel.rank : "—";
  el.routeHops.textContent = panel.hopCount !== undefined ? String(panel.hopCount) : "—";
  renderConfidenceValue(el.routeConfidence, panel.confidence);
  el.useRouteBtn.disabled = !panel.action?.enabled;

  renderReasonList(
    el.confidenceExplanation,
    panel.confidenceExplanation || [
      "Confidence is based on the current route ranking and path quality."
    ]
  );
  renderReasonList(el.positiveReasons, panel.positiveReasons || []);
  renderReasonList(
    el.comparisonReasons,
    panel.comparisonReasons || ["No comparison guidance is available for this route."]
  );
  renderReasonList(
    el.warningReasons,
    panel.warningReasons?.length
      ? panel.warningReasons
      : ["No warnings for this route."]
  );

  el.variantsFamily.textContent = panel.variantsTitle
    ? "Route family: " + panel.variantsTitle
    : "";
  el.variantList.innerHTML = "";

  const groupedVariants = buildVariantConfidenceGroups(panel, message.graphViewModel);
  for (const group of groupedVariants) {
    const heading = document.createElement("div");
    heading.className = "variant-group-header";
    heading.textContent = getConfidenceLabel(group.confidence) + " confidence";

    const container = document.createElement("div");
    container.className = "variant-group";
    container.appendChild(heading);

    const shouldShow = expandedConfidenceGroups.has(group.confidence);
    if (shouldShow) {
      for (const item of group.items) {
        container.appendChild(createVariantChip(item.variant));
      }
    } else {
      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "variant-toggle";
      toggle.textContent = "Show " + group.confidence + " confidence variants (" + group.items.length + ")";
      toggle.addEventListener("click", () => {
        expandedConfidenceGroups.add(group.confidence);
        renderSidePanel(renderState);
      });
      container.appendChild(toggle);
    }

    el.variantList.appendChild(container);
  }
}

function renderMeta(message) {
  const graph = message.graphViewModel;
  const range = graph?.routeWindow;
  const controls = graph?.controls || {};
  const startOrdinal = range?.visibleCount ? range.startIndex + 1 : 0;
  const endOrdinal = range?.visibleCount ? Math.min(range.startIndex + range.visibleCount, range.totalRoutes) : 0;
  el.rangeBadge.textContent = range ? "Showing routes " + startOrdinal + "–" + endOrdinal : "No routes";
  el.selectionBadge.textContent = graph?.selectedRouteId ? "Selected: " + graph.selectedRouteId : "No route selected";
  el.metaSummary.textContent = (graph?.nodes?.length || 0) + " nodes · " + (graph?.edges?.length || 0) + " edges · " + (graph?.routes?.length || 0) + " visible routes";
  el.countsText.textContent = (graph?.routeGroups?.length || 0) + " route groups";
  el.showMoreBtn.disabled = !controls.canExpandToMax;
  el.previousWindowBtn.disabled = !controls.canShiftPrevious;
  el.nextWindowBtn.disabled = !controls.canShiftNext;
  el.focusInput.value = graph?.focus?.keyword || "";
}

function renderGraph(message) {
  renderState = message;
  renderMeta(message);
  renderRouteChips(message);
  renderSidePanel(message);

  if (cy) {
    cy.destroy();
    cy = undefined;
  }

  cy = cytoscape({
    container: el.graphCanvas,
    elements: toCyElements(message),
    layout: getLayout(message),
    wheelSensitivity: 0.2,
    style: [
      {
        selector: "node",
        style: {
          label: "data(label)",
          width: 96,
          height: 46,
          shape: "round-rectangle",
          backgroundColor: "#142033",
          borderColor: "#f59e0b",
          borderWidth: 3,
          color: "#e6edf3",
          textValign: "center",
          textHalign: "center",
          fontSize: 12,
          textWrap: "wrap",
          textMaxWidth: 120,
          overlayOpacity: 0,
          transitionProperty: "opacity, line-color, border-color, background-color, width",
          transitionDuration: "120ms"
        }
      },
      {
        selector: "node.role-source, node.role-target",
        style: {
          borderWidth: 4,
          width: 104,
          height: 50,
          fontSize: 13
        }
      },
      {
        selector: "node.selected-route",
        style: {
          borderColor: "#60a5fa",
          borderWidth: 6,
          backgroundColor: "#1e3a5f",
          zIndex: 24
        }
      },
      {
        selector: "node.best-route",
        style: {
          borderColor: "#22c55e",
          borderWidth: 4,
          backgroundColor: "#183329",
          zIndex: 18
        }
      },
      { selector: "node.focused", style: { borderColor: "#a78bfa", borderWidth: 4 } },
      { selector: "node.system-heavy", style: { backgroundColor: "#46391c", borderColor: "#cca700" } },
      { selector: "node.loop-warning", style: { borderStyle: "dashed" } },
      { selector: "node.dimmed", style: { opacity: 0.16 } },
      {
        selector: "edge",
        style: {
          width: 1.2,
          lineColor: "#4b5563",
          targetArrowColor: "#4b5563",
          targetArrowShape: "triangle",
          arrowScale: 0.8,
          curveStyle: "bezier",
          label: "",
          fontSize: 9,
          textBackgroundOpacity: 1,
          textBackgroundColor: "#0f172a",
          textBackgroundPadding: 2,
          color: "#cbd5e1",
          textRotation: "autorotate",
          textOpacity: 0,
          opacity: 0.14,
          overlayOpacity: 0,
          zIndex: 1
        }
      },
      {
        selector: "edge.selected-route",
        style: {
          lineColor: "#60a5fa",
          targetArrowColor: "#60a5fa",
          width: 5,
          lineStyle: "solid",
          opacity: 1,
          label: "data(label)",
          textOpacity: 1,
          zIndex: 28
        }
      },
      {
        selector: "edge.best-route",
        style: {
          lineColor: "#22c55e",
          targetArrowColor: "#22c55e",
          width: 3,
          lineStyle: "solid",
          opacity: 0.8,
          label: "",
          textOpacity: 0,
          zIndex: 18
        }
      },
      {
        selector: "edge.focused",
        style: {
          lineColor: "#a78bfa",
          targetArrowColor: "#a78bfa",
          width: 3.2,
          opacity: 0.92,
          label: "",
          textOpacity: 0,
          zIndex: 22
        }
      },
      { selector: "edge.system-heavy", style: { lineColor: "#cca700", targetArrowColor: "#cca700" } },
      { selector: "edge.loop-warning", style: { lineStyle: "dashed" } },
      {
        selector: "edge.blocked",
        style: {
          lineColor: "#f14c4c",
          targetArrowColor: "#f14c4c",
          lineStyle: "dashed",
          textOpacity: 1
        }
      },
      { selector: "edge.dimmed", style: { opacity: 0.08, textOpacity: 0 } }
    ]
  });

  bindCyEvents();
}

el.closeGraphBtn.addEventListener("click", () => vscode.postMessage({ type: "closeRequested" }));
el.resetLayoutBtn.addEventListener("click", () => vscode.postMessage({ type: "resetLayoutRequested" }));
el.showMoreBtn.addEventListener("click", () => vscode.postMessage({ type: "showMoreRequested" }));
el.previousWindowBtn.addEventListener("click", () => vscode.postMessage({ type: "previousWindowRequested" }));
el.nextWindowBtn.addEventListener("click", () => vscode.postMessage({ type: "nextWindowRequested" }));
el.useRouteBtn.addEventListener("click", () => {
  const routeId = renderState?.graphViewModel?.sidePanel?.selectedRouteId || renderState?.graphViewModel?.selectedRouteId;
  vscode.postMessage({ type: "useRouteRequested", routeId });
});
el.focusInput.addEventListener("input", (event) => {
  vscode.postMessage({ type: "focusChanged", focusedKeyword: event.target?.value });
});

window.addEventListener("message", (event) => {
  if (event.data?.type === "renderGraph") {
    renderGraph(event.data);
  }
});

renderGraph(renderState);
vscode.postMessage({ type: "graphReady" });
`;
}
