import type { CapabilityExplorerMetric, CapabilityExplorerViewModel } from "../../capabilityExplorer/capabilityExplorerTypes.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderMetricIcon(metric: CapabilityExplorerMetric): string {
  if (metric.icon === "bolt") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 2 4 14h7l-1 8 10-13h-7l0-7Z" /></svg>`;
  }

  if (metric.icon === "function") {
    return `<span aria-hidden="true">ƒx</span>`;
  }

  if (metric.icon === "eye") {
    return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="3" /></svg>`;
  }

  return `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.6 13.4a4 4 0 0 1 0-5.7l2-2a4 4 0 1 1 5.7 5.7l-1.2 1.2" /><path d="M13.4 10.6a4 4 0 0 1 0 5.7l-2 2a4 4 0 1 1-5.7-5.7l1.2-1.2" /></svg>`;
}

function renderMetric(metric: CapabilityExplorerMetric): string {
  return `<article class="dvqr-metric-card dvqr-metric-card-${escapeHtml(metric.tone)}">
    <div class="dvqr-metric-icon dvqr-metric-icon-${escapeHtml(metric.tone)}">${renderMetricIcon(metric)}</div>
    <div>
      <div class="dvqr-metric-label">${escapeHtml(metric.label)}</div>
      <div class="dvqr-metric-value">${metric.value}</div>
      <div class="dvqr-muted">${escapeHtml(metric.detail)}</div>
    </div>
  </article>`;
}

export function getCapabilityExplorerMarkup(model: CapabilityExplorerViewModel): string {
  return `<main class="dvqr-capability-explorer">
    <header class="dvqr-header">
      <div class="dvqr-title-block">
        <h1>${escapeHtml(model.title)}</h1>
        <p class="dvqr-subtitle">${escapeHtml(model.subtitle)}</p>
        <div class="dvqr-context-line">
          <span>Environment: ${escapeHtml(model.environmentName)}</span>
          ${model.environmentUrl ? `<span>•</span><span>${escapeHtml(model.environmentUrl)}</span>` : ""}
          <span>•</span><span>Generated: ${escapeHtml(model.generatedAt)}</span>
        </div>
      </div>
      <div class="dvqr-toolbar">
        <button class="dvqr-button" type="button" data-action="refresh">Refresh</button>
        <button class="dvqr-button" type="button" data-action="copy-summary">Copy summary</button>
        <button class="dvqr-button dvqr-button-primary" type="button" data-action="open-hub">Open Hub</button>
      </div>
    </header>

    <section class="dvqr-metric-grid" aria-label="Capability summary">
      ${model.metrics.map(renderMetric).join("")}
    </section>

    <section>
      <div class="dvqr-section-header">
        <div>
          <h2>Custom APIs (${model.customApiCount})</h2>
          <p class="dvqr-muted">Custom APIs are Dataverse operations discoverable from metadata. Execution will remain preview-first.</p>
        </div>
      </div>

      <div class="dvqr-filter-row">
        <input class="dvqr-search" type="search" data-filter="text" placeholder="Filter by name, description, or bound entity..." />
        <select class="dvqr-select" data-filter="binding" aria-label="Binding filter">
          <option value="all">Binding: All</option>
          <option value="Bound">Bound</option>
          <option value="Unbound">Unbound</option>
          <option value="Unknown">Unknown</option>
        </select>
        <select class="dvqr-select" data-filter="type" aria-label="Type filter">
          <option value="all">Type: All</option>
          <option value="Action">Action</option>
          <option value="Function">Function</option>
        </select>
        <select class="dvqr-select" data-filter="private" aria-label="Visibility filter">
          <option value="all">Visibility: All</option>
          <option value="No">Public</option>
          <option value="Yes">Private</option>
        </select>
      </div>

      <div class="dvqr-explorer-layout">
        <div class="dvqr-table-card">
          <div class="dvqr-table-toolbar">
            <label class="dvqr-page-size-label">
              Rows per page
              <select class="dvqr-select dvqr-page-size" data-role="page-size" aria-label="Rows per page">
                <option value="10">10</option>
                <option value="20" selected>20</option>
                <option value="50">50</option>
                <option value="100">100</option>
              </select>
            </label>
            <div class="dvqr-table-hint">Click a row to inspect parameters. Drag column edges to resize.</div>
          </div>
          <div class="dvqr-table-shell">
            <table data-role="custom-api-table">
              <colgroup>
                <col data-column="displayName" style="width: 19%;" />
                <col data-column="uniqueName" style="width: 19%;" />
                <col data-column="operationKind" style="width: 8%;" />
                <col data-column="bindingKind" style="width: 8%;" />
                <col data-column="boundEntityLogicalName" style="width: 12%;" />
                <col data-column="requestParameterCount" style="width: 7%;" />
                <col data-column="responsePropertyCount" style="width: 8%;" />
                <col data-column="requiredParameterCount" style="width: 7%;" />
                <col data-column="isPrivate" style="width: 7%;" />
                <col data-column="description" style="width: 15%;" />
              </colgroup>
              <thead>
                <tr>
                  <th data-column="displayName">Display Name<span class="dvqr-column-resizer" data-resize-column="displayName"></span></th>
                  <th data-column="uniqueName">Unique Name<span class="dvqr-column-resizer" data-resize-column="uniqueName"></span></th>
                  <th data-column="operationKind">Type<span class="dvqr-column-resizer" data-resize-column="operationKind"></span></th>
                  <th data-column="bindingKind">Binding<span class="dvqr-column-resizer" data-resize-column="bindingKind"></span></th>
                  <th data-column="boundEntityLogicalName">Bound Entity<span class="dvqr-column-resizer" data-resize-column="boundEntityLogicalName"></span></th>
                  <th data-column="requestParameterCount">Params<span class="dvqr-column-resizer" data-resize-column="requestParameterCount"></span></th>
                  <th data-column="responsePropertyCount">Response<span class="dvqr-column-resizer" data-resize-column="responsePropertyCount"></span></th>
                  <th data-column="requiredParameterCount">Required<span class="dvqr-column-resizer" data-resize-column="requiredParameterCount"></span></th>
                  <th data-column="isPrivate">Private<span class="dvqr-column-resizer" data-resize-column="isPrivate"></span></th>
                  <th data-column="description">Description<span class="dvqr-column-resizer" data-resize-column="description"></span></th>
                </tr>
              </thead>
              <tbody data-role="custom-api-rows"></tbody>
            </table>
          </div>
          <div class="dvqr-empty" data-role="empty-state" hidden>No Custom APIs match the current filters.</div>
          <footer class="dvqr-footer">
            <span data-role="filter-summary">Showing ${model.customApiCount} APIs</span>
            <nav class="dvqr-pagination" aria-label="Custom API pagination" data-role="pagination"></nav>
            <span>${model.boundCount} bound • ${model.unboundCount} unbound • ${model.privateCount} private</span>
          </footer>
        </div>

        <aside class="dvqr-detail-drawer" data-role="detail-drawer" aria-label="Custom API detail drawer" hidden>
          <button class="dvqr-drawer-close" type="button" data-action="close-detail" aria-label="Close detail drawer">×</button>
          <div data-role="detail-content"></div>
        </aside>
      </div>
    </section>
  </main>`;
}
