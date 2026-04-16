import * as vscode from "vscode";
import { ResultViewerDisplayModel } from "../services/resultViewModelBuilder.js";
import { getResultViewerMarkup } from "./resultViewer/markup.js";
import { getResultViewerScript } from "./resultViewer/script.js";
import { RESULT_VIEWER_STYLES } from "./resultViewer/styles.js";

function getNonce(): string {
    const possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let value = "";

    for (let i = 0; i < 32; i++) {
        value += possible.charAt(Math.floor(Math.random() * possible.length));
    }

    return value;
}

export function getResultViewerHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    model: ResultViewerDisplayModel
): string {
    const iconUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "images", "icon16.png")
    );

    const initialModelJson = JSON.stringify(JSON.stringify(model));
    const script = getResultViewerScript(initialModelJson);
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy" content="
        default-src 'none';
        img-src ${webview.cspSource} https: data:;
        script-src 'nonce-${nonce}';
        style-src ${webview.cspSource} 'unsafe-inline';
        font-src ${webview.cspSource};
    " />
    <title>DV Quick Run Result Viewer</title>
    <style>
${RESULT_VIEWER_STYLES}
    </style>
</head>
<body>
${getResultViewerMarkup(String(iconUri))}

    <script nonce="${nonce}">
${script}
    </script>
</body>
</html>`;
}