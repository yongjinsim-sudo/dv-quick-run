import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { getComparisonSurfaceMarkup } from "./markup.js";
import { getComparisonSurfaceStyles } from "./styles.js";
import { getComparisonSurfaceScript } from "./comparisonSurfaceScript.js";
import {
  extractRenderedVerificationItemIds,
  sanitizeComparisonInvestigationStateForRenderedVerificationItems
} from "./comparisonInvestigationStateSanitizer.js";

export { sanitizeComparisonInvestigationStateForRenderedVerificationItems } from "./comparisonInvestigationStateSanitizer.js";
export function renderComparisonSurfaceHtml(
  webview: vscode.Webview,
  model: ComparisonViewModel,
  options: { readonly canExport?: boolean; readonly isProPreview?: boolean; readonly investigationState?: unknown } = {}
): string {
  const cspSource = webview.cspSource;
  const nonce = String(Date.now());
  const markup = getComparisonSurfaceMarkup(model, options);
  const investigationState = sanitizeComparisonInvestigationStateForRenderedVerificationItems(
    options.investigationState,
    extractRenderedVerificationItemIds(markup)
  );

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
  ${markup}
  <script nonce="${nonce}">${getComparisonSurfaceScript(investigationState)}</script>
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


// workstream25ReviewAwareSurfaces
// Review posture is now designed to flow back into:
// - findings surfaces
// - provider drift cards
// - investigation storyline
// - handoff summaries
// while preserving evidence immutability semantics.
