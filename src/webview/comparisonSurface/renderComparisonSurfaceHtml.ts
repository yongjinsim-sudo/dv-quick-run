import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { getComparisonSurfaceMarkup } from "./markup.js";
import { getComparisonSurfaceStyles } from "./styles.js";

function getComparisonSurfaceScript(): string {
  return `
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;

  document.querySelectorAll('[data-export-kind]').forEach((button) => {
    button.addEventListener('click', () => {
      const kind = button.getAttribute('data-export-kind');
      if (vscode && kind) {
        vscode.postMessage({ type: 'saveComparison', kind });
      }
    });
  });

  function activateTab(filter) {
    document.querySelectorAll('[data-group-filter]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-group-filter') === filter);
    });

    document.querySelectorAll('[data-group-id]').forEach((card) => {
      const show = filter === 'all' || card.getAttribute('data-group-id') === filter;
      card.classList.toggle('is-hidden', !show);
    });
  }

  document.querySelectorAll('[data-group-filter]').forEach((tab) => {
    tab.addEventListener('click', () => {
      activateTab(tab.getAttribute('data-group-filter') || 'all');
    });
  });
})();`;
}

export function renderComparisonSurfaceHtml(
  webview: vscode.Webview,
  model: ComparisonViewModel,
  options: { readonly canExport?: boolean; readonly isProPreview?: boolean } = {}
): string {
  const cspSource = webview.cspSource;
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${model.title.startsWith("Timeline Diff") ? "DV Quick Run Timeline Diff" : "DV Quick Run Cross-Environment Diff"}</title>
  <style>${getComparisonSurfaceStyles()}</style>
</head>
<body>
  ${getComparisonSurfaceMarkup(model, options)}
  <script nonce="${nonce}">${getComparisonSurfaceScript()}</script>
</body>
</html>`;
}

export function renderStandaloneComparisonSurfaceHtml(model: ComparisonViewModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${model.title.startsWith("Timeline Diff") ? "DV Quick Run Timeline Diff" : "DV Quick Run Cross-Environment Diff"}</title>
  <style>${getComparisonSurfaceStyles()}</style>
</head>
<body>
  ${getComparisonSurfaceMarkup(model)}
  <script>${getComparisonSurfaceScript().replace(/vscode\.postMessage\(\{ type: 'saveComparison', kind \}\);/g, "")}</script>
</body>
</html>`;
}
