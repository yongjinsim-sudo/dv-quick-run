export function getCapabilityExplorerStyles(): string {
  return `
:root {
  color-scheme: dark;
}

* {
  box-sizing: border-box;
}

html,
body {
  height: 100%;
}

body {
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  margin: 0;
  overflow: hidden;
  padding: 0;
}

button, input, select {
  font: inherit;
}

.dvqr-capability-explorer {
  display: flex;
  flex-direction: column;
  height: 100vh;
  margin: 0 auto;
  max-width: 1500px;
  min-height: 0;
  overflow: hidden;
  padding: 28px 32px 34px;
}

.dvqr-capability-explorer > section:last-child {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.dvqr-header {
  align-items: flex-start;
  display: flex;
  flex: 0 0 auto;
  gap: 20px;
  justify-content: space-between;
  margin-bottom: 24px;
}

.dvqr-title-block h1 {
  font-size: 28px;
  font-weight: 650;
  margin: 0 0 8px;
}

.dvqr-subtitle,
.dvqr-muted {
  color: var(--vscode-descriptionForeground);
}

.dvqr-subtitle {
  margin: 0 0 10px;
}

.dvqr-context-line {
  color: var(--vscode-descriptionForeground);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dvqr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
}

.dvqr-button {
  align-items: center;
  background: var(--vscode-button-secondaryBackground, var(--vscode-editorWidget-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 7px;
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  cursor: pointer;
  display: inline-flex;
  gap: 7px;
  padding: 8px 12px;
}

.dvqr-button:hover {
  background: var(--vscode-list-hoverBackground);
}

.dvqr-button-primary {
  background: var(--vscode-button-background);
  border-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-metric-grid {
  display: grid;
  flex: 0 0 auto;
  gap: 12px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  margin-bottom: 26px;
}

.dvqr-metric-card {
  align-items: flex-start;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: flex;
  gap: 14px;
  min-height: 104px;
  padding: 16px;
}

.dvqr-metric-card-primary {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, var(--vscode-editorWidget-background));
  border-color: color-mix(in srgb, var(--vscode-button-background) 70%, var(--vscode-panel-border));
}

.dvqr-metric-card-action {
  background: color-mix(in srgb, #f6c343 7%, var(--vscode-editorWidget-background));
}

.dvqr-metric-card-function {
  background: color-mix(in srgb, #3b82f6 7%, var(--vscode-editorWidget-background));
}

.dvqr-metric-card-visibility {
  background: color-mix(in srgb, #3fb950 8%, var(--vscode-editorWidget-background));
}

.dvqr-metric-icon {
  align-items: center;
  border: 1px solid currentColor;
  border-radius: 8px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 20px;
  height: 34px;
  justify-content: center;
  line-height: 1;
  margin-top: 2px;
  width: 34px;
}

.dvqr-metric-icon svg {
  fill: none;
  height: 22px;
  stroke: currentColor;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-width: 2;
  width: 22px;
}

.dvqr-metric-icon-primary {
  background: color-mix(in srgb, #a371f7 18%, transparent);
  color: #a371f7;
}

.dvqr-metric-icon-action {
  background: color-mix(in srgb, #f6c343 16%, transparent);
  color: #f6c343;
}

.dvqr-metric-icon-function {
  background: color-mix(in srgb, #3b82f6 16%, transparent);
  color: #3b82f6;
}

.dvqr-metric-icon-visibility {
  background: color-mix(in srgb, #3fb950 16%, transparent);
  color: #3fb950;
}

.dvqr-metric-label {
  color: var(--vscode-foreground);
  font-weight: 650;
  margin-bottom: 8px;
}

.dvqr-metric-value {
  font-size: 26px;
  font-weight: 700;
  margin-bottom: 5px;
}

.dvqr-section-header {
  align-items: flex-end;
  display: flex;
  flex: 0 0 auto;
  gap: 16px;
  justify-content: space-between;
  margin-bottom: 14px;
}

.dvqr-section-header h2 {
  font-size: 22px;
  margin: 0 0 6px;
}

.dvqr-section-header p {
  margin: 0;
}

.dvqr-filter-row {
  display: grid;
  flex: 0 0 auto;
  gap: 12px;
  grid-template-columns: minmax(280px, 1fr) 180px 160px 160px;
  margin-bottom: 14px;
}

.dvqr-search,
.dvqr-select {
  background: var(--vscode-input-background);
  border: 1px solid var(--vscode-input-border, var(--vscode-panel-border));
  border-radius: 7px;
  color: var(--vscode-input-foreground);
  min-height: 32px;
  outline: none;
  padding: 6px 10px;
}

.dvqr-search:focus,
.dvqr-select:focus {
  border-color: var(--vscode-focusBorder);
}

.dvqr-explorer-layout {
  align-items: stretch;
  display: grid;
  flex: 1 1 auto;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr);
  min-height: 0;
}

.dvqr-explorer-layout-with-drawer {
  grid-template-columns: minmax(0, 1fr) minmax(340px, 420px);
}

.dvqr-table-card {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow: hidden;
}

.dvqr-table-toolbar {
  align-items: center;
  border-bottom: 1px solid var(--vscode-panel-border);
  display: flex;
  gap: 16px;
  justify-content: space-between;
  padding: 8px 12px;
}

.dvqr-page-size-label {
  align-items: center;
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  gap: 8px;
  white-space: nowrap;
}

.dvqr-page-size {
  min-height: 28px;
  padding-bottom: 4px;
  padding-top: 4px;
  width: 76px;
}

.dvqr-table-hint {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dvqr-table-shell {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  width: 100%;
}

table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

th,
td {
  border-bottom: 1px solid var(--vscode-panel-border);
  line-height: 1.25;
  overflow: hidden;
  padding: 7px 10px;
  text-align: left;
  text-overflow: ellipsis;
  vertical-align: middle;
}

th {
  background: var(--vscode-editorWidget-background);
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  font-weight: 650;
  position: sticky;
  top: 0;
  white-space: nowrap;
  z-index: 1;
}

td {
  max-width: 1px;
  white-space: nowrap;
}

tr:hover td {
  background: var(--vscode-list-hoverBackground);
}

.dvqr-selected-row td {
  background: color-mix(in srgb, var(--vscode-button-background) 14%, var(--vscode-list-hoverBackground)) !important;
  box-shadow: inset 0 1px 0 color-mix(in srgb, var(--vscode-button-background) 52%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--vscode-button-background) 52%, transparent);
}

.dvqr-selected-row td:first-child {
  box-shadow: inset 2px 0 0 var(--vscode-button-background), inset 0 1px 0 color-mix(in srgb, var(--vscode-button-background) 52%, transparent), inset 0 -1px 0 color-mix(in srgb, var(--vscode-button-background) 52%, transparent);
}

.dvqr-name {
  font-weight: 650;
}

.dvqr-description {
  color: var(--vscode-descriptionForeground);
}

.dvqr-pill {
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 650;
  max-width: 100%;
  overflow: hidden;
  padding: 2px 7px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dvqr-pill-action {
  background: color-mix(in srgb, var(--vscode-button-background) 26%, transparent);
  color: var(--vscode-button-foreground);
}

.dvqr-pill-function {
  background: color-mix(in srgb, var(--vscode-textLink-foreground) 20%, transparent);
  color: var(--vscode-textLink-foreground);
}

.dvqr-pill-bound {
  background: color-mix(in srgb, #3fb950 24%, transparent);
  color: #72d985;
}

.dvqr-pill-unbound {
  background: color-mix(in srgb, var(--vscode-descriptionForeground) 18%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-private {
  color: var(--vscode-errorForeground);
  font-weight: 650;
}

.dvqr-column-resizer {
  bottom: 0;
  cursor: col-resize;
  position: absolute;
  right: -3px;
  top: 0;
  width: 7px;
  z-index: 2;
}

.dvqr-column-resizer::after {
  background: transparent;
  bottom: 8px;
  content: "";
  position: absolute;
  right: 3px;
  top: 8px;
  width: 1px;
}

th:hover .dvqr-column-resizer::after,
.dvqr-column-resizer-active::after {
  background: var(--vscode-focusBorder);
}

.dvqr-footer {
  align-items: center;
  border-top: 1px solid var(--vscode-panel-border);
  color: var(--vscode-descriptionForeground);
  display: grid;
  flex: 0 0 auto;
  gap: 12px;
  grid-template-columns: minmax(160px, 1fr) auto minmax(160px, 1fr);
  padding: 10px 12px;
}

.dvqr-footer > :last-child {
  text-align: right;
}

.dvqr-pagination {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  justify-content: center;
}

.dvqr-page-button,
.dvqr-page-ellipsis {
  align-items: center;
  border-radius: 6px;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  min-width: 28px;
  padding: 0 8px;
}

.dvqr-page-button {
  background: var(--vscode-button-secondaryBackground, transparent);
  border: 1px solid var(--vscode-panel-border);
  color: var(--vscode-button-secondaryForeground, var(--vscode-foreground));
  cursor: pointer;
}

.dvqr-page-button:hover:not(:disabled) {
  background: var(--vscode-list-hoverBackground);
}

.dvqr-page-button:disabled {
  cursor: default;
  opacity: 0.45;
}

.dvqr-page-button-active {
  background: var(--vscode-button-background);
  border-color: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-page-ellipsis {
  color: var(--vscode-descriptionForeground);
}

.dvqr-empty {
  color: var(--vscode-descriptionForeground);
  flex: 1 1 auto;
  padding: 26px;
  text-align: center;
}


.dvqr-detail-drawer {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: flex;
  flex-direction: column;
  max-height: 100%;
  min-height: 0;
  overflow: hidden;
  padding: 0;
}

.dvqr-detail-drawer[hidden] {
  display: none;
}

.dvqr-detail-drawer table {
  max-width: 100%;
}

.dvqr-drawer-close {
  background: transparent;
  border: 0;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font-size: 24px;
  line-height: 1;
  padding: 2px 6px;
  position: absolute;
  right: 12px;
  top: 12px;
  z-index: 3;
}

.dvqr-drawer-close:hover {
  color: var(--vscode-foreground);
}

[data-role="detail-content"] {
  display: flex;
  flex: 1 1 auto;
  flex-direction: column;
  min-height: 0;
}

.dvqr-detail-header {
  background: var(--vscode-editorWidget-background);
  border-bottom: 1px solid var(--vscode-panel-border);
  flex: 0 0 auto;
  padding: 18px 48px 14px 18px;
}

.dvqr-detail-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  padding: 0 18px 14px;
}

.dvqr-detail-footer {
  background: var(--vscode-editorWidget-background);
  border-top: 1px solid var(--vscode-panel-border);
  flex: 0 0 auto;
  padding: 12px 18px 14px;
}

.dvqr-detail-header h2 {
  font-size: 22px;
  margin: 0 0 8px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dvqr-detail-header p {
  color: var(--vscode-descriptionForeground);
  line-height: 1.45;
  margin: 12px 0 0;
}

.dvqr-detail-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dvqr-detail-badge {
  background: color-mix(in srgb, var(--vscode-descriptionForeground) 18%, transparent);
  border-radius: 6px;
  color: var(--vscode-foreground);
  font-size: 12px;
  font-weight: 650;
  padding: 3px 8px;
}

.dvqr-detail-badge-type {
  background: color-mix(in srgb, #a371f7 25%, transparent);
  color: #d8c5ff;
}

.dvqr-detail-badge-binding {
  background: color-mix(in srgb, var(--vscode-descriptionForeground) 22%, transparent);
}

.dvqr-detail-badge-private {
  background: color-mix(in srgb, var(--vscode-errorForeground) 22%, transparent);
  color: var(--vscode-errorForeground);
}

.dvqr-drawer-section {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  margin-top: 12px;
  padding: 12px;
}

.dvqr-detail-body .dvqr-drawer-section:first-child {
  margin-top: 14px;
}

.dvqr-detail-footer .dvqr-drawer-section {
  margin-top: 0;
}

.dvqr-drawer-section h3 {
  font-size: 13px;
  letter-spacing: 0.02em;
  margin: 0 0 10px;
  text-transform: uppercase;
}

.dvqr-overview-list {
  display: grid;
  gap: 8px;
}

.dvqr-overview-row {
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(90px, 0.75fr) minmax(0, 1.25fr);
}

.dvqr-overview-row span {
  color: var(--vscode-descriptionForeground);
}

.dvqr-overview-row strong {
  font-weight: 600;
  overflow-wrap: anywhere;
}

.dvqr-drawer-table {
  border-collapse: collapse;
  table-layout: fixed;
  width: 100%;
}

.dvqr-drawer-table th,
.dvqr-drawer-table td {
  font-size: 12px;
  padding: 6px 6px;
}

.dvqr-drawer-table td {
  max-width: 1px;
  white-space: nowrap;
}

.dvqr-drawer-table .dvqr-drawer-more {
  white-space: normal;
}

.dvqr-readiness-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 7px;
  display: grid;
  gap: 5px;
  padding: 10px;
}

.dvqr-readiness-card strong {
  font-weight: 700;
}

.dvqr-readiness-card span {
  color: var(--vscode-descriptionForeground);
  line-height: 1.45;
}

.dvqr-readiness-good {
  background: color-mix(in srgb, #3fb950 12%, transparent);
  border-color: color-mix(in srgb, #3fb950 40%, var(--vscode-panel-border));
}

.dvqr-readiness-good strong {
  color: #72d985;
}

.dvqr-readiness-partial {
  background: color-mix(in srgb, #f6c343 10%, transparent);
  border-color: color-mix(in srgb, #f6c343 36%, var(--vscode-panel-border));
}

.dvqr-readiness-partial strong {
  color: #f6c343;
}

.dvqr-readiness-advisory {
  background: color-mix(in srgb, #f6c343 10%, transparent);
  border-color: color-mix(in srgb, #f6c343 48%, var(--vscode-panel-border));
  line-height: 1.45;
  margin-top: 12px;
}

.dvqr-readiness-advisory strong {
  color: #f6c343;
}

.dvqr-readiness-muted {
  background: color-mix(in srgb, var(--vscode-descriptionForeground) 8%, transparent);
}

.dvqr-readiness-muted strong {
  color: var(--vscode-descriptionForeground);
}

.dvqr-readiness-counts {
  color: var(--vscode-descriptionForeground);
  display: flex;
  flex-wrap: wrap;
  gap: 8px 14px;
  margin-top: 8px;
}

.dvqr-supported {
  color: #72d985;
  font-weight: 650;
}

.dvqr-muted-cell,
.dvqr-drawer-empty,
.dvqr-drawer-more {
  color: var(--vscode-descriptionForeground);
}

.dvqr-notes-list {
  color: var(--vscode-descriptionForeground);
  line-height: 1.55;
  margin: 0;
  padding-left: 18px;
}

.dvqr-next-step-row {
  align-items: center;
  color: var(--vscode-descriptionForeground);
  display: flex;
  gap: 14px;
}

.dvqr-next-step-row + .dvqr-next-step-row {
  margin-top: 10px;
}

.dvqr-next-step-row .dvqr-button {
  flex: 0 0 118px;
  justify-content: center;
  min-height: 48px;
  text-align: center;
  white-space: normal;
  width: 118px;
}

.dvqr-next-step-row .dvqr-button:disabled {
  cursor: default;
  opacity: 0.55;
}

@media (max-width: 1180px) {
  .dvqr-explorer-layout,
  .dvqr-explorer-layout-with-drawer {
    grid-template-columns: 1fr;
  }

 .dvqr-table-card {
    height: auto;
    max-height: none;
  }

  .dvqr-detail-drawer {
    max-height: none;
  }

  [data-role="detail-content"] {
    min-height: 320px;
  }
}

@media (max-width: 980px) {
  .dvqr-header,
  .dvqr-section-header {
    align-items: stretch;
    flex-direction: column;
  }

  .dvqr-toolbar {
    justify-content: flex-start;
  }

  .dvqr-metric-grid,
  .dvqr-filter-row {
    grid-template-columns: 1fr;
  }

  .dvqr-footer {
    grid-template-columns: 1fr;
  }

  .dvqr-footer > :last-child {
    text-align: left;
  }
}
`;
}
