export function getComparisonSurfaceStyles(): string {
  return `
:root {
  color-scheme: light dark;
  --vscode-editor-background: #111315;
  --vscode-foreground: #d4d4d4;
  --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --vscode-font-size: 13px;
  --vscode-editorWidget-background: #1e1e1e;
  --vscode-panel-border: #2d2d2d;
  --vscode-descriptionForeground: #a8a8a8;
  --vscode-errorForeground: #f48771;
  --vscode-testing-iconQueued: #cca700;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #1177bb;
  --vscode-button-secondaryBackground: #3a3d41;
  --vscode-button-secondaryForeground: #ffffff;
  --vscode-button-secondaryHoverBackground: #45494e;
  --vscode-button-border: #555;
}

body {
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  margin: 0;
  padding: 0;
}

.dvqr-comparison {
  margin: 0 auto;
  max-width: 1180px;
  padding: 28px;
}

.dvqr-hero,
.dvqr-card {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 14px;
  padding: 20px;
}

.dvqr-hero {
  margin-bottom: 24px;
}

.dvqr-hero-topline {
  align-items: flex-start;
  display: flex;
  gap: 16px;
  justify-content: space-between;
}

.dvqr-hero-detail-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 320px);
}

.dvqr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.dvqr-action-button {
  background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 6px;
  color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
  cursor: pointer;
  font: inherit;
  padding: 5px 10px;
}

.dvqr-action-button:hover {
  background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
}


.dvqr-search-nav {
  background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  margin: 12px 0 16px;
  padding: 12px;
}

.dvqr-search-nav-row {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: auto minmax(320px, 1fr);
}

.dvqr-search-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
}

.dvqr-search-input-wrap {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(420px, 0.9fr) auto;
  min-width: 0;
}

.dvqr-search-input {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 8px;
  color: var(--vscode-foreground);
  font: inherit;
  min-width: 0;
  padding: 8px 11px;
}

.dvqr-search-input:focus {
  border-color: var(--vscode-button-background);
  outline: 1px solid color-mix(in srgb, var(--vscode-button-background) 55%, transparent);
}

.dvqr-search-actions {
  align-items: center;
  display: inline-flex;
  gap: 10px;
  justify-content: flex-start;
  min-width: 0;
  white-space: nowrap;
}

.dvqr-search-navigation {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 70%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 116px;
  gap: 6px;
  justify-content: space-between;
  min-width: 116px;
  padding: 2px;
  white-space: nowrap;
  width: 116px;
}

.dvqr-search-nav-button {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  height: 26px;
  justify-content: center;
  line-height: 1;
  padding: 0;
  width: 26px;
}

.dvqr-search-nav-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-search-nav-button:disabled {
  cursor: not-allowed;
  opacity: 0.42;
}

.dvqr-search-count {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  min-width: 46px;
  text-align: center;
  white-space: nowrap;
}

.dvqr-search-clear {
  background: transparent;
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 5px 10px;
}

.dvqr-search-clear:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-search-status {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  max-width: 260px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.dvqr-search-note {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 10px 0 0;
}

.dvqr-search-highlight {
  background: color-mix(in srgb, var(--vscode-testing-iconQueued) 42%, transparent);
  border-radius: 3px;
  color: var(--vscode-foreground);
  padding: 0 2px;
}

.dvqr-search-highlight.is-active {
  background: color-mix(in srgb, var(--vscode-button-background) 55%, var(--vscode-testing-iconQueued) 28%);
  outline: 1px solid color-mix(in srgb, var(--vscode-button-background) 70%, transparent);
}

.dvqr-search-empty {
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: none;
  font-size: 12px;
  margin: 10px 0 14px;
  padding: 10px 12px;
}

.dvqr-search-empty.is-visible {
  display: block;
}

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

.dvqr-group-list,
.dvqr-difference-list {
  display: grid;
}

.dvqr-group-list {
  gap: 18px;
}

.dvqr-difference-list {
  gap: 16px;
  margin-top: 16px;
}

.dvqr-group-card {
  border-left: 4px solid var(--vscode-panel-border);
}

.dvqr-group-card.is-hidden {
  display: none;
}

.dvqr-group-header {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.dvqr-group-header h2 {
  margin-top: 0;
}

.dvqr-group-meta {
  justify-content: flex-end;
  min-width: fit-content;
}

.dvqr-group-card[data-significance="High"] {
  border-left-color: var(--vscode-errorForeground);
}

.dvqr-group-card[data-significance="Medium"] {
  border-left-color: var(--vscode-testing-iconQueued);
}

.dvqr-group-card[data-significance="Low"] {
  border-left-color: var(--vscode-descriptionForeground);
}

.dvqr-meta {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dvqr-chip {
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  display: inline-flex;
  font-size: 12px;
  padding: 4px 9px;
}

.dvqr-chip-muted {
  color: var(--vscode-descriptionForeground);
}

.dvqr-difference-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 65%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: block;
  overflow: hidden;
}

.dvqr-difference-card[data-significance="High"] {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 70%, var(--vscode-errorForeground) 4%);
}

.dvqr-difference-card[data-significance="High"] .dvqr-difference-heading {
  border-left-color: var(--vscode-errorForeground);
}

.dvqr-difference-card[data-significance="Medium"] .dvqr-difference-heading {
  border-left-color: var(--vscode-testing-iconQueued);
}

.dvqr-difference-card[data-significance="Low"] .dvqr-difference-heading {
  border-left-color: var(--vscode-descriptionForeground);
}

.dvqr-difference-heading {
  align-items: flex-start;
  border-left: 3px solid var(--vscode-panel-border);
  cursor: pointer;
  display: flex;
  gap: 10px;
  list-style: none;
  padding: 16px 18px;
}

.dvqr-difference-heading::-webkit-details-marker {
  display: none;
}

.dvqr-difference-title-block {
  display: grid;
  flex: 1 1 auto;
  gap: 4px;
  min-width: 0;
}

.dvqr-difference-title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.35;
}

.dvqr-difference-description {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-difference-toggle::before {
  color: var(--vscode-descriptionForeground);
  content: "▸";
  display: inline-block;
  font-size: 12px;
  padding-top: 3px;
}

.dvqr-difference-card[open] .dvqr-difference-toggle::before {
  content: "▾";
}

.dvqr-difference-body {
  padding: 0 18px 18px 18px;
}

.dvqr-difference-icon {
  align-items: center;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  display: inline-flex;
  flex: 0 0 auto;
  height: 24px;
  justify-content: center;
  margin-top: 1px;
  width: 24px;
}

.dvqr-values {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  margin: 14px 0;
}

.dvqr-value-box {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 10px;
}

.dvqr-value-label {
  color: var(--vscode-descriptionForeground);
  display: block;
  font-size: 12px;
  margin-bottom: 4px;
}

.dvqr-evidence-details {
  margin-top: 12px;
}

.dvqr-evidence-details summary {
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font-size: 12px;
  user-select: none;
}

.dvqr-evidence-details summary span {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  margin-left: 4px;
  padding: 1px 6px;
}

.dvqr-evidence {
  margin: 10px 0 0;
  padding-left: 20px;
}

.dvqr-evidence li {
  align-items: baseline;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 4px 0;
}

.dvqr-evidence-continuation-pill {
  cursor: pointer;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  font-size: 11px;
  line-height: 1.4;
  padding: 1px 7px;
  white-space: nowrap;
}

.dvqr-evidence-continuation-pill:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
}


.dvqr-density-note {
  align-items: flex-start;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-testing-iconQueued) 8%);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: grid;
  gap: 4px;
  margin-top: 12px;
  padding: 10px 12px;
}

.dvqr-density-note strong {
  color: var(--vscode-foreground);
}

.dvqr-investigation-continuations {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 80%, var(--vscode-button-background) 7%);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  margin-top: 12px;
  padding: 10px 12px;
}

.dvqr-investigation-continuations summary {
  cursor: pointer;
  font-weight: 700;
}

.dvqr-investigation-continuations summary span {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  margin-left: 6px;
}

.dvqr-investigation-continuations > p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 8px 0 10px;
}

.dvqr-continuation-list,
.dvqr-continuation-children {
  display: grid;
  gap: 10px;
}

.dvqr-continuation-children {
  border-left: 2px solid color-mix(in srgb, var(--vscode-button-background) 32%, var(--vscode-panel-border));
  margin-top: 10px;
  padding-left: 12px;
}

.dvqr-investigation-continuation {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px;
}

.dvqr-investigation-continuation[data-continuation-state="InspectOnly"] {
  border-style: dashed;
}

.dvqr-continuation-heading {
  align-items: flex-start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.dvqr-continuation-eyebrow {
  color: var(--vscode-descriptionForeground);
  display: block;
  font-size: 11px;
  letter-spacing: 0.04em;
  margin-bottom: 3px;
  text-transform: uppercase;
}

.dvqr-continuation-heading h4 {
  font-size: 14px;
  margin: 0;
}

.dvqr-continuation-meta {
  justify-content: flex-end;
}

.dvqr-investigation-continuation p {
  color: var(--vscode-descriptionForeground);
  line-height: 1.45;
  margin: 8px 0 0;
}

.dvqr-continuation-evidence {
  color: var(--vscode-descriptionForeground);
  display: grid;
  font-size: 12px;
  gap: 4px;
  margin: 10px 0 0;
  padding-left: 18px;
}

.dvqr-continuation-depth-limit {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-testing-iconQueued) 8%);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  color: var(--vscode-descriptionForeground);
  display: grid;
  font-size: 12px;
  gap: 3px;
  margin-top: 10px;
  padding: 9px 10px;
}

.dvqr-continuation-depth-limit strong {
  color: var(--vscode-foreground);
}

.dvqr-nearby-drift {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-button-background) 8%);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  margin-top: 12px;
  padding: 10px 12px;
}

.dvqr-nearby-drift summary {
  cursor: pointer;
  font-weight: 700;
}

.dvqr-nearby-drift summary span {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  margin-left: 6px;
}

.dvqr-nearby-drift p {
  color: var(--vscode-descriptionForeground);
  margin: 8px 0;
}

.dvqr-nearby-drift ol {
  display: grid;
  gap: 10px;
  list-style: none;
  margin: 8px 0 0;
  padding: 0;
}

.dvqr-nearby-drift li {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  padding: 9px 10px;
}


.dvqr-nearby-drift li[data-significance="High"] {
  border-left: 3px solid var(--vscode-errorForeground);
}

.dvqr-nearby-drift li[data-significance="Medium"] {
  border-left: 3px solid var(--vscode-testing-iconQueued);
}

.dvqr-nearby-drift li[data-significance="Low"] {
  border-left: 3px solid var(--vscode-descriptionForeground);
}

.dvqr-nearby-drift-cue {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dvqr-nearby-drift-meta {
  align-items: center;
  column-gap: 10px;
  display: flex;
  flex-wrap: wrap;
  row-gap: 4px;
}

.dvqr-nearby-drift-overflow {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.dvqr-nearby-drift-pivots {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.dvqr-nearby-drift-pivots > span {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  margin-right: 2px;
}

.dvqr-nearby-drift-pill {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  line-height: 1.4;
  list-style: none;
  padding: 2px 8px;
  text-decoration: none;
  user-select: none;
}

.dvqr-nearby-drift-pill::-webkit-details-marker {
  display: none;
}

.dvqr-nearby-drift-pill:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-nearby-drift-signals[open] > .dvqr-nearby-drift-pill {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-nearby-drift-signals {
  display: inline-block;
}

.dvqr-nearby-drift-signal-body {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  margin-top: 8px;
  padding: 9px 10px;
}

.dvqr-nearby-drift-signal-body p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
}

.dvqr-nearby-drift-signal-body ul {
  display: grid;
  gap: 6px;
  margin: 0;
  padding-left: 18px;
}

.dvqr-nearby-drift-signal-body li {
  border: 0;
  border-radius: 0;
  display: list-item;
  padding: 0;
}

.dvqr-nearby-drift-signal-body li strong {
  color: var(--vscode-foreground);
}

.dvqr-nearby-drift-signal-body li span {
  display: block;
}

.dvqr-nearby-drift a {
  color: var(--vscode-textLink-foreground, var(--vscode-button-background));
  font-weight: 700;
  text-decoration: none;
}

.dvqr-nearby-drift a:hover {
  text-decoration: underline;
}

.dvqr-nearby-drift .dvqr-nearby-drift-pill {
  color: var(--vscode-descriptionForeground);
  font-weight: 400;
}

.dvqr-nearby-drift .dvqr-nearby-drift-pill:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  color: var(--vscode-foreground);
  text-decoration: none;
}

.dvqr-nearby-drift li span,
.dvqr-nearby-drift li em {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-nearby-drift li ul {
  color: var(--vscode-descriptionForeground);
  margin: 4px 0 0;
  padding-left: 18px;
}



.dvqr-investigation-session {
  margin-top: 22px;
}

.dvqr-investigation-session-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  margin-top: 14px;
}

.dvqr-investigation-session-panel {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 14px;
  padding: 16px;
}

.dvqr-investigation-session-panel-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-investigation-metric-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
}

.dvqr-investigation-metric {
  background: color-mix(in srgb, var(--vscode-editor-background) 84%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px;
}

.dvqr-investigation-metric-value {
  color: var(--vscode-foreground);
  font-size: 24px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 6px;
}

.dvqr-investigation-metric-label {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.4;
}

.dvqr-investigation-status-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.dvqr-investigation-status-pill {
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  padding: 6px 10px;
}

.dvqr-outstanding-verification-list {
  display: grid;
  gap: 12px;
  margin: 0;
  padding: 0;
}

.dvqr-outstanding-verification-list li {
  background: color-mix(in srgb, var(--vscode-editor-background) 82%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-left: 3px solid color-mix(in srgb, var(--vscode-button-background) 35%, var(--vscode-panel-border));
  border-radius: 10px;
  display: grid;
  gap: 5px;
  list-style: none;
  padding: 12px;
}

.dvqr-outstanding-verification-list li span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-investigation-notes-placeholder {
  background: color-mix(in srgb, var(--vscode-editor-background) 84%, transparent);
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 12px;
}

.dvqr-investigation-notes-placeholder span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-operational-storyline {
  margin-top: 22px;
}

.dvqr-storyline-panel {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-button-background) 7%);
  border: 1px solid var(--vscode-panel-border);
  border-left: 4px solid var(--vscode-descriptionForeground);
  border-radius: 10px;
  display: grid;
  gap: 6px;
  line-height: 1.45;
  margin: 12px 0 14px;
  padding: 12px 14px;
}

.dvqr-storyline-panel p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  margin: 0;
}

.dvqr-consideration-grid {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
}

.dvqr-consideration-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px 14px;
}

.dvqr-consideration-card p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin-bottom: 10px;
}

.dvqr-consideration-card ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.dvqr-consideration-card li {
  display: grid;
  gap: 3px;
  list-style: none;
}

.dvqr-consideration-card li span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}



.dvqr-storyline-actions,
.dvqr-continuation-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dvqr-inline-investigation-action {
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  transition: background 120ms ease;
}

.dvqr-inline-investigation-action:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-investigation-continuations {
  margin-top: 22px;
}

.dvqr-continuation-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  margin-top: 14px;
}

.dvqr-continuation-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.dvqr-continuation-card p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.dvqr-continuation-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}


.dvqr-investigation-session-summary {
  display: grid;
  gap: 12px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 220px));
  margin: 14px 0 4px;
}

.dvqr-investigation-session-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px 14px;
}

.dvqr-investigation-session-value {
  color: var(--vscode-foreground);
  font-size: 22px;
  font-weight: 700;
  line-height: 1;
  margin-bottom: 6px;
}

.dvqr-investigation-session-label {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-review-state-row {
  margin-top: 12px;
}

.dvqr-review-toggle {
  background: transparent;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 6px 10px;
  transition: all 120ms ease;
}

.dvqr-review-toggle:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 12%, transparent);
  color: var(--vscode-foreground);
}

.dvqr-review-toggle.is-reviewed {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  border-color: color-mix(in srgb, var(--vscode-button-background) 40%, var(--vscode-panel-border));
  color: var(--vscode-foreground);
}

.dvqr-reviewable-surface.is-reviewed {
  border-color: color-mix(in srgb, var(--vscode-button-background) 26%, var(--vscode-panel-border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--vscode-button-background) 12%, transparent);
}

.dvqr-verification-checklist {
  margin-top: 22px;
}

.dvqr-verification-checklist-note {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-button-background) 7%);
  border: 1px solid var(--vscode-panel-border);
  border-left: 4px solid var(--vscode-descriptionForeground);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  line-height: 1.45;
  margin: 12px 0 14px;
  padding: 10px 12px;
}

.dvqr-verification-checklist-note span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-verification-checklist-grid {
  display: grid;
  gap: 12px;
}

.dvqr-verification-checklist-group {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 12px 14px;
}

.dvqr-verification-checklist-group h3 {
  margin-bottom: 5px;
}

.dvqr-verification-checklist-group p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin-bottom: 10px;
}

.dvqr-verification-checklist-group ul {
  display: grid;
  gap: 8px;
  margin: 0;
  padding: 0;
}

.dvqr-verification-checklist-group li {
  align-items: flex-start;
  display: grid;
  gap: 8px;
  grid-template-columns: auto minmax(0, 1fr);
  list-style: none;
}

.dvqr-verification-checkbox {
  color: var(--vscode-descriptionForeground);
  font-family: monospace;
  line-height: 1.45;
}

.dvqr-verification-checklist-group li em {
  color: var(--vscode-descriptionForeground);
  display: block;
  font-size: 12px;
  font-style: normal;
  margin-top: 2px;
}

.dvqr-empty {
  border-style: dashed;
}

.dvqr-empty-success {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, #2ea043 12%);
  border-color: color-mix(in srgb, var(--vscode-panel-border) 55%, #2ea043 45%);
}

.dvqr-empty-success h2 {
  color: color-mix(in srgb, var(--vscode-foreground) 75%, #2ea043 25%);
}


.dvqr-group-narrative {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  margin-top: 14px;
  padding: 12px 14px;
}

.dvqr-group-narrative p {
  margin-bottom: 8px;
}

.dvqr-group-narrative ul {
  color: var(--vscode-descriptionForeground);
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 880px) {
  .dvqr-hero-detail-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 720px) {
  .dvqr-comparison {
    padding: 18px;
  }

  .dvqr-search-nav-row {
    align-items: stretch;
    grid-template-columns: 1fr;
  }

  .dvqr-search-status {
    text-align: left;
  }


  .dvqr-hero-topline,
  .dvqr-group-header {
    display: block;
  }

  .dvqr-toolbar {
    justify-content: flex-start;
    margin-top: 12px;
  }

  .dvqr-summary-grid {
    grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  }
}



@media (max-width: 720px) {
  .dvqr-search-nav-row,
  .dvqr-search-input-wrap {
    grid-template-columns: 1fr;
  }

  .dvqr-search-actions {
    flex-wrap: wrap;
    justify-content: flex-start;
  }

  .dvqr-search-status,
  .dvqr-search-note {
    grid-column: auto;
    padding-left: 0;
    text-align: left;
    white-space: normal;
  }
}


.dvqr-investigation-status-pill-warning {
  border-color: color-mix(in srgb, #d9a441 45%, var(--vscode-panel-border));
  color: #f3c56d;
}

.dvqr-investigation-alert-value {
  color: #ffb86b;
}

.dvqr-investigation-review-banner {
  align-items: center;
  background: linear-gradient(
    180deg,
    color-mix(in srgb, var(--vscode-editorWidget-background) 88%, #11232e),
    color-mix(in srgb, var(--vscode-editor-background) 94%, #081017)
  );
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, #1f4658);
  border-left: 4px solid #d9a441;
  border-radius: 14px;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(320px, 1fr) 320px;
  margin: 18px 0 22px;
  padding: 18px;
}

.dvqr-investigation-review-banner-state {
  display: grid;
  gap: 8px;
}

.dvqr-investigation-review-banner-state strong {
  font-size: 16px;
}

.dvqr-investigation-review-banner-state span {
  color: var(--vscode-descriptionForeground);
  line-height: 1.5;
}

.dvqr-investigation-review-banner-progress {
  display: grid;
  gap: 8px;
}

.dvqr-investigation-review-progress-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-investigation-review-progress-track {
  background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  height: 12px;
  overflow: hidden;
}

.dvqr-investigation-review-progress-fill {
  background: linear-gradient(90deg, #d9a441, #4aa5d9);
  height: 100%;
}

.dvqr-investigation-review-progress-caption {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-continuation-review-action {
  border-color: color-mix(in srgb, #d9a441 35%, var(--vscode-panel-border));
}

@media (max-width: 900px) {
  .dvqr-investigation-review-banner {
    grid-template-columns: 1fr;
  }
}


.dvqr-investigation-phase-strip {
  align-items: center;
  display: flex;
  gap: 12px;
  margin: 0 0 18px;
  overflow-x: auto;
  padding: 4px 0;
}

.dvqr-investigation-phase-step {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 14px;
  display: flex;
  gap: 12px;
  min-width: 260px;
  padding: 14px 16px;
}

.dvqr-investigation-phase-step-active {
  border-color: color-mix(in srgb, #d9a441 55%, var(--vscode-panel-border));
  box-shadow: 0 0 0 1px color-mix(in srgb, #d9a441 25%, transparent);
}

.dvqr-investigation-phase-step-complete {
  border-color: color-mix(in srgb, #4aa5d9 40%, var(--vscode-panel-border));
}

.dvqr-investigation-phase-index {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editor-background) 85%, #18384d);
  border-radius: 999px;
  display: inline-flex;
  font-size: 12px;
  font-weight: 700;
  height: 28px;
  justify-content: center;
  min-width: 28px;
}

.dvqr-investigation-phase-copy {
  display: grid;
  gap: 4px;
}

.dvqr-investigation-phase-copy strong {
  font-size: 13px;
}

.dvqr-investigation-phase-copy span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-investigation-phase-connector {
  background: linear-gradient(90deg, transparent, var(--vscode-panel-border), transparent);
  height: 1px;
  min-width: 28px;
}



.dvqr-investigation-mode-surface {
  margin-top: 18px;
}

.dvqr-investigation-mode-tabs {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  margin-top: 14px;
}

.dvqr-investigation-mode-tab {
  align-items: flex-start;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  cursor: default;
  display: grid;
  gap: 5px;
  min-height: 76px;
  padding: 14px;
  text-align: left;
}

.dvqr-investigation-mode-tab strong {
  font-size: 13px;
}

.dvqr-investigation-mode-tab span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.4;
}

.dvqr-investigation-mode-tab-active {
  border-color: color-mix(in srgb, #4aa5d9 40%, var(--vscode-panel-border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #4aa5d9 18%, transparent);
}


.dvqr-workspace-focus-strip {
  display: grid;
  gap: 12px;
  grid-template-columns: 2fr 1fr 1fr;
  margin-top: 16px;
}

.dvqr-workspace-focus-card,
.dvqr-workspace-focus-mini {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 90%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.dvqr-workspace-focus-card-active {
  border-color: color-mix(in srgb, #d9a441 35%, var(--vscode-panel-border));
  box-shadow: inset 0 0 0 1px color-mix(in srgb, #d9a441 12%, transparent);
}

.dvqr-workspace-focus-card span,
.dvqr-workspace-focus-mini span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
}


/* Workstream 17: workspace readability + handoff readiness */
.dvqr-investigation-mode-tab {
  color: var(--vscode-foreground);
}

.dvqr-investigation-mode-tab strong,
.dvqr-investigation-mode-header strong {
  color: color-mix(in srgb, var(--vscode-foreground) 92%, var(--vscode-descriptionForeground));
}

.dvqr-investigation-mode-tab span {
  color: color-mix(in srgb, var(--vscode-descriptionForeground) 92%, var(--vscode-foreground) 8%);
}

.dvqr-investigation-mode-tab:not(.dvqr-investigation-mode-tab-active) {
  opacity: 1;
}

.dvqr-investigation-mode-tab:not(.dvqr-investigation-mode-tab-active):hover {
  border-color: color-mix(in srgb, var(--vscode-button-background) 22%, var(--vscode-panel-border));
}

.dvqr-handoff-readiness {
  margin-top: 22px;
}

.dvqr-handoff-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(320px, 1.4fr) minmax(240px, 1fr) minmax(240px, 1fr);
  margin-top: 14px;
}

.dvqr-handoff-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 10px;
  padding: 14px;
}

.dvqr-handoff-card-primary {
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 45%, var(--vscode-panel-border));
}

.dvqr-handoff-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-handoff-card h3 {
  margin-bottom: 0;
}

.dvqr-handoff-card p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

.dvqr-handoff-list {
  color: var(--vscode-descriptionForeground);
  display: grid;
  gap: 7px;
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
  padding-left: 18px;
}

@media (max-width: 920px) {
  .dvqr-handoff-grid {
    grid-template-columns: 1fr;
  }
}


/* Workstream 18: interactive workspace navigation */
html {
  scroll-behavior: smooth;
}

.dvqr-investigation-mode-tab {
  color: var(--vscode-foreground);
  text-decoration: none;
}

.dvqr-investigation-mode-tab:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 10%, var(--vscode-editorWidget-background));
  border-color: color-mix(in srgb, var(--vscode-button-background) 30%, var(--vscode-panel-border));
}

.dvqr-inline-investigation-action {
  display: inline-flex;
  text-decoration: none;
}

.dvqr-focus-pulse {
  animation: dvqr-focus-pulse 1500ms ease-out 1;
  outline: 1px solid color-mix(in srgb, var(--vscode-button-background) 55%, transparent);
  outline-offset: 3px;
}

@keyframes dvqr-focus-pulse {
  0% {
    box-shadow: 0 0 0 0 color-mix(in srgb, var(--vscode-button-background) 45%, transparent);
  }
  45% {
    box-shadow: 0 0 0 5px color-mix(in srgb, var(--vscode-button-background) 20%, transparent);
  }
  100% {
    box-shadow: 0 0 0 0 transparent;
  }
}


/* Workstream 19: stateful investigation workspace modes */
.dvqr-workspace-state-strip {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-button-background) 6%);
  border: 1px solid var(--vscode-panel-border);
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 45%, var(--vscode-panel-border));
  border-radius: 12px;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(160px, 0.7fr) minmax(260px, 1.5fr) minmax(240px, 1fr);
  margin-top: 14px;
  padding: 12px 14px;
}

.dvqr-workspace-state-strip > div {
  display: grid;
  gap: 4px;
}

.dvqr-workspace-state-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-workspace-state-strip span:not(.dvqr-workspace-state-label) {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-mode-hidden {
  display: none !important;
}

.dvqr-investigation-mode-tab {
  cursor: pointer;
}

body[data-active-workspace-mode="findings"] .dvqr-investigation-mode-surface,
body[data-active-workspace-mode="verification"] .dvqr-investigation-mode-surface,
body[data-active-workspace-mode="handoff"] .dvqr-investigation-mode-surface,
body[data-active-workspace-mode="investigation"] .dvqr-investigation-mode-surface {
  position: sticky;
  top: 0;
  z-index: 4;
}

@media (max-width: 900px) {
  .dvqr-workspace-state-strip {
    grid-template-columns: 1fr;
  }
}


/* Workstream 20: pre-investigation baseline export */
.dvqr-action-button-primary,
.dvqr-baseline-export-button {
  background: color-mix(in srgb, var(--vscode-button-background) 82%, #2ea043 18%);
  color: var(--vscode-button-foreground);
}

.dvqr-action-button-primary:hover,
.dvqr-baseline-export-button:hover {
  background: var(--vscode-button-hoverBackground);
}

.dvqr-action-button-primary.is-exported,
.dvqr-baseline-export-button.is-exported {
  background: color-mix(in srgb, #2ea043 34%, var(--vscode-button-secondaryBackground));
  border-color: color-mix(in srgb, #2ea043 45%, var(--vscode-button-border));
}

.dvqr-baseline-export-status {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-testing-iconQueued) 7%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, var(--vscode-testing-iconQueued) 30%);
  border-left: 4px solid var(--vscode-testing-iconQueued);
  border-radius: 12px;
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(0, 1fr) auto;
  margin: 14px 0 16px;
  padding: 12px 14px;
}

.dvqr-baseline-export-label {
  color: var(--vscode-descriptionForeground);
  display: block;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

.dvqr-baseline-export-status strong {
  display: block;
  margin-bottom: 4px;
}

.dvqr-baseline-export-status p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
  margin: 0;
}

.dvqr-baseline-export-button {
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 8px;
  cursor: pointer;
  font: inherit;
  padding: 7px 12px;
  white-space: nowrap;
}

.dvqr-baseline-session-note {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-testing-iconQueued) 7%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, var(--vscode-testing-iconQueued) 30%);
  border-radius: 10px;
  display: grid;
  gap: 4px;
  padding: 10px 12px;
}

.dvqr-baseline-session-note.is-exported {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 84%, #2ea043 9%);
  border-color: color-mix(in srgb, var(--vscode-panel-border) 62%, #2ea043 38%);
}

.dvqr-baseline-session-note span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

@media (max-width: 720px) {
  .dvqr-baseline-export-status {
    grid-template-columns: 1fr;
  }

  .dvqr-baseline-export-button {
    justify-self: start;
  }
}


.dvqr-baseline-toolbar {
  justify-content: flex-start;
  margin: 8px 0 12px;
}


/* Workstream 21 retry: functional modes without layout drift */
.dvqr-mode-content-summary {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 84%, var(--vscode-button-background) 6%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 76%, var(--vscode-button-background) 24%);
  border-radius: 12px;
  display: grid;
  gap: 5px;
  margin-top: 14px;
  padding: 12px 14px;
}

.dvqr-mode-content-summary strong {
  color: var(--vscode-foreground);
}

.dvqr-mode-content-summary span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.45;
}

.dvqr-investigation-mode-tab {
  font: inherit;
  min-height: 76px;
}

.dvqr-mode-hidden {
  display: none !important;
}

.dvqr-findings-mode {
  margin-top: 22px;
}

.dvqr-operational-storyline .dvqr-consideration-grid {
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
}

body[data-active-workspace-mode] .dvqr-investigation-mode-surface {
  position: sticky;
  top: 0;
  z-index: 4;
}

@media (max-width: 860px) {
  .dvqr-operational-storyline .dvqr-consideration-grid {
    grid-template-columns: 1fr;
  }
}




/* Workstream 21 structural order fix: selector first, mode body after */
.dvqr-investigation-mode-surface {
  margin-bottom: 22px;
}

.dvqr-findings-mode {
  margin-top: 22px;
}

body[data-active-workspace-mode="investigation"] #dvqr-findings-mode,
body[data-active-workspace-mode="verification"] #dvqr-findings-mode,
body[data-active-workspace-mode="handoff"] #dvqr-findings-mode {
  display: none !important;
}

body[data-active-workspace-mode="findings"] #dvqr-findings-mode {
  display: block !important;
}

body[data-active-workspace-mode="findings"] .dvqr-top-signals {
  display: block !important;
}

body[data-active-workspace-mode="verification"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness {
  display: block !important;
}


/* Workstream 21 refinement: investigation observation/storyline body */
.dvqr-investigation-observation-briefing {
  margin-top: 22px;
}

.dvqr-observation-briefing-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(320px, 1.35fr) repeat(2, minmax(220px, 1fr));
  margin-top: 14px;
}

.dvqr-observation-briefing-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.dvqr-observation-briefing-card-primary {
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 45%, var(--vscode-panel-border));
}

.dvqr-observation-briefing-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-observation-briefing-card strong {
  color: var(--vscode-foreground);
  font-size: 14px;
}

.dvqr-observation-briefing-card p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

body[data-active-workspace-mode="investigation"] .dvqr-investigation-observation-briefing,
body[data-active-workspace-mode="investigation"] #dvqr-investigation-session,
body[data-active-workspace-mode="investigation"] #dvqr-operational-storyline,
body[data-active-workspace-mode="investigation"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="investigation"] .dvqr-top-signals {
  display: block !important;
}

@media (max-width: 960px) {
  .dvqr-observation-briefing-grid {
    grid-template-columns: 1fr;
  }
}


/* Workstream 21 HTML integrity fix: prevent mode contamination */
body[data-active-workspace-mode="findings"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="verification"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="investigation"] #dvqr-handoff-readiness {
  display: none !important;
}

body[data-active-workspace-mode="findings"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-verification-checklist,
body[data-active-workspace-mode="investigation"] #dvqr-verification-checklist {
  display: none !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-operational-storyline,
body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="verification"] #dvqr-verification-checklist {
  display: block !important;
}


/* Workstream 21 final mode behaviour fix */
body[data-active-workspace-mode="verification"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="verification"] #dvqr-verification-checklist {
  display: block !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness {
  display: block !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-operational-storyline,
body[data-active-workspace-mode="handoff"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="verification"] #dvqr-operational-storyline,
body[data-active-workspace-mode="verification"] #dvqr-handoff-readiness {
  display: none !important;
}


/* Workstream 22: session-local investigation state */
.dvqr-verification-checkbox {
  background: transparent;
  border: 0;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font: inherit;
  font-family: monospace;
  line-height: 1.45;
  padding: 0;
}

.dvqr-verification-checkbox:hover {
  color: var(--vscode-foreground);
}

.dvqr-verification-checkbox.is-reviewed {
  color: color-mix(in srgb, #2ea043 78%, var(--vscode-foreground));
}

.dvqr-verification-checklist-group li.is-reviewed {
  opacity: 0.78;
}

.dvqr-verification-checklist-group li.is-reviewed strong {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}


/* Workstream 24: evidence status and reviewer notes */
.dvqr-verification-item-body {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.dvqr-verification-review-controls {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 84%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 240px) minmax(260px, 1fr);
  margin-top: 6px;
  padding: 10px;
}

.dvqr-verification-review-controls label {
  display: grid;
  gap: 4px;
}

.dvqr-verification-review-controls label > span {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dvqr-verification-status-select,
.dvqr-verification-note {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 8px;
  color: var(--vscode-foreground);
  font: inherit;
  padding: 7px 9px;
}

.dvqr-verification-note {
  min-height: 44px;
  resize: vertical;
}

.dvqr-verification-checklist-group li[data-review-status="VerifiedExternally"] {
  border-left: 3px solid color-mix(in srgb, #2ea043 68%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="RecheckedCurrent"] {
  border-left: 3px solid color-mix(in srgb, #4aa5d9 68%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="ResolvedOutsideDvqr"] {
  border-left: 3px solid color-mix(in srgb, #7ee787 60%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="NeedsFollowUp"] {
  border-left: 3px solid color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-handoff-review-summary {
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  padding-top: 10px;
}

.dvqr-handoff-review-summary span {
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  padding: 4px 8px;
}

.dvqr-handoff-review-summary strong {
  color: var(--vscode-foreground);
}

@media (max-width: 760px) {
  .dvqr-verification-review-controls {
    grid-template-columns: 1fr;
  }
}


/* Workstream 25: review-aware evidence surfaces */
.dvqr-review-aware-surface {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.dvqr-review-pill {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  font-size: 11px;
  font-weight: 600;
  gap: 6px;
  padding: 4px 10px;
}

.dvqr-review-pill strong {
  color: var(--vscode-foreground);
}

.dvqr-review-pill[data-review-status="VerifiedExternally"] {
  border-color: color-mix(in srgb, #2ea043 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="RecheckedCurrent"] {
  border-color: color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="ResolvedOutsideDvqr"] {
  border-color: color-mix(in srgb, #7ee787 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="NeedsFollowUp"] {
  border-color: color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
}


/* Workstream 25 fix: reflected review posture spacing */
.dvqr-difference-card > .dvqr-review-aware-surface,
.dvqr-difference-body > .dvqr-review-aware-surface {
  border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
  margin: 14px 18px 16px;
  padding-top: 12px;
}

.dvqr-top-signals a > .dvqr-review-aware-surface {
  margin-top: 10px;
  padding-top: 8px;
}

.dvqr-review-aware-surface {
  row-gap: 8px;
}

.dvqr-review-pill {
  line-height: 1.45;
  max-width: 100%;
}

.dvqr-review-pill strong {
  margin-right: 2px;
}


/* Workstream 25 fix: dynamic outstanding/posture states */
.dvqr-investigation-status-pill-success {
  border-color: color-mix(in srgb, #2ea043 72%, var(--vscode-panel-border));
  color: color-mix(in srgb, #7ee787 78%, var(--vscode-foreground));
}

.dvqr-outstanding-verification-list li[data-review-status="NeedsFollowUp"] {
  border-left-color: color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
}

.dvqr-outstanding-verification-resolved {
  border-left-color: color-mix(in srgb, #2ea043 70%, var(--vscode-panel-border)) !important;
}


/* Workstream 26: inline evidence context */
.dvqr-evidence-item {
  align-items: flex-start;
  display: grid !important;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.dvqr-evidence-continuation-pill {
  background: transparent;
  cursor: pointer;
}

.dvqr-evidence-continuation-pill.is-active {
  border-color: color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
  color: var(--vscode-foreground);
}

.dvqr-inline-evidence-context {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-left: 3px solid color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: grid;
  gap: 8px;
  grid-column: 1 / -1;
  margin-top: 4px;
  padding: 10px 12px;
}

.dvqr-inline-evidence-context[hidden] {
  display: none !important;
}

.dvqr-inline-evidence-context strong {
  color: var(--vscode-foreground);
}

.dvqr-inline-evidence-context dl {
  display: grid;
  gap: 6px;
  grid-template-columns: max-content minmax(0, 1fr);
  margin: 0;
}

.dvqr-inline-evidence-context dt {
  color: var(--vscode-descriptionForeground);
  font-weight: 700;
}

.dvqr-inline-evidence-context dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}


/* Workstream 26 fix: visible reset confirmation */
.dvqr-reset-review-notice {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, #2ea043 10%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 62%, #2ea043 38%);
  border-left: 4px solid color-mix(in srgb, #2ea043 76%, var(--vscode-panel-border));
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: none;
  font-size: 12px;
  line-height: 1.45;
  margin: 12px 0 0;
  padding: 10px 12px;
}

.dvqr-reset-review-notice.is-visible {
  display: block;
}


/* Workstream 26 fix: in-page reset confirmation */
.dvqr-reset-review-confirmation {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-testing-iconQueued) 8%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 62%, var(--vscode-testing-iconQueued) 38%);
  border-left: 4px solid color-mix(in srgb, var(--vscode-testing-iconQueued) 76%, var(--vscode-panel-border));
  border-radius: 10px;
  display: none;
  gap: 8px;
  line-height: 1.45;
  margin: 12px 0 0;
  padding: 12px;
}

.dvqr-reset-review-confirmation.is-visible {
  display: grid;
}

.dvqr-reset-review-confirmation span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-reset-review-confirmation div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}


/* Workstream 27: evidence pivot host contract */
.dvqr-inline-evidence-context [data-evidence-live-result] {
  color: var(--vscode-descriptionForeground);
}

.dvqr-inline-evidence-context [data-evidence-live-result].is-available {
  color: color-mix(in srgb, #7ee787 78%, var(--vscode-foreground));
}

.dvqr-inline-evidence-context [data-evidence-live-result].is-unavailable {
  color: color-mix(in srgb, var(--vscode-testing-iconQueued) 70%, var(--vscode-descriptionForeground));
}


/* Workstream 28: live evidence pivot preview polish */
.dvqr-inline-evidence-context [data-evidence-live-result].is-available {
  font-weight: 600;
}


.dvqr-inline-evidence-context [data-evidence-live-result].is-error {
  color: color-mix(in srgb, var(--vscode-errorForeground) 78%, var(--vscode-descriptionForeground));
}


.dvqr-classified-drift-evidence-item {
  align-items: flex-start;
  gap: 8px;
}

.dvqr-classified-drift-evidence-item .dvqr-inline-evidence-context {
  margin-left: 0;
}

.dvqr-live-pivot-timeout {
  color: var(--vscode-testing-iconQueued);
}


.dvqr-inline-evidence-context dd.is-available {
  color: color-mix(in srgb, #2ea043 82%, var(--vscode-foreground));
}

.dvqr-inline-evidence-context dd.is-unavailable {
  color: var(--vscode-testing-iconQueued);
}

.dvqr-inline-evidence-context dd.is-error,
.dvqr-live-pivot-timeout {
  color: var(--vscode-errorForeground);
}

.dvqr-community-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin: 18px 4px 4px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}
.dvqr-community-footer a {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
}
.dvqr-community-footer a:hover {
  text-decoration: underline;
}
`;
}
