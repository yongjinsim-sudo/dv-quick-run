import type { TimelineReconstruction } from "../../pro/timeline/index.js";
import { getTimelineSurfaceMarkup, getTimelineSurfaceScript } from "./markup.js";
import { getTimelineSurfaceStyles } from "./styles.js";

export interface TimelineSurfaceWebviewLike {
  readonly cspSource: string;
}

export function renderTimelineSurfaceHtml(
  webview: TimelineSurfaceWebviewLike,
  timeline: TimelineReconstruction
): string {
  const nonce = String(Date.now());

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run Operational Timeline Reconstruction</title>
  <style>${getTimelineSurfaceStyles()}</style>
</head>
<body data-nonce="${nonce}">
  ${getTimelineSurfaceMarkup(timeline)}
  <script nonce="${nonce}">${getTimelineSurfaceScript()}</script>
</body>
</html>`;
}

export function renderStandaloneTimelineSurfaceHtml(timeline: TimelineReconstruction): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run Operational Timeline Reconstruction</title>
  <style>${getTimelineSurfaceStyles()}</style>
</head>
<body>
  ${getTimelineSurfaceMarkup(timeline)}
</body>
</html>`;
}
