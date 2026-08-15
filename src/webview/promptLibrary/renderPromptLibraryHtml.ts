import * as vscode from "vscode";
import type { PromptLibraryViewModel } from "../../commands/promptLibrary/promptLibraryViewModel.js";
import { getPromptLibraryMarkup } from "./markup.js";
import { getPromptLibraryScript } from "./script.js";
import { getPromptLibraryStyles } from "./styles.js";

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let nonce = "";
  for (let index = 0; index < 32; index += 1) nonce += chars.charAt(Math.floor(Math.random() * chars.length));
  return nonce;
}

export function renderPromptLibraryHtml(webview: vscode.Webview, model: PromptLibraryViewModel): string {
  const nonce = getNonce();
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run Prompt Library</title>
  <style>${getPromptLibraryStyles()}</style>
</head>
<body>
${getPromptLibraryMarkup(model)}
<script nonce="${nonce}">${getPromptLibraryScript(model)}</script>
</body>
</html>`;
}
