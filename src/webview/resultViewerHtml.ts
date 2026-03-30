import * as vscode from "vscode";
import { ResultViewerModel } from "../services/resultViewModelBuilder.js";
import { getResultViewerMarkup } from "./resultViewer/markup.js";
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

    const initialModelJson = escapeForScript(JSON.stringify(model));

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
        const vscodeApi = acquireVsCodeApi();

        const tableView = document.getElementById("tableView");
        const jsonView = document.getElementById("jsonView");
        const showTableBtn = document.getElementById("showTableBtn");
        const showJsonBtn = document.getElementById("showJsonBtn");
        const showRelationshipsBtn = document.getElementById("showRelationshipsBtn");
        const showMetadataBtn = document.getElementById("showMetadataBtn");
        const exportCsvBtn = document.getElementById("exportCsvBtn");
        const siblingExpandBtn = document.getElementById("siblingExpandBtn");
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

        siblingExpandBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "applySiblingExpand",
                payload: {
                    traversalSessionId: model.traversal?.traversalSessionId || ""
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
        renderSiblingExpandButton(model);
        renderTable(model);
        jsonView.textContent = model.rawJson;
        rowCount.textContent = model.rowCount + " rows returned";

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }


        function renderSiblingExpandButton(currentModel) {
            const canShow = !!currentModel.traversal && !!currentModel.traversal.canSiblingExpand && !!currentModel.traversal.traversalSessionId;
            siblingExpandBtn.hidden = !canShow;
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
                    const rawValue = cell && cell.rawValue;
                    const isObjectCell = isPlainObject(rawValue);
                    const value = isObjectCell ? "{...}" : (cell?.value ?? "");
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
                            const valueType = cell?.valueType ?? "scalar";
                            const isArrayCell = valueType === "array";
                            const isObjectDrawerCell = valueType === "object";
                            const isDrawerCell = isArrayCell || isObjectDrawerCell;
                            const drawerPayload = cell?.drawerPayload?.payload;
                            const arrayDrawerKey = isDrawerCell ? (column + "::" + rowIndex) : "";

                            if (isDrawerCell && drawerPayload !== undefined) {
                                arrayDrawerPayloads.set(arrayDrawerKey, {
                                    column,
                                    payload: isObjectDrawerCell ? [drawerPayload] : drawerPayload
                                });
                            }

                            html += "<td class=\\"" + (isDrawerCell ? "array-cell" : "copyable") + "\\" data-column=\\"" + escapeAttribute(column) + "\\" data-copy-value=\\"" + escapeAttribute(copyValue) + "\\"" + (isDrawerCell ? " data-array-drawer-key=\\"" + escapeAttribute(arrayDrawerKey) + "\\"" : "") + widthStyle + ">" +
                                (isDrawerCell
                                    ? "<span class=\\"array-cell-content\\"><span class=\\"array-badge\\">" + escapeHtml(isArrayCell ? "ARRAY" : "OBJECT") + "</span><span class=\\"array-cell-text\\">" + escapeHtml(value) + "</span></span>"
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
                        return csvEscape(cell?.exportValue ?? cell?.copyValue ?? cell?.value ?? "");
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
