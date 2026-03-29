export const RESULT_VIEWER_SCRIPT_RENDERERS = String.raw`
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
                                "<button class=\\"inline-action inline-action-labeled\\"" +
                                " title=\\"" + escapeAttribute(action.title) + "\\"" +
                                " data-action-id=\\"" + escapeAttribute(action.id) + "\\"" +
                                " data-guid=\\"" + escapeAttribute(action.payload?.guid ?? "") + "\\"" +
                                " data-entity-set-name=\\"" + escapeAttribute(action.payload?.entitySetName ?? "") + "\\"" +
                                " data-entity-logical-name=\\"" + escapeAttribute(action.payload?.entityLogicalName ?? "") + "\\"" +
                                " data-column-name=\\"" + escapeAttribute(action.payload?.columnName ?? "") + "\\"" +
                                " data-raw-value=\\"" + escapeAttribute(action.payload?.rawValue ?? "") + "\\"" +
                                " data-traversal-session-id=\\"" + escapeAttribute(action.payload?.traversalSessionId ?? "") + "\\"" +
                                " data-traversal-leg-index=\\"" + escapeAttribute(String(action.payload?.traversalLegIndex ?? "")) + "\\"" +
                                " data-carry-field=\\"" + escapeAttribute(action.payload?.carryField ?? "") + "\\"" +
                                " data-carry-value=\\"" + escapeAttribute(action.payload?.carryValue ?? "") + "\\">" +
                                  "<span class=\\"inline-action-icon\\">" + escapeHtml(action.icon) + "</span>" +
                                "</button>";
                        });

                        if (overflowActions.length > 0) {
                            html +=
                                "<button class=\\"inline-action overflow-trigger\\" type=\\"button\\" title=\\"More actions\\">⋮</button>" +
                                "<div class=\\"overflow-menu\\" hidden>";

                            overflowActions.forEach((action) => {
                                html +=
                                    "<button class=\\"inline-action inline-action-labeled\\"" +
                                    " title=\\"" + escapeAttribute(action.title) + "\\"" +
                                    " data-action-id=\\"" + escapeAttribute(action.id) + "\\"" +
                                    " data-guid=\\"" + escapeAttribute(action.payload?.guid ?? "") + "\\"" +
                                    " data-entity-set-name=\\"" + escapeAttribute(action.payload?.entitySetName ?? "") + "\\"" +
                                    " data-entity-logical-name=\\"" + escapeAttribute(action.payload?.entityLogicalName ?? "") + "\\"" +
                                    " data-column-name=\\"" + escapeAttribute(action.payload?.columnName ?? "") + "\\"" +
                                    " data-raw-value=\\"" + escapeAttribute(action.payload?.rawValue ?? "") + "\\"" +
                                    " data-traversal-session-id=\\"" + escapeAttribute(action.payload?.traversalSessionId ?? "") + "\\"" +
                                    " data-traversal-leg-index=\\"" + escapeAttribute(String(action.payload?.traversalLegIndex ?? "")) + "\\"" +
                                    " data-carry-field=\\"" + escapeAttribute(action.payload?.carryField ?? "") + "\\"" +
                                    " data-carry-value=\\"" + escapeAttribute(action.payload?.carryValue ?? "") + "\\">" +
                                    "<span class=\\"inline-action-icon\\">" + escapeHtml(action.icon) + "</span>" +
                                    "<span class=\\"inline-action-label\\">" + escapeHtml(action.title) + "</span>" +
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
`;
