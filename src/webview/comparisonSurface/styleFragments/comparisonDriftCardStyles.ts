export const comparisonDriftCardStyles = `
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



`;
