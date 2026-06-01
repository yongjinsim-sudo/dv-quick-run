export const searchNavigationStyles = `.dvqr-search-nav {
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
`;
