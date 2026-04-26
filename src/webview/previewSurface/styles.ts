export function getPreviewSurfaceStyles(): string {
  return `
    :root {
      color-scheme: light dark;
    }

    body {
      margin: 0;
      padding: 0;
      font-family: var(--vscode-font-family);
      color: var(--vscode-editor-foreground);
      background: var(--vscode-editor-background);
    }

    .preview-shell {
      padding: 18px 22px 24px;
      max-width: 1120px;
    }

    .preview-header {
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 14px 16px;
      background: var(--vscode-sideBar-background);
      margin-bottom: 16px;
    }

    .preview-title-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 8px;
    }

    .preview-title {
      margin: 0;
      font-size: 18px;
      font-weight: 700;
    }

    .preview-pill {
      border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
      border-radius: 999px;
      padding: 2px 8px;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      opacity: 0.9;
    }

    .preview-meta {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px 14px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
    }

    .preview-meta strong {
      color: var(--vscode-editor-foreground);
      font-weight: 600;
    }

    .risk-normal,
    .risk-amber,
    .risk-red {
      border-left: 5px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 10px 12px;
      margin: 12px 0 16px;
      background: var(--vscode-textBlockQuote-background);
    }

    .risk-amber {
      border-left-color: #d97706;
    }

    .risk-red {
      border-left-color: #dc2626;
    }

    .preview-summary {
      margin: 0 0 16px;
      color: var(--vscode-editor-foreground);
      line-height: 1.5;
    }

    .preview-section {
      margin: 14px 0;
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      overflow: hidden;
      background: var(--vscode-editor-background);
    }

    .preview-section h2 {
      margin: 0;
      padding: 10px 12px;
      font-size: 13px;
      background: var(--vscode-sideBar-background);
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    pre {
      margin: 0;
      padding: 12px;
      overflow: auto;
      white-space: pre-wrap;
      word-break: break-word;
      font-family: var(--vscode-editor-font-family);
      font-size: var(--vscode-editor-font-size);
      line-height: 1.45;
    }

    .preview-actions {
      position: sticky;
      bottom: 0;
      display: flex;
      gap: 8px;
      align-items: center;
      justify-content: flex-end;
      padding: 12px 0 0;
      margin-top: 18px;
      background: var(--vscode-editor-background);
      border-top: 1px solid var(--vscode-panel-border);
    }

    button {
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      color: var(--vscode-button-foreground);
      background: var(--vscode-button-background);
      cursor: pointer;
      font-family: var(--vscode-font-family);
    }

    button:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }

    button.secondary {
      color: var(--vscode-button-secondaryForeground);
      background: var(--vscode-button-secondaryBackground);
    }

    button.secondary:hover:not(:disabled) {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    button:disabled {
      opacity: 0.45;
      cursor: not-allowed;
    }
  `;
}
