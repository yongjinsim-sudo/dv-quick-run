export const RESULT_VIEWER_SCRIPT_RENDERERS = `
function renderSiblingExpandButton(currentModel) {
            const canShow = !!currentModel.traversal && !!currentModel.traversal.canSiblingExpand && !!currentModel.traversal.traversalSessionId;
            siblingExpandBtn.hidden = !canShow;
        }

        function renderTraversalBatchButton(currentModel) {
            const canShow = !!currentModel.traversal && !!currentModel.traversal.canRunBatch && !!currentModel.traversal.traversalSessionId;
            if (runTraversalBatchBtn instanceof HTMLButtonElement) {
                runTraversalBatchBtn.hidden = !canShow;
            }
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
            if (jsonPanel instanceof HTMLElement) {
                jsonPanel.hidden = true;
            }
            if (jsonTools instanceof HTMLElement) {
                jsonTools.hidden = true;
            }
            showTableBtn.classList.add("active");
            showJsonBtn.classList.remove("active");
            assertExclusiveViewMode();

            renderTable(model);
        }

        function showJson() {
            tableView.style.display = "none";
            if (jsonPanel instanceof HTMLElement) {
                jsonPanel.hidden = false;
            }
            if (jsonTools instanceof HTMLElement) {
                jsonTools.hidden = false;
            }
            showJsonBtn.classList.add("active");
            showTableBtn.classList.remove("active");
            assertExclusiveViewMode();

            renderJson(model);

            const activeJsonSearchInput = document.getElementById("jsonSearchInput");
            if (activeJsonSearchInput instanceof HTMLInputElement) {
                activeJsonSearchInput.focus();
                if (!activeJsonSearchInput.value.trim()) {
                    activeJsonSearchInput.select();
                }
            }
        }


        function renderJson(currentModel) {
            renderBatchResponseBar();
            const searchText = String(jsonState.searchText ?? "");

            if (jsonSearchInput instanceof HTMLInputElement && jsonSearchInput.value !== searchText) {
                jsonSearchInput.value = searchText;
            }

            const rawJson = typeof currentModel.rawJson === "string" ? currentModel.rawJson : "";
            if (!rawJson) {
                const requested = requestSessionJsonIfNeeded(currentModel);
                jsonState.currentMatchIndex = -1;
                jsonView.innerHTML = "<div class=\\"empty-state\\">" +
                    "<div class=\\"empty-title\\">" + escapeHtml(sessionJsonState.error || (requested ? "Loading JSON…" : "No JSON payload available")) + "</div>" +
                    "<div class=\\"empty-hint\\">" + escapeHtml(requested ? "The full JSON payload is being loaded from the Result Viewer session." : "Try Save JSON if the session has expired.") + "</div>" +
                    "</div>";
                updateJsonMatchStatus(0, 0);
                updateJsonNavigationButtons(0);
                return;
            }

            const normalizedSearchText = searchText.trim();
            if (!normalizedSearchText) {
                jsonState.currentMatchIndex = -1;
                jsonView.innerHTML = escapeHtml(rawJson);
                updateJsonMatchStatus(0, 0);
                updateJsonNavigationButtons(0);
                return;
            }

            const highlightedHtml = buildHighlightedJsonHtml(rawJson, normalizedSearchText);
            jsonView.innerHTML = highlightedHtml;

            const matches = Array.from(jsonView.querySelectorAll(".json-match"));
            if (matches.length === 0) {
                jsonState.currentMatchIndex = -1;
                updateJsonMatchStatus(0, 0);
                updateJsonNavigationButtons(0);
                return;
            }

            if (jsonState.currentMatchIndex < 0 || jsonState.currentMatchIndex >= matches.length) {
                jsonState.currentMatchIndex = 0;
            }

            activateJsonMatch(matches, jsonState.currentMatchIndex);
            updateJsonMatchStatus(jsonState.currentMatchIndex + 1, matches.length);
            updateJsonNavigationButtons(matches.length);
        }

        function groupActionsByGroup(actions) {
            const order = ["refine", "slice", "dice", "correct", "investigate", "traversal", "copy", "metadata"];
            const labels = { refine: "Refine", slice: "Slice", dice: "Dice", correct: "Correct", investigate: "Investigate", traversal: "Traversal", copy: "Copy", metadata: "Metadata" };
            return order
                .map((group) => ({ group, label: labels[group], actions: actions.filter((action) => action.group === group) }))
                .filter((entry) => entry.actions.length > 0);
        }

        function buildActionButtonHtml(action, includeLabel) {
            const isEnabled = action.isEnabled !== false;
            const title = isEnabled
                ? action.title
                : (action.disabledReason
                    ? action.title + " — " + action.disabledReason
                    : action.title + " — Unavailable in this context");
            return "<button class=\\"inline-action inline-action-labeled" + (isEnabled ? "" : " is-disabled") + "\\"" +
                (isEnabled ? "" : " disabled aria-disabled=\\"true\\"") +
                " title=\\"" + escapeAttribute(action.title) + "\\"" +
                " data-action-id=\\"" + escapeAttribute(action.id) + "\\"" +
                " data-guid=\\"" + escapeAttribute(action.payload?.guid ?? "") + "\\"" +
                " data-entity-set-name=\\"" + escapeAttribute(action.payload?.entitySetName ?? "") + "\\"" +
                " data-entity-logical-name=\\"" + escapeAttribute(action.payload?.entityLogicalName ?? "") + "\\"" +
                " data-primary-id-field=\\"" + escapeAttribute(action.payload?.primaryIdField ?? "") + "\\"" +
                " data-field-logical-name=\\"" + escapeAttribute(action.payload?.fieldLogicalName ?? action.payload?.columnName ?? "") + "\\"" +
                " data-field-attribute-type=\\"" + escapeAttribute(action.payload?.fieldAttributeType ?? "") + "\\"" +
                " data-column-name=\\"" + escapeAttribute(action.payload?.columnName ?? "") + "\\"" +
                " data-raw-value=\\"" + escapeAttribute(action.payload?.rawValue ?? "") + "\\"" +
                " data-display-value=\\"" + escapeAttribute(action.payload?.displayValue ?? "") + "\\"" +
                " data-is-null-value=\\"" + escapeAttribute(action.payload?.isNullValue === true ? "true" : "false") + "\\"" +
                " data-source-document-uri=\\"" + escapeAttribute(action.payload?.sourceDocumentUri ?? "") + "\\"" +
                " data-source-range-start-line=\\"" + escapeAttribute(String(action.payload?.sourceRangeStartLine ?? "")) + "\\"" +
                " data-source-range-start-character=\\"" + escapeAttribute(String(action.payload?.sourceRangeStartCharacter ?? "")) + "\\"" +
                " data-source-range-end-line=\\"" + escapeAttribute(String(action.payload?.sourceRangeEndLine ?? "")) + "\\"" +
                " data-source-range-end-character=\\"" + escapeAttribute(String(action.payload?.sourceRangeEndCharacter ?? "")) + "\\"" +
                " data-slice-operation=\\"" + escapeAttribute(action.payload?.sliceOperation ?? "") + "\\"" +
                " data-traversal-session-id=\\"" + escapeAttribute(action.payload?.traversalSessionId ?? "") + "\\"" +
                " data-traversal-leg-index=\\"" + escapeAttribute(String(action.payload?.traversalLegIndex ?? "")) + "\\"" +
                " data-carry-field=\\"" + escapeAttribute(action.payload?.carryField ?? "") + "\\"" +
                " data-carry-value=\\"" + escapeAttribute(action.payload?.carryValue ?? "") + "\\">" +
                "<span class=\\"inline-action-icon\\">" + escapeHtml(action.icon) + "</span>" +
                (includeLabel ? "<span class=\\"inline-action-label\\">" + escapeHtml(action.title) + "</span>" : "") +
                "</button>";
        }

        function buildGroupedOverflowMenuHtml(actions) {
            const groups = groupActionsByGroup(actions);
            return groups.map((entry) => {
                return "<div class=\\"overflow-group\\">" +
                    "<div class=\\"overflow-group-title\\">" + escapeHtml(entry.label) + "</div>" +
                    entry.actions.map((action) => buildActionButtonHtml(action, true)).join("") +
                    "</div>";
            }).join("");
        }


        function buildBatchErrorHtml(currentModel) {
            const batchError = currentModel.batchError || {};
            const rawBody = typeof batchError.rawBody === "string" && batchError.rawBody.trim()
                ? batchError.rawBody
                : (typeof currentModel.rawJson === "string" ? currentModel.rawJson : "");

            return "<div class=\\"batch-error-card\\">" +
                "<div class=\\"batch-error-title\\">Request failed</div>" +
                "<div class=\\"batch-error-meta\\">Query: " + escapeHtml(batchError.queryText || currentModel.queryPath || "") + "</div>" +
                "<div class=\\"batch-error-meta\\">Status: " + escapeHtml(String(batchError.statusCode || 0) + " " + String(batchError.statusText || "").trim()) + "</div>" +
                "<div class=\\"batch-error-message\\">" + escapeHtml(batchError.message || "Batch request failed") + "</div>" +
                (rawBody
                    ? "<pre class=\\"batch-error-raw\\">" + escapeHtml(rawBody) + "</pre>"
                    : "") +
                "</div>";
        }

function renderTable(currentModel) {
            const batchTabsHtml = isBatchRoot ? buildBatchResponseTabsHtml() : "";

            if (isBatchSummarySelected()) {
                tableView.innerHTML =
                    "<div class=\\"table-tools\\">" +
                    "<div class=\\"table-tools-left\\">" +
                    (batchTabsHtml ? "<div class=\\"batch-response-bar\\">" + batchTabsHtml + "</div>" : "") +
                    "</div>" +
                    "<div class=\\"table-tools-right\\"></div>" +
                    "</div>" +
                    buildBatchSummaryHtml();
                return;
            }

            if (!currentModel.columns || currentModel.columns.length === 0) {
                const emptyOrErrorHtml = currentModel.batchError
                    ? buildBatchErrorHtml(currentModel)
                    : "<div class=\\"empty-state\\">" +
                        "<div class=\\"empty-title\\">No results found</div>" +
                        "<div class=\\"empty-hint\\">Try:</div>" +
                        "<ul class=\\"empty-list\\">" +
                        "<li>Removing filters</li>" +
                        "<li>Increasing $top</li>" +
                        "<li>Running without $filter</li>" +
                        "</ul>" +
                        "</div>";

                tableView.innerHTML =
                    "<div class=\\"table-tools\\">" +
                    "<div class=\\"table-tools-left\\">" +
                    (batchTabsHtml ? "<div class=\\"batch-response-bar\\">" + batchTabsHtml + "</div>" : "") +
                    "</div>" +
                    "<div class=\\"table-tools-right\\"></div>" +
                    "</div>" +
                    emptyOrErrorHtml;
                return;
            }

            const hasSession = !!currentModel.session;
            const sessionOffset = hasSession ? Number(currentModel.session.rowOffset || 0) : 0;
            const loadedRowCount = Array.isArray(currentModel.rows) ? currentModel.rows.length : 0;
            const totalRowCount = currentModel.session && typeof currentModel.session.totalRows === "number"
                ? currentModel.session.totalRows
                : loadedRowCount;
            const windowLimit = hasSession ? Number(currentModel.session.chunkSize || loadedRowCount || 100) : loadedRowCount;
            const windowStart = totalRowCount === 0 ? 0 : sessionOffset + 1;
            const windowEnd = Math.min(sessionOffset + loadedRowCount, totalRowCount);
            const searchText = String(tableState.filterText ?? "").trim();
            const searchResultMode = searchText.length > 0 && Array.isArray(sessionSearchState.matchingRowIndexes) && sessionSearchState.matchingRowIndexes.length > 0;
            const visibleRows = searchResultMode
                ? applySorting(currentModel.rows, currentModel.columns)
                : applySorting(
                    applyFilter(currentModel.rows, currentModel.columns),
                    currentModel.columns
                );

            const visibleRowCount = visibleRows.length;
            const hasFilter = String(tableState.filterText ?? "").trim().length > 0;
            const progressiveRenderStart = Date.now();
            const progressiveRender = syncProgressiveRenderState(currentModel, visibleRowCount, hasFilter);
            const renderedRows = progressiveRender.useLargeResultMode
                ? visibleRows.slice(0, progressiveRender.renderedCount)
                : visibleRows;
            const renderDurationMs = Date.now() - progressiveRenderStart;
            sessionChunkState.lastRenderDurationMs = renderDurationMs;

            const searchStatusText = sessionSearchState.loading && searchText
                ? "Searching " + totalRowCount + " rows…"
                : (searchText
                    ? (sessionSearchState.error
                        ? sessionSearchState.error
                        : sessionSearchState.matchCount + " matching rows across " + (sessionSearchState.totalRows || totalRowCount) + " rows")
                    : "");
            const tableStatusText = hasFilter
                ? (searchStatusText || (visibleRowCount + " of " + totalRowCount + " rows visible"))
                : (progressiveRender.useLargeResultMode
                    ? progressiveRender.renderedCount + " of " + visibleRowCount + " shown rows rendered"
                    : (hasSession ? "Rows " + windowStart + "–" + windowEnd + " of " + totalRowCount + " shown" : totalRowCount + " rows"));
            const showWarning = hasSession && (windowLimit >= LARGE_ROW_WINDOW_WARNING_THRESHOLD || sessionChunkState.warning || renderDurationMs > SLOW_RENDER_WARNING_MS);
            const warningText = renderDurationMs > SLOW_RENDER_WARNING_MS
                ? "Viewer is taking longer than expected. Try showing fewer rows or adding $select."
                : (sessionChunkState.warning || "Showing up to 1000 rows per view for responsiveness. Search and export still use the full current page.");

            let windowControlsHtml = "";
            if (hasSession) {
                const rowWindowOptions = getRowWindowSizeOptions(totalRowCount);
                const maxVisibleOption = rowWindowOptions[rowWindowOptions.length - 1] || 100;
                const activeWindowLimit = rowWindowOptions.includes(windowLimit) ? windowLimit : maxVisibleOption;
                const hasMultipleWindows = totalRowCount > activeWindowLimit;
                const canPrevWindow = hasMultipleWindows && sessionOffset > 0 && !sessionChunkState.loading;
                const canNextWindow = hasMultipleWindows && sessionOffset + activeWindowLimit < totalRowCount && !sessionChunkState.loading;
                const navControlsHtml = hasMultipleWindows
                    ? "<button class='row-window-nav-btn' type='button' data-row-window-nav='prev'" + (canPrevWindow ? "" : " disabled") + ">‹</button>" +
                        "<button class='row-window-nav-btn' type='button' data-row-window-nav='next'" + (canNextWindow ? "" : " disabled") + ">›</button>"
                    : "";

                windowControlsHtml = "<div class='row-window-controls'>" +
                    "<span class='row-window-label'>Show</span>" +
                    rowWindowOptions.map((size) => {
                        const active = activeWindowLimit === size ? " active" : "";
                        return "<button class='row-window-size-btn" + active + "' type='button' data-row-window-size='" + size + "'>" + size + "</button>";
                    }).join("") +
                    navControlsHtml +
                    "<span id='rowWindowStatus' class='row-window-status'>" + escapeHtml(sessionChunkState.loading ? "Loading rows…" : ("Rows " + windowStart + "–" + windowEnd + " of " + totalRowCount)) + "</span>" +
                    "</div>";
            }

            let html = "<div class='table-tools'>" +
                "<div class='table-tools-left'>" +
                (batchTabsHtml ? "<div class='batch-response-bar'>" + batchTabsHtml + "</div>" : "") +
                windowControlsHtml +
                "</div>" +
                "<div class='table-tools-right'>" +
                "<input id='tableFilterInput' class='table-filter-input' type='text' placeholder='Search all rows on this page...' value='" + escapeAttribute(tableState.filterText) + "' />" +
                "<button id='tableFilterClearBtn' class='table-filter-clear-btn' type='button' title='Clear table search'>Clear</button>" +
                "<span id='tableFilterStatus' class='table-filter-status'>" + escapeHtml(tableStatusText) + "</span>" +
                "</div>" +
                "</div>";

            if (showWarning) {
                html += "<div class='large-result-banner warning'>" +
                    "<span class='large-result-title'>Performance note</span>" +
                    "<span class='large-result-text'>" + escapeHtml(warningText) + "</span>" +
                    "</div>";
            }

            if (progressiveRender.useLargeResultMode) {
                const isComplete = progressiveRender.renderedCount >= visibleRowCount;
                html += "<div class=\\"large-result-banner\\">" +
                    "<span class=\\"large-result-title\\">Large result mode</span>" +
                    "<span class=\\"large-result-text\\">Showing " + progressiveRender.renderedCount + " of " + visibleRowCount + " rows in the current window for faster rendering" + (isComplete ? "." : " — continuing automatically…") + "</span>" +
                    "</div>";
            }

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

            if (renderedRows.length === 0) {
                html += "<tr><td class=\\"empty-filter-state\\" colspan=\\"" + currentModel.columns.length + "\\">No matching rows.</td></tr>";
            }

            arrayDrawerPayloads.clear();
            renderedRows.forEach((row, rowIndex) => {
                const rowPosition = Array.isArray(currentModel.rows) ? currentModel.rows.indexOf(row) : rowIndex;
                const sessionSourceIndexes = currentModel.session && Array.isArray(currentModel.session.sourceRowIndexes)
                    ? currentModel.session.sourceRowIndexes
                    : undefined;
                const sourceRowIndex = sessionSourceIndexes && typeof sessionSourceIndexes[rowPosition] === "number"
                    ? sessionSourceIndexes[rowPosition]
                    : ((currentModel.session && typeof currentModel.session.rowOffset === "number")
                        ? currentModel.session.rowOffset + rowPosition
                        : rowPosition);
                html += "<tr data-row-index=\\"" + rowIndex + "\\" data-source-row-index=\\"" + sourceRowIndex + "\\">";

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

                    const hasDisplayValue = value !== undefined && value !== null && String(value).length > 0;
                    const isNullDisplayCell = cell?.valueType === "empty";
                    const actionDisplayValue = hasDisplayValue ? value : (isNullDisplayCell ? "∅" : value);
                    const nullClass = isNullDisplayCell ? " null-value-cell" : "";
                    const nullTitleAttribute = isNullDisplayCell ? " title=\\"Null value\\" aria-label=\\"Null value\\"" : "";

                    if (actions.length > 0 && (hasDisplayValue || isNullDisplayCell) && !Array.isArray(cell && cell.rawValue)) {
                        html += "<td class=\\"context-action-cell" + nullClass + "\\" data-column=\\"" + escapeAttribute(column) + "\\"" + nullTitleAttribute + widthStyle + ">";
                        html += "<span class=\\"guid-cell\\">";
                        html += "<span class=\\"guid-value copyable" + nullClass + "\\" data-copy-value=\\"" + escapeAttribute(copyValue) + "\\"" + nullTitleAttribute + ">" + escapeHtml(actionDisplayValue) + "</span>";
                        html += "<span class=\\"cell-actions\\">";
                        html += "<span class=\\"primary-actions\\">";

                        primaryActions.forEach((action) => {
                            html += buildActionButtonHtml(action, false);
                        });
                        html += "</span>";

                        if (overflowActions.length > 0) {
                            html += "<span class=\\"overflow-actions\\">";
                            html +=
                                "<button class=\\"inline-action overflow-trigger\\" type=\\"button\\" title=\\"More actions\\">⋮</button>" +
                                "<div class=\\"overflow-menu\\" hidden>" + buildGroupedOverflowMenuHtml(overflowActions) + "</div>";
                            html += "</span>";
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

                            const displayCellValue = valueType === "empty" ? "∅" : value;
                            const cellNullClass = valueType === "empty" ? " null-value-cell" : "";
                            const cellNullTitleAttribute = valueType === "empty" ? " title=\\"Null value\\" aria-label=\\"Null value\\"" : "";
                            html += "<td class=\\"" + (isDrawerCell ? "array-cell" : "copyable") + cellNullClass + "\\" data-column=\\"" + escapeAttribute(column) + "\\" data-copy-value=\\"" + escapeAttribute(copyValue) + "\\"" + cellNullTitleAttribute + (isDrawerCell ? " data-array-drawer-key=\\"" + escapeAttribute(arrayDrawerKey) + "\\"" : "") + widthStyle + ">" +
                                (isDrawerCell
                                    ? "<span class=\\"array-cell-content\\"><span class=\\"array-badge\\">" + escapeHtml(isArrayCell ? "ARRAY" : "OBJECT") + "</span><span class=\\"array-cell-text\\">" + escapeHtml(value) + "</span></span>"
                                    : escapeHtml(displayCellValue)) +
                                "</td>";
                    }
                });

                html += "</tr>";
            });

            html += "</tbody></table>";
            html += renderLegend(currentModel);

            tableView.innerHTML = html;
            applyColumnWidthsToLiveTable();

            if (progressiveRender.useLargeResultMode) {
                scheduleProgressiveRender(currentModel, progressiveRender.signature, visibleRowCount, progressiveRender.renderedCount);
            } else {
                clearProgressiveRenderTimer();
            }
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
