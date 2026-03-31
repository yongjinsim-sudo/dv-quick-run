import * as vscode from "vscode";
import { ResultViewerModel } from "../services/resultViewModelBuilder.js";
import { getResultViewerMarkup } from "./resultViewer/markup.js";
import { getResultViewerScript } from "./resultViewer/script.js";
import { RESULT_VIEWER_STYLES } from "./resultViewer/styles.js";

function escapeForScript(value: string): string {
    return value
        .replace(/\\/g, "\\\\")
        .replace(/`/g, "\\`")
        .replace(/\$\{/g, "\\${");
}

export function getResultViewerHtml(
    webview: vscode.Webview,
    extensionUri: vscode.Uri,
    model: ResultViewerModel
): string {
    const iconUri = webview.asWebviewUri(
        vscode.Uri.joinPath(extensionUri, "images", "icon16.png")
    );

    const initialModelJson = JSON.stringify(JSON.stringify(model));
    const script = getResultViewerScript(initialModelJson);

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DV Quick Run Result Viewer</title>
    <style>
${RESULT_VIEWER_STYLES}
    </style>
</head>
<body>
${getResultViewerMarkup(String(iconUri))}

    <script>
${script}
    </script>
</body>
</html>`;
}
