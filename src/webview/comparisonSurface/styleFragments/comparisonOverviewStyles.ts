export const comparisonOverviewStyles = `
.dvqr-tabbar {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 9px;
  margin: 16px 0 20px;
  padding: 9px;
}

.dvqr-tab {
  background: transparent;
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
}

.dvqr-tab span {
  color: var(--vscode-descriptionForeground);
  margin-left: 4px;
}

.dvqr-tab:hover,
.dvqr-tab.is-active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-tab.is-active span {
  color: var(--vscode-button-foreground);
}

.dvqr-top-signals {
  margin: 0 0 22px;
}

.dvqr-section-heading-row {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.dvqr-top-signals h2 {
  margin-top: 0;
}

.dvqr-top-signals ol {
  counter-reset: dvqr-top-signal;
  display: grid;
  gap: 8px;
  list-style: none;
  margin: 14px 0 0;
  padding: 0;
}

.dvqr-top-signals li {
  counter-increment: dvqr-top-signal;
}

.dvqr-top-signals a {
  align-items: flex-start;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 70%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  color: var(--vscode-foreground);
  display: grid;
  gap: 4px;
  padding: 10px 12px 10px 42px;
  position: relative;
  text-decoration: none;
}

.dvqr-top-signals a::before {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  content: counter(dvqr-top-signal);
  display: inline-flex;
  font-size: 11px;
  height: 22px;
  justify-content: center;
  left: 12px;
  position: absolute;
  top: 10px;
  width: 22px;
}

.dvqr-top-signals a:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 14%, var(--vscode-editorWidget-background));
}

.dvqr-top-signal-title {
  font-weight: 700;
  line-height: 1.35;
}

.dvqr-top-signal-meta {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}


.dvqr-top-signals li[data-significance="High"] a {
  border-left: 4px solid var(--vscode-errorForeground);
}

.dvqr-top-signals li[data-significance="Medium"] a {
  border-left: 4px solid var(--vscode-testing-iconQueued);
}

.dvqr-top-signals li[data-significance="Low"] a {
  border-left: 4px solid var(--vscode-descriptionForeground);
}

.dvqr-top-signal-impact {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-top-signal-note {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  margin: 6px 0 0;
}


.dvqr-investigation-posture {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-left: 4px solid var(--vscode-descriptionForeground);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  line-height: 1.45;
  margin: 14px 0 0;
  padding: 10px 12px;
}

.dvqr-investigation-posture span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-investigation-posture-dense {
  border-left-color: var(--vscode-testing-iconQueued);
}

.dvqr-investigation-posture-quiet {
  border-left-color: color-mix(in srgb, var(--vscode-descriptionForeground) 70%, #2ea043 30%);
}

.dvqr-deferred-differences {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 12px;
  margin-top: 14px;
  padding: 12px 14px;
}

.dvqr-deferred-differences > summary {
  cursor: pointer;
  font-weight: 700;
}

.dvqr-deferred-differences > p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 8px 0 12px;
}


.dvqr-grouped-evidence-summary {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  margin: 12px 0 14px;
  padding: 10px 12px;
}

.dvqr-grouped-evidence-summary div {
  align-items: baseline;
  display: grid;
  gap: 4px;
  grid-template-columns: minmax(150px, 190px) minmax(0, 1fr);
}

.dvqr-grouped-evidence-summary strong {
  color: var(--vscode-foreground);
  font-size: 12px;
}

.dvqr-grouped-evidence-summary span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-classified-drift-list {
  display: grid;
  gap: 8px;
  margin: 12px 0 0;
  padding-left: 18px;
}

.dvqr-classified-drift-list li {
  align-items: center;
  column-gap: 10px;
  display: flex;
  flex-wrap: wrap;
  line-height: 1.45;
  row-gap: 4px;
}

.dvqr-classified-drift-main {
  align-items: baseline;
  column-gap: 8px;
  display: inline-flex;
  flex-wrap: wrap;
  row-gap: 2px;
}

.dvqr-classified-drift-meta {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  white-space: nowrap;
}

.dvqr-classified-drift-overflow {
  color: var(--vscode-descriptionForeground);
}

@media (max-width: 720px) {
  .dvqr-grouped-evidence-summary div {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dvqr-search-nav-row {
    grid-template-columns: 1fr;
  }

  .dvqr-search-input-wrap {
    flex-wrap: wrap;
  }

  .dvqr-search-status {
    text-align: left;
  }
}

.dvqr-session-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  margin: 14px 0 16px;
  padding: 12px 14px;
}

.dvqr-session-title {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-session-summary,
.dvqr-session-warning {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
}

.dvqr-session-warning {
  color: var(--vscode-testing-iconQueued);
}

.dvqr-session-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
}

.dvqr-session-item {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 10px;
}

.dvqr-session-item span:last-child {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-group-nav-link em {
  color: var(--vscode-descriptionForeground);
  font-style: normal;
}

.dvqr-group-nav-link:hover em {
  color: var(--vscode-button-foreground);
}

.dvqr-back-top {
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  font-size: 12px;
  margin-top: 14px;
  text-decoration: none;
}

.dvqr-back-top:hover {
  color: var(--vscode-foreground);
  text-decoration: underline;
}

.dvqr-group-nav {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 16px 0 12px;
  padding: 9px;
  position: sticky;
  top: 0;
  z-index: 3;
}

.dvqr-group-nav-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  margin: 0 4px;
  text-transform: uppercase;
}

.dvqr-group-nav-link {
  align-items: center;
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  display: inline-flex;
  gap: 6px;
  font-size: 12px;
  padding: 6px 10px;
  text-decoration: none;
}

.dvqr-group-nav-link strong {
  color: var(--vscode-descriptionForeground);
  font-weight: 600;
}

.dvqr-group-nav-link:hover {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-group-nav-link:hover strong {
  color: var(--vscode-button-foreground);
}

.dvqr-eyebrow {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: 28px;
  line-height: 1.18;
  margin-bottom: 8px;
}

.dvqr-title-row {
  align-items: flex-start;
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.dvqr-title-row h1 {
  margin-bottom: 0;
}

h2 {
  font-size: 20px;
  margin: 24px 0 12px;
}

h3 {
  font-size: 16px;
  line-height: 1.35;
  margin-bottom: 5px;
}

.dvqr-muted,
.dvqr-section-note,
.dvqr-difference-heading p,
.dvqr-group-header p {
  color: var(--vscode-descriptionForeground);
}

.dvqr-difference-heading p,
.dvqr-group-header p {
  font-size: 12px;
  line-height: 1.45;
  margin-bottom: 0;
}

.dvqr-summary-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(145px, 1fr));
  margin: 18px 0 0;
}

.dvqr-summary-item,
.dvqr-environment-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 75%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px;
}

.dvqr-summary-value {
  display: block;
  font-size: 21px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}

.dvqr-summary-item.is-text .dvqr-summary-value {
  font-size: 19px;
  line-height: 1.18;
}

.dvqr-summary-label {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-environment-card {
  align-self: start;
}


.dvqr-snapshot-trust-banner {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  line-height: 1.45;
  margin: 14px 0 0;
  padding: 10px 12px;
}

.dvqr-snapshot-trust-banner span {
  color: var(--vscode-descriptionForeground);
}

.dvqr-snapshot-trust-banner-modified,
.dvqr-snapshot-trust-banner-invalid {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 84%, var(--vscode-errorForeground) 8%);
  border-color: color-mix(in srgb, var(--vscode-panel-border) 45%, var(--vscode-errorForeground) 55%);
}

.dvqr-snapshot-trust-banner-legacy {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 86%, var(--vscode-testing-iconQueued) 8%);
  border-color: color-mix(in srgb, var(--vscode-panel-border) 45%, var(--vscode-testing-iconQueued) 55%);
}


.dvqr-environment-title {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  margin-bottom: 10px;
  text-transform: uppercase;
}

.dvqr-environment-grid {
  display: grid;
  gap: 10px;
}

.dvqr-environment-item {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 10px;
}

.dvqr-environment-item span:last-child {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-environment-name {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  min-width: 0;
}

.dvqr-environment-name span:first-child {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dvqr-inline-trust-icon {
  align-items: center;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 auto;
  font-size: 10px;
  font-weight: 700;
  height: 16px;
  justify-content: center;
  line-height: 1;
  width: 16px;
}

.dvqr-inline-trust-verified {
  border-color: color-mix(in srgb, var(--vscode-panel-border) 55%, #2ea043 45%);
  color: #2ea043;
}

.dvqr-inline-trust-legacy {
  border-color: color-mix(in srgb, var(--vscode-panel-border) 45%, var(--vscode-testing-iconQueued) 55%);
  color: var(--vscode-testing-iconQueued);
}

.dvqr-inline-trust-modified,
.dvqr-inline-trust-invalid {
  border-color: color-mix(in srgb, var(--vscode-panel-border) 45%, var(--vscode-errorForeground) 55%);
  color: var(--vscode-errorForeground);
}

.dvqr-inline-trust-unknown {
  color: var(--vscode-descriptionForeground);
}
`;
