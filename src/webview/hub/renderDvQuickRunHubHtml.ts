import * as vscode from "vscode";
import type { DvQuickRunHubViewModel } from "../../commands/hub/dvQuickRunHubTypes.js";
import { getDvQuickRunHubMarkup } from "./markup.js";
import { getDvQuickRunHubScript } from "./script.js";
import { getDvQuickRunHubStyles } from "./styles.js";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}

export function renderDvQuickRunHubHtml(
  webview: vscode.Webview,
  model: DvQuickRunHubViewModel,
  iconUri?: vscode.Uri
): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run Hub</title>
  <style>${getDvQuickRunHubStyles()}</style>
</head>
<body>
  ${getDvQuickRunHubMarkup(model, iconUri?.toString())}
  <script nonce="${nonce}">${getDvQuickRunHubScript()}</script>
</body>
</html>`;
}
