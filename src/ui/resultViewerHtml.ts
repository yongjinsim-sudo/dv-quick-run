import * as vscode from "vscode";
import { ResultViewerModel } from "../services/resultViewModelBuilder";

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

    const initialModelJson = escapeForScript(JSON.stringify(model));

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DV Quick Run Result Viewer</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 12px;
            margin: 0;
        }

        .page {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100vh;
            box-sizing: border-box;
            padding: 12px;
        }

        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .toolbar-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .toolbar-right {
            display: flex;
            align-items: center;
            gap: 6px;
            opacity: 0.85;
        }

        .viewer-title {
            font-size: 13px;
            font-weight: 600;
        }

        .row-count {
            font-size: 12px;
            opacity: 0.8;
        }

        .copy-status {
            font-size: 12px;
            color: var(--vscode-testing-iconPassed);
            min-width: 56px;
            text-align: right;
        }

        .viewer-icon {
            width: 16px;
            height: 16px;
            margin-right: 6px;
            opacity: 0.9;
        }

        button {
            padding: 6px 14px;
            border-radius: 6px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 12px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.active {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .view-container {
            min-height: 0;
            flex: 1;
        }

        #tableView {
            display: block;
            overflow: auto;
            max-height: calc(100vh - 90px);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
        }

        #jsonView {
            display: none;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            overflow: auto;
            max-height: calc(100vh - 90px);
            box-sizing: border-box;
            background: var(--vscode-editor-background);
        }

        table {
            border-collapse: collapse;
            width: 100%;
            font-size: 12px;
        }

        thead {
            position: sticky;
            top: 0;
            z-index: 2;
            background: var(--vscode-editorWidget-background);
        }

        th,
        td {
            border-bottom: 1px solid var(--vscode-panel-border);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            white-space: nowrap;
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
        }

        th:last-child,
        td:last-child {
            border-right: none;
        }

        th {
            font-weight: 600;
        }

        tbody tr:nth-child(even) {
            background: rgba(255, 255, 255, 0.03);
        }

        tbody tr:hover {
            background: rgba(255, 255, 255, 0.06);
        }

        .copyable {
            cursor: pointer;
        }

        .copyable:hover {
            background: rgba(255, 255, 255, 0.08);
        }

        .guid-cell {
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }

        .cell-actions {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: 2px;
        }

        .inline-action {
            border: none;
            background: transparent;
            padding: 0;
            margin: 0;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            opacity: 0.75;
        }

        .inline-action:hover {
            background: transparent;
            opacity: 1;
        }

        .empty-state {
            padding: 18px 14px;
            opacity: 0.75;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="toolbar">
            <div class="toolbar-left">
                <button id="showTableBtn" type="button">TABLE</button>
                <button id="showJsonBtn" type="button">JSON</button>
                <button id="showRelationshipsBtn" type="button">RELATIONSHIPS</button>
            </div>
            <div class="toolbar-right">
                <img src="${iconUri}" class="viewer-icon" />
                <span class="viewer-title">DV Quick Run Result Viewer</span>
                <span id="rowCount" class="row-count"></span>
                <span id="copyStatus" class="copy-status"></span>
            </div>
        </div>

        <div class="view-container">
            <div id="tableView"></div>
            <pre id="jsonView"></pre>
        </div>
    </div>

    <script>
        const vscodeApi = acquireVsCodeApi();

        const tableView = document.getElementById("tableView");
        const jsonView = document.getElementById("jsonView");
        const showTableBtn = document.getElementById("showTableBtn");
        const showJsonBtn = document.getElementById("showJsonBtn");
        const showRelationshipsBtn = document.getElementById("showRelationshipsBtn");
        const rowCount = document.getElementById("rowCount");
        const copyStatus = document.getElementById("copyStatus");

        const model = JSON.parse(\`${initialModelJson}\`);

        let copyStatusTimeout;

        showTableBtn.addEventListener("click", () => {
            showTable();
        });

        showJsonBtn.addEventListener("click", () => {
            showJson();
        });

        showRelationshipsBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "showRelationships",
                payload: {
                    entitySetName: model.entitySetName ?? ""
                }
            });
        });

        renderTable(model);
        jsonView.textContent = model.rawJson;
        rowCount.textContent = model.rowCount + " rows returned";

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }

        function showTable() {
            tableView.style.display = "block";
            jsonView.style.display = "none";
            showTableBtn.classList.add("active");
            showJsonBtn.classList.remove("active");
        }

        function showJson() {
            tableView.style.display = "none";
            jsonView.style.display = "block";
            showJsonBtn.classList.add("active");
            showTableBtn.classList.remove("active");
        }

        function renderTable(currentModel) {
            if (!currentModel.columns || currentModel.columns.length === 0) {
                tableView.innerHTML = "<div class=\\"empty-state\\">No rows returned.</div>";
                return;
            }

            let html = "<table>";
            html += "<thead><tr>";

            currentModel.columns.forEach((column) => {
                html += "<th>" + escapeHtml(column) + "</th>";
            });

            html += "</tr></thead>";

            html += "</tr></thead>";
            html += "<tbody>";

            currentModel.rows.forEach((row) => {
                html += "<tr>";

                currentModel.columns.forEach((column) => {
                    const cell = row[column];
                    const value = cell?.value ?? "";
                    const isPrimaryIdCell =
                        !!currentModel.primaryIdField &&
                        column === currentModel.primaryIdField;

                    if (isPrimaryIdCell && value) {
                        html += "<td>";
                        html += "<span class=\\"guid-cell\\">";
                        html += "<span class=\\"copyable\\" data-copy-value=\\"" + escapeAttribute(value) + "\\">" + escapeHtml(value) + "</span>";
                        html += "<span class=\\"cell-actions\\">";
                        html += "<button class=\\"inline-action\\" title=\\"Investigate record\\" data-action=\\"investigateRecord\\" data-guid=\\"" + escapeAttribute(value) + "\\" data-entity-set-name=\\"" + escapeAttribute(currentModel.entitySetName ?? "") + "\\">🔎</button>";
                        html += "<button class=\\"inline-action\\" title=\\"Open in Dataverse UI\\" data-action=\\"openInDataverseUi\\" data-guid=\\"" + escapeAttribute(value) + "\\" data-entity-set-name=\\"" + escapeAttribute(currentModel.entitySetName ?? "") + "\\">↗</button>";
                        html += "</span>";
                        html += "</span>";
                        html += "</td>";
                    } else {
                        html += "<td class=\\"copyable\\" data-copy-value=\\"" + escapeAttribute(value) + "\\">" + escapeHtml(value) + "</td>";
                    }
                });

                html += "</tr>";
            });

            html += "</tbody></table>";

            tableView.innerHTML = html;

            const copyableElements = tableView.querySelectorAll(".copyable");
            copyableElements.forEach((element) => {
                element.addEventListener("click", async () => {
                    const value = element.getAttribute("data-copy-value") ?? "";

                    if (!value) {
                        return;
                    }

                    try {
                        await navigator.clipboard.writeText(value);
                        showCopyStatus("Copied");
                    } catch (error) {
                        vscodeApi.postMessage({
                            type: action,
                            payload: {
                                guid: guid,
                                entitySetName: entitySetName
                            }
                        });
                        showCopyStatus("Copied");
                    }
                });
            });

            const actionButtons = tableView.querySelectorAll(".inline-action");
            actionButtons.forEach((button) => {
                button.addEventListener("click", (event) => {
                    event.stopPropagation();

                    const action = button.getAttribute("data-action");
                    const guid = button.getAttribute("data-guid") ?? "";
                    const entitySetName = button.getAttribute("data-entity-set-name") ?? "";

                    if (!action) {
                        return;
                    }

                    vscodeApi.postMessage({
                        type: action,
                        payload: {
                            guid: guid,
                            entitySetName: entitySetName
                        }
                    });
                });
            });
        }

        function showCopyStatus(message) {
            copyStatus.textContent = message;

            if (copyStatusTimeout) {
                clearTimeout(copyStatusTimeout);
            }

            copyStatusTimeout = setTimeout(() => {
                copyStatus.textContent = "";
            }, 1200);
        }

        function escapeHtml(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/"/g, "&quot;");
        }
    </script>
</body>
</html>
`;
}