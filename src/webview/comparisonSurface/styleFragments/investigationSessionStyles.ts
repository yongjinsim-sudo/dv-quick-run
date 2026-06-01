export const investigationSessionStyles = `.dvqr-investigation-session {
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


`;
