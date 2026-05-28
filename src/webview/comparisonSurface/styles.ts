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

.dvqr-tabbar {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editor-background) 88%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 18px;
  padding: 8px;
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
  border-radius: 10px;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin: 14px 0 10px;
  padding: 8px;
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

.dvqr-nearby-drift a {
  color: var(--vscode-textLink-foreground, var(--vscode-button-background));
  font-weight: 700;
  text-decoration: none;
}

.dvqr-nearby-drift a:hover {
  text-decoration: underline;
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
