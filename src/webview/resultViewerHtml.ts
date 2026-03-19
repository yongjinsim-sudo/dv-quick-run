import * as vscode from "vscode";
import { ResultViewerModel } from "../services/resultViewModelBuilder.js";

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

        .toolbar button + button {
            margin-left: 6px;
        }

        #showRelationshipsBtn {
            margin-left: 16px;
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
            gap: 8px;
            opacity: 0.9;
            flex-wrap: wrap;
        }
        
        .toolbar button {
            min-width: 36px;
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
            margin-right: 4px;
            opacity: 0.9;
        }

        .environment-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            font-size: 12px;
            line-height: 1;
        }

        .environment-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            display: inline-block;
            border: 1px solid rgba(0, 0, 0, 0.25);
        }

        .environment-dot.white {
            background: #d4d4d4;
        }

        .environment-dot.amber {
            background: #d7ba7d;
        }

        .environment-dot.red {
            background: #f48771;
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

        .table-tools {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
            z-index: 3;
        }

        .table-filter-input {
            min-width: 220px;
            max-width: 320px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            font-size: 12px;
            table-layout: auto;
        }

        thead {
            position: sticky;
            top: 41px;
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
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
        }

        th:last-child,
        td:last-child {
            border-right: none;
        }

        th {
            font-weight: 600;
            position: relative;
            user-select: none;
        }

        .th-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-width: 0;
        }

        .sort-button {
            all: unset;
            cursor: pointer;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
        }

        .sort-indicator {
            opacity: 0.85;
        }

        .resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            cursor: col-resize;
        }

        .resize-handle:hover,
        .resizing .resize-handle {
            background: var(--vscode-focusBorder);
            opacity: 0.35;
        }

        tbody tr:nth-child(even) {
            background: rgba(255, 255, 255, 0.03);
        }

        tbody tr:hover {
            background: rgba(255, 255, 255, 0.06);
        }

        tbody tr:hover .cell-actions {
            opacity: 1;
        }

        .cell-actions:focus-within {
            opacity: 1;
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
            gap: 8px;
            width: 100%;
            min-width: 0;
        }

        .context-action-cell {
            position: relative;
        }

        .guid-value {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .cell-actions {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: auto;
            position: relative;
            flex: 0 0 auto;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .inline-action {
            border: none;
            background: transparent;
            padding: 0 2px;
            margin: 0;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            opacity: 0.78;
            transition: opacity 0.12s ease;
        }

        .inline-action:hover {
            background: transparent;
            opacity: 1;
        }

        .overflow-menu {
            position: absolute;
            top: 18px;
            right: 0;
            min-width: 170px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
            padding: 4px;
            z-index: 20;
        }

        .overflow-menu[hidden] {
            display: none;
        }

        .overflow-menu.open-up {
            top: auto;
            bottom: 18px;
        }

        .overflow-menu-overlay {
            position: fixed;
            display: inline-block;
            width: max-content;
            min-width: 170px;
            max-width: 260px;

            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            box-shadow: 0 6px 14px rgba(0,0,0,0.2);
            padding: 4px;
        }

        .overflow-menu-overlay button {
            display: block;
            width: 100%;
            white-space: nowrap;
        }

        .overflow-item {
            display: flex;
            width: 100%;
            align-items: center;
            gap: 8px;
            border: none;
            background: transparent;
            color: inherit;
            text-align: left;
            padding: 7px 8px;
            border-radius: 4px;
        }

        .overflow-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .empty-state {
            padding: 18px 14px;
            opacity: 0.75;
        }

        .array-cell {
            cursor: default;
            background: rgba(47, 129, 247, 0.10);
        }

        .array-cell:hover {
            background: rgba(47, 129, 247, 0.18);
        }

        .array-cell-content {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            max-width: 100%;
        }

        .array-cell-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #9ecbff;
        }

        .array-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 999px;
            background: #2f81f7;
            color: white;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.3px;
            flex: 0 0 auto;
        }

        .legend {
            margin-top: 10px;
            padding: 10px 12px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .legend-title {
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-editor-foreground);
        }

        .legend-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 18px;
        }

        .legend-item code {
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
            font-size: 12px;
        }

        .drawer {
            display: none;
            margin-top: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-editorWidget-background);
            overflow: hidden;
        }

        .drawer.open {
            display: block;
        }

        .drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: rgba(255, 255, 255, 0.02);
        }

        .drawer-title {
            font-size: 13px;
            font-weight: 600;
        }

        .drawer-subtitle {
            font-size: 12px;
            opacity: 0.8;
        }

        .drawer-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .drawer-body {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 320px;
            overflow: auto;
        }

        .drawer-tab-strip {
            display: flex;
            gap: 8px;
        }

        .drawer-tab {
            padding: 5px 10px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            background: transparent;
            color: inherit;
            cursor: pointer;
            font-size: 12px;
        }

        .drawer-tab.active {
            background: rgba(47, 129, 247, 0.18);
            border-color: rgba(47, 129, 247, 0.45);
        }

        .drawer-json {
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 10px;
            background: var(--vscode-editor-background);
            margin: 0;
        }

        .drawer-table-wrap {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: auto;
        }

        .drawer-empty {
            opacity: 0.75;
            padding: 12px;
        }

        .drawer-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .drawer-chip {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(47, 129, 247, 0.18);
            color: #9ecbff;
            font-size: 12px;
        }

        .drawer-resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            cursor: col-resize;
        }

        .drawer-resize-handle:hover,
        .drawer-resizing .drawer-resize-handle {
            background: var(--vscode-focusBorder);
            opacity: 0.35;
        }

        .drawer-table-wrap thead {
            position: static;
        }
    </style>
</head>
<body>
    <div class="page">
        <div class="toolbar">
            <div class="toolbar-left">
                <button id="showTableBtn" type="button">TABLE</button>
                <button id="showJsonBtn" type="button">JSON</button>
                <button id="showRelationshipsBtn" title="View Relationships">🔗</button>
                <button id="showMetadataBtn" title="View Entity Metadata">📘</button>
                <button id="exportCsvBtn" title="Export current view to CSV">⬇️</button>
            </div>
            <div class="toolbar-right">
                <img src="${iconUri}" class="viewer-icon" />
                <span class="viewer-title">DV Quick Run Result Viewer</span>
                <span id="rowCount" class="row-count"></span>
                <span id="copyStatus" class="copy-status"></span>
                <span id="environmentBadge"></span>
            </div>
        </div>

        <div class="view-container">
            <div id="tableView"></div>
            <pre id="jsonView"></pre>
        </div>

        <div id="arrayDrawer" class="drawer">
            <div class="drawer-header">
                <div>
                    <div id="arrayDrawerTitle" class="drawer-title">Expanded records</div>
                    <div id="arrayDrawerSubtitle" class="drawer-subtitle"></div>
                </div>
                <div class="drawer-actions">
                    <button id="arrayDrawerTableTab" class="drawer-tab" type="button">TABLE</button>
                    <button id="arrayDrawerJsonTab" class="drawer-tab" type="button">JSON</button>
                    <button id="arrayDrawerCloseBtn" type="button">Close</button>
                </div>
            </div>
            <div class="drawer-body">
                <div id="arrayDrawerTableView"></div>
                <pre id="arrayDrawerJsonView" class="drawer-json"></pre>
            </div>
        </div>
    </div>

    <script>
        const vscodeApi = acquireVsCodeApi();

        const tableView = document.getElementById("tableView");
        const jsonView = document.getElementById("jsonView");
        const showTableBtn = document.getElementById("showTableBtn");
        const showJsonBtn = document.getElementById("showJsonBtn");
        const showRelationshipsBtn = document.getElementById("showRelationshipsBtn");
        const showMetadataBtn = document.getElementById("showMetadataBtn");
        const exportCsvBtn = document.getElementById("exportCsvBtn");
        const rowCount = document.getElementById("rowCount");
        const copyStatus = document.getElementById("copyStatus");
        const environmentBadge = document.getElementById("environmentBadge");
        const arrayDrawer = document.getElementById("arrayDrawer");
        const arrayDrawerTitle = document.getElementById("arrayDrawerTitle");
        const arrayDrawerSubtitle = document.getElementById("arrayDrawerSubtitle");
        const arrayDrawerTableTab = document.getElementById("arrayDrawerTableTab");
        const arrayDrawerJsonTab = document.getElementById("arrayDrawerJsonTab");
        const arrayDrawerCloseBtn = document.getElementById("arrayDrawerCloseBtn");
        const arrayDrawerTableView = document.getElementById("arrayDrawerTableView");
        const arrayDrawerJsonView = document.getElementById("arrayDrawerJsonView");

        const model = JSON.parse(\`${initialModelJson}\`);

        const tableState = {
            sortColumn: null,
            sortDirection: "asc",
            filterText: "",
            columnWidths: {}
        };

        const MIN_COLUMN_WIDTH = 80;
        let copyStatusTimeout;
        let activeResize = null;
        let activeDrawerResize = null;
        const drawerColumnWidths = {};
        let activeOverflowMenu = null;
        let activeOverflowAnchor = null;
        let tableEventsBound = false;
        const arrayDrawerPayloads = new Map();
        const nestedDrawerPayloads = new Map();
        let activeArrayDrawerKey = null;
        let arrayDrawerView = "table";
        let nestedDrawerCounter = 0;

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

        showMetadataBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "showMetadata",
                payload: {
                    entitySetName: model.entitySetName ?? "",
                    entityLogicalName: model.entityLogicalName ?? ""
                }
            });
        });

        exportCsvBtn.addEventListener("click", () => {
            const exportRows = applySorting(
                applyFilter(model.rows, model.columns),
                model.columns
            );

            const csv = buildCsv(model.columns, exportRows);

            vscodeApi.postMessage({
                type: "exportCsv",
                payload: {
                    fileName: buildExportFileName(model),
                    csv
                }
            });
        });

        arrayDrawerTableTab.addEventListener("click", () => {
            arrayDrawerView = "table";
            renderActiveArrayDrawer();
        });

        arrayDrawerJsonTab.addEventListener("click", () => {
            arrayDrawerView = "json";
            renderActiveArrayDrawer();
        });

        arrayDrawerCloseBtn.addEventListener("click", () => {
            closeArrayDrawer();
        });

        document.addEventListener("click", () => {
            closeAllOverflowMenus();
        });

        bindTableEventsOnce();
        renderEnvironmentBadge(model.environment);
        renderTable(model);
        jsonView.textContent = model.rawJson;
        rowCount.textContent = model.rowCount + " rows returned";

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }

        function renderEnvironmentBadge(environment) {
            if (!environment || !environment.name) {
                environmentBadge.innerHTML = "";
                return;
            }

            const hint = environment.colorHint || "white";
            environmentBadge.innerHTML =
                "<span class='environment-badge' title='Active environment'>" +
                "<span class='environment-dot " + escapeAttribute(hint) + "'></span>" +
                "<span>" + escapeHtml(environment.name) + "</span>" +
                "</span>";
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

            const visibleRows = applySorting(
                applyFilter(currentModel.rows, currentModel.columns),
                currentModel.columns
            );

            let html = "<div class=\\"table-tools\\">" +
                "<input id=\\"tableFilterInput\\" class=\\"table-filter-input\\" type=\\"text\\" placeholder=\\"Filter visible rows...\\" value=\\"" + escapeAttribute(tableState.filterText) + "\\" />" +
                "</div>";
            html += "<table>";
            html += "<thead><tr>";

            currentModel.columns.forEach((column) => {
                const width = getColumnWidth(column);
                const widthStyle = width ? " style=\\"width:" + width + "px; min-width:" + width + "px; max-width:" + width + "px;\\"" : "";
                const sortIndicator = tableState.sortColumn === column
                    ? (tableState.sortDirection === "asc" ? " ▲" : " ▼")
                    : "";

                html += "<th data-column=\\"" + escapeAttribute(column) + "\\"" + widthStyle + ">";
                html += "<div class=\\"th-content\\">";
                html += "<button class=\\"sort-button\\" type=\\"button\\" data-sort-column=\\"" + escapeAttribute(column) + "\\" title=\\"Sort by " + escapeAttribute(column) + "\\">";
                html += escapeHtml(column) + "<span class=\\"sort-indicator\\">" + escapeHtml(sortIndicator) + "</span>";
                html += "</button>";
                html += "</div>";
                html += "<div class=\\"resize-handle\\" data-resize-column=\\"" + escapeAttribute(column) + "\\" title=\\"Resize column\\"></div>";
                html += "</th>";
            });

            html += "</tr></thead>";
            html += "<tbody>";

            arrayDrawerPayloads.clear();
            visibleRows.forEach((row, rowIndex) => {
                html += "<tr>";

                currentModel.columns.forEach((column) => {
                    const cell = row[column];
                    const value = cell?.value ?? "";
                    const copyValue = cell?.copyValue ?? value;
                    const actions = Array.isArray(cell?.actions) ? cell.actions : [];
                    const primaryActions = actions.filter((action) => action.placement === "primary");
                    const overflowActions = actions.filter((action) => action.placement === "overflow");
                    const width = getColumnWidth(column);
                    const widthStyle = width ? " style=\\"width:" + width + "px; min-width:" + width + "px; max-width:" + width + "px;\\"" : "";

                    if (actions.length > 0 && value && !Array.isArray(cell && cell.rawValue)) {
                        html += "<td data-column=\\"" + escapeAttribute(column) + "\\"" + widthStyle + ">";
                        html += "<span class=\\"guid-cell\\">";
                        html += "<span class=\\"guid-value copyable\\" data-copy-value=\\"" + escapeAttribute(copyValue) + "\\">" + escapeHtml(value) + "</span>";
                        html += "<span class=\\"cell-actions\\">";

                        primaryActions.forEach((action) => {
                            html +=
                                "<button class=\\"inline-action\\"" +
                                " title=\\"" + escapeAttribute(action.title) + "\\"" +
                                " data-action-id=\\"" + escapeAttribute(action.id) + "\\"" +
                                " data-guid=\\"" + escapeAttribute(action.payload?.guid ?? "") + "\\"" +
                                " data-entity-set-name=\\"" + escapeAttribute(action.payload?.entitySetName ?? "") + "\\"" +
                                " data-entity-logical-name=\\"" + escapeAttribute(action.payload?.entityLogicalName ?? "") + "\\"" +
                                " data-column-name=\\"" + escapeAttribute(action.payload?.columnName ?? "") + "\\"" +
                                " data-raw-value=\\"" + escapeAttribute(action.payload?.rawValue ?? "") + "\\">" +
                                escapeHtml(action.icon) +
                                "</button>";
                        });

                        if (overflowActions.length > 0) {
                            html +=
                                "<button class=\\"inline-action overflow-trigger\\" type=\\"button\\" title=\\"More actions\\">⋮</button>" +
                                "<div class=\\"overflow-menu\\" hidden>";

                            overflowActions.forEach((action) => {
                                html +=
                                    "<button class=\\"overflow-item\\" type=\\"button\\"" +
                                    " data-action-id=\\"" + escapeAttribute(action.id) + "\\"" +
                                    " data-guid=\\"" + escapeAttribute(action.payload?.guid ?? "") + "\\"" +
                                    " data-entity-set-name=\\"" + escapeAttribute(action.payload?.entitySetName ?? "") + "\\"" +
                                    " data-entity-logical-name=\\"" + escapeAttribute(action.payload?.entityLogicalName ?? "") + "\\"" +
                                    " data-column-name=\\"" + escapeAttribute(action.payload?.columnName ?? "") + "\\"" +
                                    " data-raw-value=\\"" + escapeAttribute(action.payload?.rawValue ?? "") + "\\">" +
                                    "<span>" + escapeHtml(action.icon) + "</span>" +
                                    "<span>" + escapeHtml(action.title) + "</span>" +
                                    "</button>";
                            });

                            html += "</div>";
                        }

                        html += "</span>";
                        html += "</span>";
                        html += "</td>";
                    } else {
                        const isArrayCell = Array.isArray(cell && cell.rawValue);
                        const arrayDrawerKey = isArrayCell ? (column + "::" + rowIndex) : "";

                        if (isArrayCell) {
                            arrayDrawerPayloads.set(arrayDrawerKey, {
                                column,
                                payload: cell.rawValue
                            });
                        }

                        html += "<td class=\\"" + (isArrayCell ? "array-cell" : "copyable") + "\\" data-column=\\"" + escapeAttribute(column) + "\\" data-copy-value=\\"" + escapeAttribute(copyValue) + "\\"" + (isArrayCell ? " data-array-drawer-key=\\"" + escapeAttribute(arrayDrawerKey) + "\\"" : "") + widthStyle + ">" +
                            (isArrayCell
                                ? "<span class=\\"array-cell-content\\"><span class=\\"array-badge\\">ARRAY</span><span class=\\"array-cell-text\\">" + escapeHtml(value) + "</span></span>"
                                : escapeHtml(value)) +
                            "</td>";
                    }
                });

                html += "</tr>";
            });

            html += "</tbody></table>";
            html += renderLegend(currentModel);

            tableView.innerHTML = html;
            applyColumnWidthsToLiveTable();
        }

        function closeArrayDrawer() {
            activeArrayDrawerKey = null;
            if (arrayDrawer instanceof HTMLElement) {
                arrayDrawer.classList.remove("open");
            }
        }

        function openArrayDrawer(drawerKey) {
            if (!drawerKey || !arrayDrawerPayloads.has(drawerKey)) {
                return;
            }

            activeArrayDrawerKey = drawerKey;
            arrayDrawerView = "table";
            renderActiveArrayDrawer();

            if (arrayDrawer instanceof HTMLElement) {
                arrayDrawer.classList.add("open");
                arrayDrawer.scrollIntoView({ block: "nearest", behavior: "smooth" });
            }
        }

        function renderActiveArrayDrawer() {
            if (!activeArrayDrawerKey) {
                return;
            }

            const drawerItem = arrayDrawerPayloads.get(activeArrayDrawerKey);
            if (!drawerItem) {
                closeArrayDrawer();
                return;
            }

            const payload = drawerItem.payload;
            const column = drawerItem.column || "expanded";
            const itemCount = Array.isArray(payload) ? payload.length : 0;

            arrayDrawerTitle.textContent = column;
            arrayDrawerSubtitle.textContent = itemCount + " record" + (itemCount === 1 ? "" : "s");
            arrayDrawerJsonView.textContent = JSON.stringify(payload, null, 2);

            arrayDrawerTableTab.classList.toggle("active", arrayDrawerView === "table");
            arrayDrawerJsonTab.classList.toggle("active", arrayDrawerView === "json");
            arrayDrawerTableView.style.display = arrayDrawerView === "table" ? "block" : "none";
            arrayDrawerJsonView.style.display = arrayDrawerView === "json" ? "block" : "none";

            nestedDrawerPayloads.clear();
            nestedDrawerCounter = 0;

            if (arrayDrawerView === "table") {
                arrayDrawerTableView.innerHTML = buildArrayDrawerTable(payload);
                applyDrawerColumnWidths();
            }
        }

        function buildArrayDrawerTable(payload) {
            if (!Array.isArray(payload) || payload.length === 0) {
                return "<div class=\\"drawer-empty\\">No records to display.</div>";
            }

            if (payload.every((item) => isPlainObject(item))) {
                return buildArrayDrawerObjectTable(payload);
            }

            return "<div class=\\"drawer-list\\">" +
                payload.map((item) => "<span class=\\"drawer-chip\\">" + escapeHtml(summariseNestedValue(item)) + "</span>").join("") +
                "</div>";
        }

        function buildArrayDrawerObjectTable(records) {
            const preparedRows = records.map((record) => flattenDrawerRecord(record));
            const columns = [];
            const seen = new Set();

            preparedRows.forEach((record) => {
                Object.keys(record).forEach((key) => {
                    if (!seen.has(key)) {
                        seen.add(key);
                        columns.push(key);
                    }
                });
            });

            if (columns.length === 0) {
                return "<div class=\\"drawer-empty\\">No visible fields to display.</div>";
            }

            let html = "<div class=\\"drawer-table-wrap\\"><table><thead><tr>";
            columns.forEach((column) => {
                const width = drawerColumnWidths[column];
                const widthStyle = width ? " style=\\"width:" + width + "px; min-width:" + width + "px; max-width:" + width + "px;\\"" : "";

                html += "<th data-drawer-column=\\"" + escapeAttribute(column) + "\\"" + widthStyle + ">";
                html += "<div class=\\"th-content\\">" + escapeHtml(column) + "</div>";
                html += "<div class=\\"drawer-resize-handle\\" data-drawer-resize-column=\\"" + escapeAttribute(column) + "\\"></div>";
                html += "</th>";
            });
            html += "</tr></thead><tbody>";

            preparedRows.forEach((record) => {
                html += "<tr>";
                columns.forEach((column) => {
                    const cellValue = record[column];
                    const isNestedExpandable =
                        Array.isArray(cellValue) ||
                        isPlainObject(cellValue);

                    if (isNestedExpandable) {
                        const nestedKey = "nested::" + nestedDrawerCounter++;
                        nestedDrawerPayloads.set(nestedKey, {
                            column,
                            payload: cellValue
                        });

                        html += "<td class=\\"array-cell\\" data-nested-drawer-key=\\"" + escapeAttribute(nestedKey) + "\\">" +
                            "<span class=\\"array-cell-content\\"><span class=\\"array-badge\\">OPEN</span><span class=\\"array-cell-text\\">" +
                            escapeHtml(summariseNestedValue(cellValue)) +
                            "</span></span>" +
                            "</td>";
                    } else {
                        const width = drawerColumnWidths[column];
                        const widthStyle = width ? " style=\\"width:" + width + "px; min-width:" + width + "px; max-width:" + width + "px;\\"" : "";
                        html += "<td data-drawer-column=\\"" + escapeAttribute(column) + "\\"" + widthStyle + ">" + escapeHtml(summariseNestedValue(cellValue)) + "</td>";
                    }
                });
                html += "</tr>";
            });

            html += "</tbody></table></div>";
            return html;
        }

        function flattenDrawerRecord(record, depth = 0, maxDepth = 1, prefix = "") {
            const flattened = {};

            if (!isPlainObject(record)) {
                return flattened;
            }

            Object.entries(record).forEach(([key, value]) => {
                if (shouldHideDrawerField(key)) {
                    return;
                }

                const fullKey = prefix ? prefix + "." + key : key;

                if (Array.isArray(value) && value.length === 1 && isPlainObject(value[0]) && depth < maxDepth) {
                    Object.assign(flattened, flattenDrawerRecord(value[0], depth + 1, maxDepth, fullKey));
                    return;
                }

                if (isPlainObject(value) && depth < maxDepth) {
                    Object.assign(flattened, flattenDrawerRecord(value, depth + 1, maxDepth, fullKey));
                    return;
                }

                flattened[fullKey] = value;
            });

            return flattened;
        }

        function summariseNestedValue(value) {
            if (value === null || value === undefined) {
                return "";
            }

            if (Array.isArray(value)) {
                return value.length + " record" + (value.length === 1 ? "" : "s");
            }

            if (isPlainObject(value)) {
                return "[Object]";
            }

            return String(value);
        }

        function isPlainObject(value) {
            return typeof value === "object" && value !== null && !Array.isArray(value);
        }

        function shouldHideDrawerField(key) {
            if (key.startsWith("@odata.")) {
                return true;
            }

            if (key.startsWith("_") && key.endsWith("_value")) {
                return true;
            }

            return false;
        }

        function renderLegend(currentModel) {
            if (!Array.isArray(currentModel.legend) || currentModel.legend.length === 0) {
                return "";
            }

            let html = "<div class=\\"legend\\">";
            html += "<div class=\\"legend-title\\">Legend</div>";
            html += "<div class=\\"legend-list\\">";

            currentModel.legend.forEach((item) => {
                html += "<div class=\\"legend-item\\"><code>" +
                    escapeHtml(item.alias) +
                    "</code> = <code>" +
                    escapeHtml(item.fullName) +
                    "</code></div>";
            });

            html += "</div></div>";
            return html;
        }

        function bindTableEventsOnce() {
            if (tableEventsBound) {
                return;
            }

            tableEventsBound = true;

            tableView.addEventListener("input", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement) || target.id !== "tableFilterInput") {
                    return;
                }

                const nextFilterText = target.value;
                const selectionStart = target.selectionStart ?? nextFilterText.length;
                const selectionEnd = target.selectionEnd ?? nextFilterText.length;

                tableState.filterText = nextFilterText;
                renderTable(model);

                const nextFilterInput = document.getElementById("tableFilterInput");
                if (nextFilterInput instanceof HTMLInputElement) {
                    nextFilterInput.focus();
                    nextFilterInput.setSelectionRange(selectionStart, selectionEnd);
                }
            });

            tableView.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const actionElement = target.closest("[data-action-id]");
                if (actionElement instanceof HTMLElement) {
                    event.stopPropagation();
                    executeAction(actionElement);
                    closeAllOverflowMenus();
                    return;
                }

                const overflowTrigger = target.closest(".overflow-trigger");
                if (overflowTrigger instanceof HTMLElement) {
                    event.preventDefault();
                    event.stopPropagation();

                    const actionContainer = overflowTrigger.parentElement;
                    const menu = actionContainer?.querySelector(".overflow-menu");

                    if (!(menu instanceof HTMLElement)) {
                        return;
                    }

                    const isSameMenuOpen = activeOverflowAnchor === overflowTrigger;
                    closeAllOverflowMenus();

                    if (!isSameMenuOpen) {
                        openOverflowMenu(overflowTrigger, menu);
                    }

                    return;
                }

                const sortButton = target.closest("[data-sort-column]");
                if (sortButton instanceof HTMLElement) {
                    event.stopPropagation();
                    const column = sortButton.getAttribute("data-sort-column") ?? "";

                    if (column) {
                        toggleSort(column);
                    }

                    return;
                }

                const arrayCell = target.closest("[data-array-drawer-key]");
                if (arrayCell instanceof HTMLElement) {
                    event.stopPropagation();
                    const drawerKey = arrayCell.getAttribute("data-array-drawer-key") ?? "";
                    if (drawerKey) {
                        openArrayDrawer(drawerKey);
                    }
                    return;
                }

                const copyable = target.closest(".copyable");
                if (copyable instanceof HTMLElement) {
                    const value = copyable.getAttribute("data-copy-value") ?? "";
                    if (!value) {
                        return;
                    }

                    void copyValueToClipboard(value);
                }
            });

            arrayDrawerTableView.addEventListener("mousedown", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const resizeHandle = target.closest("[data-drawer-resize-column]");
                if (!(resizeHandle instanceof HTMLElement)) {
                    return;
                }

                const column = resizeHandle.getAttribute("data-drawer-resize-column") ?? "";
                if (!column) {
                    return;
                }

                beginDrawerResize(event, resizeHandle, column);
            });

            tableView.addEventListener("contextmenu", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const cell = target.closest(".context-action-cell");
                if (!(cell instanceof HTMLElement)) {
                    return;
                }

                const menu = cell.querySelector(".overflow-menu");
                if (!(menu instanceof HTMLElement)) {
                    return;
                }

                event.preventDefault();
                event.stopPropagation();
                openOverflowMenuAtPosition(event.clientX, event.clientY, menu);
            });

            arrayDrawerTableView.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const nestedCell = target.closest("[data-nested-drawer-key]");
                if (!(nestedCell instanceof HTMLElement)) {
                    return;
                }

                const nestedKey = nestedCell.getAttribute("data-nested-drawer-key") ?? "";
                const nestedItem = nestedDrawerPayloads.get(nestedKey);

                if (!nestedItem) {
                    return;
                }

                arrayDrawerTitle.textContent = nestedItem.column;
                arrayDrawerSubtitle.textContent = Array.isArray(nestedItem.payload)
                    ? nestedItem.payload.length + " record" + (nestedItem.payload.length === 1 ? "" : "s")
                    : "object";

                arrayDrawerJsonView.textContent = JSON.stringify(nestedItem.payload, null, 2);
                arrayDrawerTableView.innerHTML = buildArrayDrawerTable(nestedItem.payload);
                applyDrawerColumnWidths();
                arrayDrawerView = "table";
                showArrayDrawerTable();
                nestedDrawerPayloads.clear();
                nestedDrawerCounter = 0;
                arrayDrawerTableView.innerHTML = buildArrayDrawerTable(nestedItem.payload);
                showArrayDrawerTable();
            });
        }

        async function copyValueToClipboard(value) {
            try {
                await navigator.clipboard.writeText(value);
            } catch (error) {
                vscodeApi.postMessage({
                    type: "copyToClipboard",
                    payload: value
                });
            }

            showCopyStatus("Copied");
        }

        function toggleSort(column) {
            if (tableState.sortColumn === column) {
                tableState.sortDirection = tableState.sortDirection === "asc" ? "desc" : "asc";
            } else {
                tableState.sortColumn = column;
                tableState.sortDirection = "asc";
            }

            renderTable(model);
        }

        function applyFilter(rows, columns) {
            const filterText = String(tableState.filterText ?? "").trim().toLowerCase();

            if (!filterText) {
                return rows.slice();
            }

            return rows.filter((row) => {
                return columns.some((column) => {
                    const value = row[column]?.value ?? "";
                    return String(value).toLowerCase().includes(filterText);
                });
            });
        }

        function applySorting(rows) {
            if (!tableState.sortColumn) {
                return rows.slice();
            }

            const column = tableState.sortColumn;
            const direction = tableState.sortDirection === "asc" ? 1 : -1;

            return rows.slice().sort((left, right) => {
                const leftValue = String(left[column]?.value ?? "").toLowerCase();
                const rightValue = String(right[column]?.value ?? "").toLowerCase();

                if (leftValue < rightValue) {
                    return -1 * direction;
                }

                if (leftValue > rightValue) {
                    return 1 * direction;
                }

                return 0;
            });
        }

        function getColumnWidth(column) {
            return tableState.columnWidths[column];
        }

        function setColumnWidth(column, width) {
            tableState.columnWidths[column] = Math.max(MIN_COLUMN_WIDTH, Math.round(width));
        }

        function beginResize(event, handle, column) {
            event.preventDefault();
            event.stopPropagation();

            const header = handle.closest("th");
            if (!header) {
                return;
            }

            activeResize = {
                column,
                startX: event.clientX,
                startWidth: header.getBoundingClientRect().width,
                header
            };

            header.classList.add("resizing");
            window.addEventListener("mousemove", onResizeMove);
            window.addEventListener("mouseup", endResize);
        }

        function onResizeMove(event) {
            if (!activeResize) {
                return;
            }

            const delta = event.clientX - activeResize.startX;
            const nextWidth = activeResize.startWidth + delta;
            setColumnWidth(activeResize.column, nextWidth);
            applyColumnWidthsToLiveTable();
        }

        function endResize() {
            if (activeResize?.header) {
                activeResize.header.classList.remove("resizing");
            }

            window.removeEventListener("mousemove", onResizeMove);
            window.removeEventListener("mouseup", endResize);
            activeResize = null;
        }

        function applyColumnWidthsToLiveTable() {
            const allColumnElements = tableView.querySelectorAll("[data-column]");
            allColumnElements.forEach((element) => {
                const column = element.getAttribute("data-column") ?? "";
                const width = getColumnWidth(column);

                if (!column || !width) {
                    return;
                }

                element.style.width = width + "px";
                element.style.minWidth = width + "px";
                element.style.maxWidth = width + "px";
            });
        }

        
        function openOverflowMenu(trigger, sourceMenu) {
            const triggerRect = trigger.getBoundingClientRect();
            openOverflowMenuAtPosition(triggerRect.right, triggerRect.bottom + 4, sourceMenu, trigger);
        }

        function openOverflowMenuAtPosition(clientX, clientY, sourceMenu, anchor) {
            closeAllOverflowMenus();

            const overlayMenu = sourceMenu.cloneNode(true);
            overlayMenu.removeAttribute("hidden");
            overlayMenu.classList.remove("open-up");
            overlayMenu.classList.add("overflow-menu-overlay");
            overlayMenu.style.position = "fixed";
            overlayMenu.style.zIndex = "9999";

            document.body.appendChild(overlayMenu);

            const viewportPadding = 8;
            overlayMenu.style.top = Math.round(clientY) + "px";
            overlayMenu.style.left = Math.round(clientX) + "px";

            const menuRect = overlayMenu.getBoundingClientRect();

            let top = clientY;
            let left = clientX;

            if (anchor) {
                left = clientX - menuRect.width;
            }

            if (top + menuRect.height > window.innerHeight - viewportPadding) {
                top = clientY - menuRect.height - (anchor ? 8 : 0);
            }

            if (top < viewportPadding) {
                top = viewportPadding;
            }

            if (left < viewportPadding) {
                left = viewportPadding;
            }

            if (left + menuRect.width > window.innerWidth - viewportPadding) {
                left = Math.max(viewportPadding, window.innerWidth - menuRect.width - viewportPadding);
            }

            overlayMenu.style.top = Math.round(top) + "px";
            overlayMenu.style.left = Math.round(left) + "px";

            const menuButtons = overlayMenu.querySelectorAll("[data-action-id]");
            menuButtons.forEach((button) => {
                button.addEventListener("click", (event) => {
                    event.stopPropagation();
                    executeAction(button);
                    closeAllOverflowMenus();
                });
            });

            overlayMenu.addEventListener("click", (event) => {
                event.stopPropagation();
            });

            activeOverflowMenu = overlayMenu;
            activeOverflowAnchor = anchor ?? null;
        }

        function beginDrawerResize(event, handle, column) {
            event.preventDefault();
            event.stopPropagation();

            const header = handle.closest("th");
            if (!header) {
                return;
            }

            activeDrawerResize = {
                column,
                startX: event.clientX,
                startWidth: header.getBoundingClientRect().width,
                header
            };

            header.classList.add("drawer-resizing");
            window.addEventListener("mousemove", onDrawerResizeMove);
            window.addEventListener("mouseup", endDrawerResize);
        }

        function onDrawerResizeMove(event) {
            if (!activeDrawerResize) {
                return;
            }

            const delta = event.clientX - activeDrawerResize.startX;
            const nextWidth = Math.max(MIN_COLUMN_WIDTH, Math.round(activeDrawerResize.startWidth + delta));
            drawerColumnWidths[activeDrawerResize.column] = nextWidth;
            applyDrawerColumnWidths();
        }

        function endDrawerResize() {
            if (activeDrawerResize?.header) {
                activeDrawerResize.header.classList.remove("drawer-resizing");
            }

            window.removeEventListener("mousemove", onDrawerResizeMove);
            window.removeEventListener("mouseup", endDrawerResize);
            activeDrawerResize = null;
        }

        function applyDrawerColumnWidths() {
            const allDrawerColumns = arrayDrawerTableView.querySelectorAll("[data-drawer-column]");
            allDrawerColumns.forEach((element) => {
                const column = element.getAttribute("data-drawer-column") ?? "";
                const width = drawerColumnWidths[column];

                if (!column || !width) {
                    return;
                }

                element.style.width = width + "px";
                element.style.minWidth = width + "px";
                element.style.maxWidth = width + "px";
            });
        }

        function closeAllOverflowMenus() {
            if (activeOverflowMenu && activeOverflowMenu.parentNode) {
                activeOverflowMenu.parentNode.removeChild(activeOverflowMenu);
            }

            activeOverflowMenu = null;
            activeOverflowAnchor = null;

            const menus = tableView.querySelectorAll(".overflow-menu");
            menus.forEach((menu) => {
                menu.setAttribute("hidden", "hidden");
                menu.classList.remove("open-up");
            });
        }

        function executeAction(element) {

            const actionId = element.getAttribute("data-action-id") ?? "";
            const guid = element.getAttribute("data-guid") ?? "";
            const entitySetName = element.getAttribute("data-entity-set-name") ?? "";
            const entityLogicalName = element.getAttribute("data-entity-logical-name") ?? "";
            const columnName = element.getAttribute("data-column-name") ?? "";
            const rawValue = element.getAttribute("data-raw-value") ?? "";

            if (!actionId) {
                return;
            }

            vscodeApi.postMessage({
                type: "executeResultViewerAction",
                payload: {
                    actionId,
                    guid,
                    entitySetName,
                    entityLogicalName,
                    columnName,
                    rawValue
                }
            });
        }


        function csvEscape(value) {
            const text = String(value ?? "");

            if (text.includes(",") || text.includes("\\n") || text.includes("\\r") || text.includes('"')) {
                return '"' + text.replace(/"/g, '""') + '"';
            }

            return text;
        }

        function buildCsv(columns, rows) {
            const header = columns.map((column) => csvEscape(column)).join(",");
            const lines = rows.map((row) => {
                return columns
                    .map((column) => {
                        const cell = row[column];
                        const rawValue = cell?.rawValue;

                        if (Array.isArray(rawValue) || (rawValue && typeof rawValue === "object")) {
                            return csvEscape(JSON.stringify(rawValue));
                        }

                        return csvEscape(cell?.copyValue ?? cell?.value ?? "");
                    })
                    .join(",");
            });

            return [header].concat(lines).join("\\r\\n");
        }

        function buildExportFileName(currentModel) {
            const baseName = String(currentModel.entityLogicalName || currentModel.entitySetName || "dv-quick-run-results")
                .replace(/[^a-z0-9-_]+/gi, "-")
                .replace(/^-+|-+$/g, "") || "dv-quick-run-results";

            return baseName + ".csv";
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
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/\"/g, "&quot;");
        }
    </script>
</body>
</html>
`;
}
