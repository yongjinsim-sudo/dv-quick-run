export const workspaceModeStyles = `/* Workstream 17: workspace readability + handoff readiness */
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




`;
