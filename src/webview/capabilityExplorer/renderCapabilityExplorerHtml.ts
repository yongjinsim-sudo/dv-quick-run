import * as vscode from "vscode";
import type { CapabilityExplorerViewModel } from "../../capabilityExplorer/capabilityExplorerTypes.js";
import { getCapabilityExplorerMarkup } from "./markup.js";
import { getCapabilityExplorerScript } from "./script.js";
import { getCapabilityExplorerStyles } from "./styles.js";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";

  for (let index = 0; index < 32; index += 1) {
    nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return nonce;
}

function toScriptJson(model: CapabilityExplorerViewModel): string {
  return JSON.stringify(model).replace(/</g, "\\u003c");
}

export function renderCapabilityExplorerHtml(
  webview: vscode.Webview,
  model: CapabilityExplorerViewModel
): string {
  const nonce = getNonce();
  const cspSource = webview.cspSource;
  const modelJson = toScriptJson(model);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} https: data:; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Capability Explorer</title>
  <style>${getCapabilityExplorerStyles()}</style>
</head>
<body>
  ${getCapabilityExplorerMarkup(model)}
  <script nonce="${nonce}">${getCapabilityExplorerScript(modelJson)}</script>
</body>
</html>`;
}
