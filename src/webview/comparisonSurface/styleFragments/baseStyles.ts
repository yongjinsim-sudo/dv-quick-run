export const baseStyles = `
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

.dvqr-report-menu {
  position: relative;
}

.dvqr-report-menu[open] .dvqr-report-menu-trigger,
.dvqr-report-menu-trigger:hover {
  background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
}

.dvqr-report-menu-trigger {
  display: inline-block;
  list-style: none;
}

.dvqr-report-menu-trigger::-webkit-details-marker {
  display: none;
}

.dvqr-report-menu-panel {
  background: var(--vscode-dropdown-background, var(--vscode-editorWidget-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.28);
  display: grid;
  gap: 4px;
  min-width: 260px;
  padding: 10px;
  position: absolute;
  right: 0;
  top: calc(100% + 6px);
  z-index: 20;
}

.dvqr-report-menu-heading {
  color: var(--vscode-descriptionForeground);
  display: block;
  font-size: 0.75rem;
  letter-spacing: 0.08em;
  padding: 4px 6px 6px;
  text-transform: uppercase;
}

.dvqr-report-menu-item {
  align-items: center;
  background: transparent;
  border: 0;
  border-radius: 6px;
  color: var(--vscode-foreground);
  cursor: pointer;
  display: flex;
  font: inherit;
  gap: 16px;
  justify-content: space-between;
  padding: 7px 8px;
  text-align: left;
}

.dvqr-report-menu-item:hover,
.dvqr-report-menu-item:focus {
  background: var(--vscode-list-hoverBackground, var(--vscode-button-secondaryHoverBackground));
  outline: none;
}

.dvqr-report-menu-item span {
  color: var(--vscode-descriptionForeground);
  font-size: 0.85em;
}


`;
