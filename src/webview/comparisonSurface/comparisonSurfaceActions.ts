import { type ComparisonSurfaceRenderOptions } from "./comparisonSurfacePrimitives.js";

export function renderToolbar(options: ComparisonSurfaceRenderOptions = {}): string {
  const locked = options.canExport === false;
  const suffix = locked ? " 🔒" : "";
  return `<div class="dvqr-toolbar" role="toolbar" aria-label="Comparison export actions">
    <button type="button" class="dvqr-action-button" data-export-kind="json">Save JSON${suffix}</button>
    <button type="button" class="dvqr-action-button" data-export-kind="md">Save MD${suffix}</button>
    <button type="button" class="dvqr-action-button" data-export-kind="html">Save HTML${suffix}</button>
    <details class="dvqr-report-menu">
      <summary class="dvqr-action-button dvqr-report-menu-trigger">Reports ▾</summary>
      <div class="dvqr-report-menu-panel" role="menu" aria-label="Export reports">
        <span class="dvqr-report-menu-heading">Export reports</span>
        <button type="button" class="dvqr-report-menu-item" data-export-kind="summary-html" role="menuitem">Diff Findings Summary <span>HTML${suffix}</span></button>
        <button type="button" class="dvqr-report-menu-item" data-export-kind="summary-pdf" role="menuitem">Diff Findings Summary <span>PDF${suffix}</span></button>
        <button type="button" class="dvqr-report-menu-item" data-export-kind="handoff-html" role="menuitem">Investigation Handoff <span>HTML${suffix}</span></button>
        <button type="button" class="dvqr-report-menu-item" data-export-kind="handoff-pdf" role="menuitem">Investigation Handoff <span>PDF${suffix}</span></button>
      </div>
    </details>
    <button type="button" class="dvqr-action-button dvqr-action-button-muted" data-reset-investigation-state>Reset Review State</button>
  </div>`;
}

export function renderCommunityFooter(): string {
  return `<footer class="dvqr-community-footer">
    <span>Have feedback on drift providers or snapshot workflows?</span>
    <a href="https://github.com/yongjinsim-sudo/dv-quick-run/discussions">Join DVQR Discussions</a>
  </footer>`;
}
