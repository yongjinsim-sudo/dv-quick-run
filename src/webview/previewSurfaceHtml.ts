import * as vscode from "vscode";
import type { PreviewSurfaceModel } from "../services/previewSurfaceTypes.js";
import { getPreviewSurfaceMarkup } from "./previewSurface/markup.js";
import { getPreviewSurfaceScript } from "./previewSurface/script.js";
import { getPreviewSurfaceStyles } from "./previewSurface/styles.js";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}

export function getPreviewSurfaceHtml(webview: vscode.Webview, model: PreviewSurfaceModel): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run – Preview</title>
  <style>${getPreviewSurfaceStyles()}</style>
</head>
<body>
  ${getPreviewSurfaceMarkup(model)}
  <script nonce="${nonce}">${getPreviewSurfaceScript()}</script>
</body>
</html>`;
}
