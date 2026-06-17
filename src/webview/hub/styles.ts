export function getDvQuickRunHubStyles(): string {
  return `
:root {
  color-scheme: light dark;
}

body {
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  color: var(--vscode-foreground);
  background: var(--vscode-editor-background);
  margin: 0;
  padding: 0;
}

.dvqr-hub {
  max-width: 1280px;
  margin: 0 auto;
  padding: 28px;
}

.dvqr-hero {
  align-items: center;
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: flex;
  gap: 24px;
  justify-content: space-between;
  padding: 22px;
}

.dvqr-hero-copy {
  min-width: 0;
}

.dvqr-hero-icon-frame {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-editor-background) 70%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 20px;
  display: flex;
  flex: 0 0 auto;
  height: 128px;
  justify-content: center;
  opacity: 0.95;
  width: 128px;
}

.dvqr-hero-icon {
  display: block;
  height: 118px;
  object-fit: contain;
  width: 118px;
}

.dvqr-eyebrow {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 8px;
}

h1, h2, h3, p {
  margin-top: 0;
}

h1 {
  font-size: 28px;
  margin-bottom: 8px;
}

h2 {
  font-size: 21px;
  margin: 28px 0 12px;
}

h3 {
  font-size: 16px;
  margin-bottom: 8px;
}

.dvqr-subtitle, .dvqr-muted {
  color: var(--vscode-descriptionForeground);
}

.dvqr-nav {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 16px;
}

.dvqr-supporter-badges {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.dvqr-supporter-badge {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  font-size: 12px;
  letter-spacing: 0.01em;
  padding: 4px 10px;
}

.dvqr-chip, .dvqr-status {
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  padding: 4px 9px;
  font-size: 12px;
  color: var(--vscode-foreground);
  text-decoration: none;
}

.dvqr-section-note {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 14px;
}

.dvqr-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
  gap: 16px;
}

.dvqr-playbook-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
  align-items: start;
}

.dvqr-direction-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 16px;
  align-items: start;
}

.dvqr-capability-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
  align-items: start;
}

.dvqr-ecosystem-handoff {
  margin-top: 20px;
}

.dvqr-playbook-card {
  padding: 18px;
}

@media (max-width: 980px) {
  .dvqr-playbook-grid,
  .dvqr-direction-grid {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 520px) {
  .dvqr-hub {
    padding: 8px;
  }

  .dvqr-hero {
    align-items: flex-start;
  }

  .dvqr-hero-icon-frame {
    display: none;
  }

  .dvqr-grid,
  .dvqr-capability-grid {
    grid-template-columns: 1fr;
  }
}

.dvqr-access-context-card {
  align-items: center;
  display: flex;
  gap: 18px;
  justify-content: space-between;
}

.dvqr-access-context-card p {
  color: var(--vscode-descriptionForeground);
  margin-bottom: 0;
}

.dvqr-access-context-card .dvqr-action-button {
  flex: 0 0 auto;
}

@media (max-width: 720px) {
  .dvqr-access-context-card {
    align-items: flex-start;
    flex-direction: column;
  }
}


.dvqr-evidence-workspace-card {
  align-items: flex-start;
  display: grid;
  gap: 18px;
  grid-template-columns: minmax(0, 1fr) minmax(260px, 340px);
}

.dvqr-evidence-workspace-card p {
  color: var(--vscode-descriptionForeground);
}

.dvqr-evidence-actions {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
}

.dvqr-evidence-actions .dvqr-action-button {
  justify-content: center;
  width: 100%;
}

@media (max-width: 840px) {
  .dvqr-evidence-workspace-card {
    grid-template-columns: 1fr;
  }
}

.dvqr-card {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 14px;
  background: var(--vscode-editorWidget-background);
}

.dvqr-card p:last-child, .dvqr-card ul:last-child, .dvqr-card ol:last-child {
  margin-bottom: 0;
}

.dvqr-flow {
  padding-left: 20px;
}

.dvqr-flow li {
  margin-bottom: 10px;
}

.dvqr-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.dvqr-card-muted {
  border-style: dashed;
  opacity: 0.92;
}

.dvqr-context-card h3 {
  margin-bottom: 6px;
}

.dvqr-trust-state {
  align-items: flex-start;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 10px 0 12px;
  padding: 8px 10px;
}

.dvqr-trust-state span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-trust-state-active {
  border-color: color-mix(in srgb, var(--vscode-testing-iconPassed, #3fb950) 35%, var(--vscode-panel-border));
}

.dvqr-trust-state-recoverable,
.dvqr-trust-state-historical {
  border-color: color-mix(in srgb, var(--vscode-charts-yellow, #d29922) 35%, var(--vscode-panel-border));
}

.dvqr-trust-state-stale {
  border-color: color-mix(in srgb, var(--vscode-errorForeground, #f85149) 35%, var(--vscode-panel-border));
}


.dvqr-context-list {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin: 12px 0;
}

.dvqr-context-list div {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 8px 10px;
}

.dvqr-context-list dt {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  margin-bottom: 3px;
  text-transform: uppercase;
}

.dvqr-context-list dd {
  margin: 0;
}

.dvqr-context-hint {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  margin: 8px 0;
}

.dvqr-context-state {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  padding: 4px 9px;
}

.dvqr-context-state-launchable,
.dvqr-context-state-availableInContext {
  color: var(--vscode-foreground);
}


.dvqr-group {
  margin-bottom: 18px;
}

.dvqr-list {
  padding-left: 18px;
}

.dvqr-command {
  font-family: var(--vscode-editor-font-family);
  font-size: 12px;
  color: var(--vscode-textLink-foreground);
}
.dvqr-how-to {
  margin: 12px 0;
  color: var(--vscode-descriptionForeground);
}

.dvqr-how-to strong {
  color: var(--vscode-foreground);
}

.dvqr-how-to ol {
  margin: 8px 0 0 20px;
  padding: 0;
}

.dvqr-how-to li {
  margin: 4px 0;
}

.dvqr-launch-note {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  margin: 8px 0;
}

.dvqr-action-button {
  align-items: center;
  background: var(--vscode-button-background);
  border: 1px solid color-mix(in srgb, var(--vscode-button-background) 70%, var(--vscode-button-border, var(--vscode-panel-border)));
  border-radius: 999px;
  color: var(--vscode-button-foreground);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  letter-spacing: 0.01em;
  min-height: 26px;
  padding: 5px 12px;
  text-decoration: none;
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-button-background) 18%, transparent);
}

.dvqr-action-button::after {
  content: "→";
  font-size: 12px;
  opacity: 0.85;
}

.dvqr-action-button:hover {
  background: var(--vscode-button-hoverBackground);
  border-color: color-mix(in srgb, var(--vscode-button-hoverBackground) 80%, var(--vscode-focusBorder));
  box-shadow: 0 0 0 1px color-mix(in srgb, var(--vscode-focusBorder) 32%, transparent);
}

.dvqr-action-button:focus-visible {
  outline: 1px solid var(--vscode-focusBorder);
  outline-offset: 2px;
}

.dvqr-meta .dvqr-action-button {
  margin-left: 4px;
}

.dvqr-flow .dvqr-action-button {
  margin-top: 6px;
}

.dvqr-continuation-actions {
  margin: 14px 0 10px;
}

.dvqr-continuation-actions h4 {
  margin: 0 0 8px;
}

.dvqr-continuation-action {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  margin-bottom: 8px;
  padding: 10px;
}

.dvqr-continuation-action-header {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
}

.dvqr-continuation-action-header .dvqr-action-button {
  flex: 0 0 auto;
}

.dvqr-continuation-action p {
  color: var(--vscode-descriptionForeground);
  margin: 4px 0 8px;
}

`;
}
