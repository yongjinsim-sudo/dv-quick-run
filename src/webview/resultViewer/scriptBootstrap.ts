export const RESULT_VIEWER_SCRIPT_BOOTSTRAP = `
        const vscodeApi = acquireVsCodeApi();

        const tableView = document.getElementById("tableView");
        const jsonPanel = document.getElementById("jsonPanel");
        const jsonTools = document.getElementById("jsonTools");
        const jsonView = document.getElementById("jsonView");
        const jsonSearchInput = document.getElementById("jsonSearchInput");
        const jsonPrevMatchBtn = document.getElementById("jsonPrevMatchBtn");
        const jsonNextMatchBtn = document.getElementById("jsonNextMatchBtn");
        const jsonClearSearchBtn = document.getElementById("jsonClearSearchBtn");
        const jsonMatchStatus = document.getElementById("jsonMatchStatus");
        const batchResponseBar = document.getElementById("batchResponseBar");
        const showTableBtn = document.getElementById("showTableBtn");
        const showJsonBtn = document.getElementById("showJsonBtn");
        const showRelationshipsBtn = document.getElementById("showRelationshipsBtn");
        const showMetadataBtn = document.getElementById("showMetadataBtn");
        const exportCsvBtn = document.getElementById("exportCsvBtn");
        const saveJsonBtn = document.getElementById("saveJsonBtn");
        const previousPageBtn = document.getElementById("previousPageBtn");
        const nextPageBtn = document.getElementById("nextPageBtn");
        const siblingExpandBtn = document.getElementById("siblingExpandBtn");
        const runTraversalBatchBtn = document.getElementById("runTraversalBatchBtn");
        const pageIndicator = document.getElementById("pageIndicator");
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
        const traversalStatus = document.getElementById("traversalStatus");
        const binderSuggestionBtn = document.getElementById("binderSuggestionBtn");

        const rootModel = JSON.parse(__INITIAL_MODEL_JSON__);
        const isBatchRoot = !!rootModel && rootModel.type === "batch";
        const BATCH_SUMMARY_KEY = "summary";
        let activeBatchKey = isBatchRoot && typeof rootModel.selectedKey === "string" ? rootModel.selectedKey : BATCH_SUMMARY_KEY;
        const batchViewStateByKey = {};

        function createDefaultViewState() {
            return {
                sortColumn: null,
                sortDirection: "asc",
                filterText: "",
                columnWidths: {},
                jsonSearchText: "",
                jsonCurrentMatchIndex: -1
            };
        }

        function getCurrentViewState() {
            return {
                sortColumn: tableState.sortColumn,
                sortDirection: tableState.sortDirection,
                filterText: tableState.filterText,
                columnWidths: Object.assign({}, tableState.columnWidths),
                jsonSearchText: jsonState.searchText,
                jsonCurrentMatchIndex: jsonState.currentMatchIndex
            };
        }

        function applyViewState(nextState) {
            const safeState = nextState || createDefaultViewState();
            tableState.sortColumn = safeState.sortColumn ?? null;
            tableState.sortDirection = safeState.sortDirection ?? "asc";
            tableState.filterText = safeState.filterText ?? "";
            tableState.columnWidths = Object.assign({}, safeState.columnWidths || {});
            jsonState.searchText = safeState.jsonSearchText ?? "";
            jsonState.currentMatchIndex = typeof safeState.jsonCurrentMatchIndex === "number"
                ? safeState.jsonCurrentMatchIndex
                : -1;
        }

        function getBatchItems() {
            return isBatchRoot && Array.isArray(rootModel.items) ? rootModel.items : [];
        }

        function getActiveBatchItem() {
            if (!isBatchRoot || activeBatchKey === BATCH_SUMMARY_KEY) {
                return null;
            }

            return getBatchItems().find((item) => item.key === activeBatchKey) || null;
        }

        function buildBatchSummaryModel() {
            const items = getBatchItems();
            const summary = rootModel.summary || {};
            return {
                title: rootModel.title || "DV Quick Run Batch Results",
                mode: "raw",
                columns: [],
                rows: [],
                rawJson: JSON.stringify({
                    summary: {
                        totalRequests: summary.totalRequests ?? items.length,
                        successCount: summary.successCount ?? 0,
                        failureCount: summary.failureCount ?? 0
                    },
                    requests: items.map((item) => ({
                        key: item.key,
                        label: item.label,
                        queryText: item.queryText,
                        statusCode: item.statusCode,
                        statusText: item.statusText,
                        rowCount: item.rowCount ?? 0,
                        error: item.error || undefined
                    }))
                }, null, 2),
                rowCount: 0,
                queryPath: "$batch",
                environment: rootModel.environment
            };
        }

        function buildBatchErrorModel(item) {
            return {
                title: item && item.label ? item.label : "Batch Request Error",
                mode: "raw",
                columns: [],
                rows: [],
                rawJson: item && item.rawBody ? item.rawBody : JSON.stringify({
                    error: item && item.error ? item.error : "Batch request failed",
                    statusCode: item && typeof item.statusCode === "number" ? item.statusCode : 0,
                    statusText: item && item.statusText ? item.statusText : "Unknown",
                    queryText: item && item.queryText ? item.queryText : ""
                }, null, 2),
                rowCount: 0,
                queryPath: item && item.queryText ? item.queryText : "$batch",
                environment: rootModel.environment,
                batchError: {
                    queryText: item && item.queryText ? item.queryText : "",
                    statusCode: item && typeof item.statusCode === "number" ? item.statusCode : 0,
                    statusText: item && item.statusText ? item.statusText : "Unknown",
                    message: item && item.error ? item.error : "Batch request failed",
                    rawBody: item && item.rawBody ? item.rawBody : ""
                }
            };
        }

        function resolveActiveModel() {
            if (!isBatchRoot) {
                return rootModel;
            }

            if (activeBatchKey === BATCH_SUMMARY_KEY) {
                return buildBatchSummaryModel();
            }

            const activeItem = getActiveBatchItem();
            if (!activeItem) {
                return buildBatchSummaryModel();
            }

            if (activeItem.model) {
                return activeItem.model;
            }

            return buildBatchErrorModel(activeItem);
        }

        let model = resolveActiveModel();

        const tableState = {
            sortColumn: null,
            sortDirection: "asc",
            filterText: "",
            columnWidths: {}
        };

        const jsonState = {
            searchText: "",
            currentMatchIndex: -1
        };

        const MIN_COLUMN_WIDTH = 80;
        const LARGE_RESULT_THRESHOLD = 500;
        const LARGE_RESULT_INITIAL_ROWS = 200;
        const LARGE_RESULT_CHUNK_ROWS = 200;
        const LARGE_RESULT_RENDER_DELAY_MS = 35;
        let copyStatusTimeout;
        let activeResize = null;
        let activeDrawerResize = null;
        const drawerColumnWidths = {};
        let activeOverflowMenu = null;
        let activeOverflowAnchor = null;
        let tableEventsBound = false;
        const progressiveRenderState = {
            signature: "",
            renderedCount: 0,
            timerId: null
        };
        const arrayDrawerPayloads = new Map();
        const nestedDrawerPayloads = new Map();
        let activeArrayDrawerKey = null;
        let arrayDrawerView = "table";
        let nestedDrawerCounter = 0;

        function isBatchSummarySelected() {
            return isBatchRoot && activeBatchKey === BATCH_SUMMARY_KEY;
        }

        function saveActiveBatchViewState() {
            if (!isBatchRoot) {
                return;
            }

            batchViewStateByKey[activeBatchKey] = getCurrentViewState();
        }

        function restoreActiveBatchViewState() {
            if (!isBatchRoot) {
                return;
            }

            applyViewState(batchViewStateByKey[activeBatchKey] || createDefaultViewState());
        }

        function closeTransientUi() {
            closeAllOverflowMenus();
            removeResultViewerContextMenu();
            closeArrayDrawer();
            clearProgressiveRenderTimer();
        }

        function renderCurrentModel() {
            model = resolveActiveModel();
            renderEnvironmentBadge(model.environment || rootModel.environment);
            renderTraversalStatus(model.traversal);
            renderBinderSuggestion(isBatchRoot ? (rootModel.binderSuggestion || null) : model.binderSuggestion);
            renderSiblingExpandButton(model);
            renderTraversalBatchButton(model);
            renderPagingState(model);

            const hasEntityContext = !isBatchSummarySelected() && !!model.entitySetName;
            if (showRelationshipsBtn instanceof HTMLButtonElement) {
                showRelationshipsBtn.disabled = !hasEntityContext;
            }
            if (showMetadataBtn instanceof HTMLButtonElement) {
                showMetadataBtn.disabled = !hasEntityContext;
            }
            if (exportCsvBtn instanceof HTMLButtonElement) {
                exportCsvBtn.disabled = isBatchSummarySelected();
            }

            rowCount.textContent = isBatchSummarySelected() ? "" : (model.rowCount + " rows returned");

            if (showJsonBtn.classList.contains("active")) {
                renderJson(model);
            } else {
                renderTable(model);
            }
        }

        function switchBatchResponse(nextKey) {
            if (!isBatchRoot || !nextKey || nextKey === activeBatchKey) {
                return;
            }

            saveActiveBatchViewState();
            activeBatchKey = nextKey;
            restoreActiveBatchViewState();
            closeTransientUi();
            renderCurrentModel();
        }

        document.addEventListener("click", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLElement)) {
                return;
            }

            const batchTab = target.closest("[data-batch-response-key]");
            if (!(batchTab instanceof HTMLElement)) {
                return;
            }

            const nextKey = batchTab.getAttribute("data-batch-response-key") || "";
            if (!nextKey) {
                return;
            }

            event.preventDefault();
            event.stopPropagation();
            switchBatchResponse(nextKey);
        });

        showTableBtn.addEventListener("click", () => {
            showTable();
        });

        showJsonBtn.addEventListener("click", () => {
            showJson();
        });

        jsonSearchInput.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) {
                return;
            }

            const nextSearchText = target.value;
            const selectionStart = target.selectionStart ?? nextSearchText.length;
            const selectionEnd = target.selectionEnd ?? nextSearchText.length;

            setUnifiedSearchText(nextSearchText, "json");
            jsonState.currentMatchIndex = -1;
            renderJson(model);

            const nextJsonSearchInput = document.getElementById("jsonSearchInput");
            if (nextJsonSearchInput instanceof HTMLInputElement) {
                nextJsonSearchInput.focus();
                nextJsonSearchInput.setSelectionRange(selectionStart, selectionEnd);
            }
        });

        jsonSearchInput.addEventListener("keydown", (event) => {
            if (!(event instanceof KeyboardEvent)) {
                return;
            }

            if (event.key === "Enter") {
                event.preventDefault();
                moveJsonMatch(event.shiftKey ? -1 : 1);
                return;
            }

            if (event.key === "Escape") {
                if (jsonState.searchText.trim()) {
                    event.preventDefault();
                    jsonState.searchText = "";
                    jsonState.currentMatchIndex = -1;
                    renderJson(model);

                    const nextJsonSearchInput = document.getElementById("jsonSearchInput");
                    if (nextJsonSearchInput instanceof HTMLInputElement) {
                        nextJsonSearchInput.focus();
                    }
                }
            }
        });

        jsonPrevMatchBtn.addEventListener("click", () => {
            moveJsonMatch(-1);
        });

        jsonNextMatchBtn.addEventListener("click", () => {
            moveJsonMatch(1);
        });

        jsonClearSearchBtn.addEventListener("click", () => {
            setUnifiedSearchText("", "json");
            jsonState.currentMatchIndex = -1;
            renderJson(model);

            const nextJsonSearchInput = document.getElementById("jsonSearchInput");
            if (nextJsonSearchInput instanceof HTMLInputElement) {
                nextJsonSearchInput.focus();
            }
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


        function sanitizeFileName(value) {
            return String(value || "dv-quick-run-results")
                .replace(/[<>:"/\\\\|?*\\x00-\\x1F]+/g, "_")
                .replace(/\\s+/g, " ")
                .replace(/[. ]+$/g, "")
                .trim() || "dv-quick-run-results";
        }

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

        function buildJsonExportFileName(model) {
            const rawBaseName = model.entitySetName || model.entityLogicalName || (model.queryPath || "dv-quick-run-results").split("?")[0] || "results";
            const baseName = sanitizeFileName(rawBaseName).replace(/^_+/, "") || "results";
            const pageNumber = Number(model?.paging?.pageNumber || 1);
            const queryHint = buildJsonExportQueryHint(model);
            const fileName = "dvqr_" + baseName + queryHint + "-page-" + pageNumber + ".json";
            return sanitizeFileName(fileName);
        }

        function buildJsonExportQueryHint(model) {
            try {
                const queryPath = typeof model?.queryPath === "string" ? model.queryPath : "";
                const queryText = queryPath.includes("?") ? queryPath.slice(queryPath.indexOf("?") + 1) : "";
                if (!queryText) {
                    return "";
                }

                const params = new URLSearchParams(queryText);
                const rawFilter = params.get("$filter");
                if (rawFilter) {
                    const filterSlug = summarizeQueryHint(rawFilter, 42);
                    return filterSlug ? "-filter-" + filterSlug : "-filter";
                }

                const rawOrderBy = params.get("$orderby");
                if (rawOrderBy) {
                    const orderSlug = summarizeQueryHint(rawOrderBy, 32);
                    return orderSlug ? "-orderby-" + orderSlug : "-orderby";
                }

                const rawTop = params.get("$top");
                if (rawTop) {
                    const topSlug = summarizeQueryHint(rawTop, 12);
                    return topSlug ? "-top-" + topSlug : "-top";
                }
            } catch {
                return "";
            }

            return "";
        }

        function summarizeQueryHint(value, maxLength) {
            const decoded = decodeURIComponent(String(value || ""));
            const simplified = decoded
                .replace(/\b(eq|ne|gt|ge|lt|le|and|or|not|contains|startswith|endswith)\b/gi, (match) => match.toLowerCase())
                .replace(/['"()[\],]+/g, " ")
                .replace(/[^a-zA-Z0-9]+/g, "-")
                .replace(/-+/g, "-")
                .replace(/^-|-$/g, "")
                .toLowerCase();

            if (!simplified) {
                return "";
            }

            return simplified.slice(0, maxLength).replace(/-+$/g, "");
        }

        function postSaveJson() {
            const rawJson = typeof model.rawJson === "string" ? model.rawJson : "";
            vscodeApi.postMessage({
                type: "saveJson",
                payload: {
                    fileName: buildJsonExportFileName(model),
                    json: rawJson
                }
            });
        }

        saveJsonBtn.addEventListener("click", () => {
            postSaveJson();
        });


        previousPageBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "previousPage"
            });
        });

        nextPageBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "nextPage"
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

        runTraversalBatchBtn.addEventListener("click", () => {
            vscodeApi.postMessage({
                type: "runTraversalBatch",
                payload: {
                    traversalSessionId: model.traversal?.traversalSessionId || ""
                }
            });
        });

        binderSuggestionBtn.addEventListener("click", () => {
            const actionId = binderSuggestionBtn.getAttribute("data-binder-action-id") || "";
            if (!actionId) {
                return;
            }

            let payload = {};
            try {
                payload = JSON.parse(binderSuggestionBtn.getAttribute("data-binder-payload") || "{}");
            } catch {
                payload = {};
            }

            binderSuggestionBtn.hidden = true;
            binderSuggestionBtn.textContent = "";
            binderSuggestionBtn.removeAttribute("data-binder-action-id");
            binderSuggestionBtn.removeAttribute("data-binder-payload");

            vscodeApi.postMessage({
                type: "executeBinderSuggestion",
                payload: {
                    actionId,
                    payload
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

        function closeAllBatchKebabMenus() {
            document
                .querySelectorAll("[data-batch-kebab-menu]")
                .forEach((menu) => {
                    if (menu instanceof HTMLElement) {
                        menu.setAttribute("hidden", "true");
                    }
                });
        }

        function wireBatchKebabEvents() {
            document.addEventListener("click", (event) => {
                const target = event.target instanceof HTMLElement ? event.target : null;
                if (!target) {
                    closeAllBatchKebabMenus();
                    return;
                }

                const toggle = target.closest("[data-batch-kebab-toggle]");
                if (toggle instanceof HTMLElement) {
                    event.preventDefault();

                    const container = toggle.closest(".batch-kebab-container");
                    const menu = container?.querySelector("[data-batch-kebab-menu]");

                    if (menu instanceof HTMLElement) {
                        const wasHidden = menu.hasAttribute("hidden");
                        closeAllBatchKebabMenus();

                        if (wasHidden) {
                            menu.removeAttribute("hidden");
                        }
                    }

                    return;
                }

                const action = target.closest("[data-batch-kebab-action]");
                if (action instanceof HTMLElement) {
                    event.preventDefault();

                    const actionName = action.getAttribute("data-batch-kebab-action") || "";
                    const traversalSessionId = action.getAttribute("data-traversal-session-id") || "";

                    vscodeApi.postMessage({
                        type: "runTraversalOptimizedBatch",
                        payload: {
                            action: actionName,
                            traversalSessionId
                        }
                    });

                    closeAllBatchKebabMenus();
                    return;
                }

                const insideMenu = target.closest(".batch-kebab-container");
                if (insideMenu) {
                    return;
                }

                closeAllBatchKebabMenus();
            });
        }

        document.addEventListener("click", (event) => {
            const target = event.target instanceof HTMLElement ? event.target : null;
            const insideContextActions = !!target?.closest(".context-action-cell, .row-action-cell, .overflow-menu, .overflow-menu-overlay");
            const insideBatchKebab = !!target?.closest(".batch-kebab-container");

            if (!insideContextActions) {
                closeAllOverflowMenus();
            }

            if (!insideBatchKebab) {
                closeAllBatchKebabMenus();
            }
        });

        bindTableEventsOnce();
        wireBatchKebabEvents();
        renderCurrentModel();


        function clearProgressiveRenderTimer() {
            if (typeof progressiveRenderState.timerId === "number") {
                clearTimeout(progressiveRenderState.timerId);
                progressiveRenderState.timerId = null;
            }
        }

        function buildProgressiveRenderSignature(currentModel, visibleRowCount) {
            return [
                currentModel?.queryPath || currentModel?.entitySetName || currentModel?.entityLogicalName || "results",
                currentModel?.paging?.pageNumber || 1,
                tableState.sortColumn || "",
                tableState.sortDirection || "asc",
                String(tableState.filterText || "").trim(),
                visibleRowCount
            ].join("::");
        }

        function shouldUseLargeResultMode(visibleRowCount, hasFilter) {
            return !hasFilter && visibleRowCount > LARGE_RESULT_THRESHOLD;
        }

        function syncProgressiveRenderState(currentModel, visibleRowCount, hasFilter) {
            const signature = buildProgressiveRenderSignature(currentModel, visibleRowCount);
            const useLargeResultMode = shouldUseLargeResultMode(visibleRowCount, hasFilter);

            if (!useLargeResultMode) {
                if (progressiveRenderState.signature !== "" || progressiveRenderState.renderedCount !== 0) {
                    progressiveRenderState.signature = signature;
                    progressiveRenderState.renderedCount = visibleRowCount;
                    clearProgressiveRenderTimer();
                }

                return {
                    signature,
                    useLargeResultMode: false,
                    renderedCount: visibleRowCount
                };
            }

            if (progressiveRenderState.signature !== signature) {
                clearProgressiveRenderTimer();
                progressiveRenderState.signature = signature;
                progressiveRenderState.renderedCount = Math.min(visibleRowCount, LARGE_RESULT_INITIAL_ROWS);
            } else if (progressiveRenderState.renderedCount <= 0) {
                progressiveRenderState.renderedCount = Math.min(visibleRowCount, LARGE_RESULT_INITIAL_ROWS);
            } else if (progressiveRenderState.renderedCount > visibleRowCount) {
                progressiveRenderState.renderedCount = visibleRowCount;
            }

            return {
                signature,
                useLargeResultMode: true,
                renderedCount: progressiveRenderState.renderedCount
            };
        }

        function scheduleProgressiveRender(currentModel, signature, visibleRowCount, renderedCount) {
            if (renderedCount >= visibleRowCount) {
                clearProgressiveRenderTimer();
                return;
            }

            if (typeof progressiveRenderState.timerId === "number") {
                return;
            }

            progressiveRenderState.timerId = window.setTimeout(() => {
                progressiveRenderState.timerId = null;

                if (progressiveRenderState.signature !== signature) {
                    return;
                }

                progressiveRenderState.renderedCount = Math.min(
                    visibleRowCount,
                    progressiveRenderState.renderedCount + LARGE_RESULT_CHUNK_ROWS
                );

                renderTable(currentModel);
            }, LARGE_RESULT_RENDER_DELAY_MS);
        }

        function renderPagingState(model) {
            if (isBatchRoot) {
                if (pageIndicator instanceof HTMLElement) {
                    pageIndicator.hidden = true;
                    pageIndicator.textContent = "";
                }
                if (previousPageBtn instanceof HTMLButtonElement) {
                    previousPageBtn.hidden = true;
                    previousPageBtn.disabled = true;
                }
                if (nextPageBtn instanceof HTMLButtonElement) {
                    nextPageBtn.hidden = true;
                    nextPageBtn.disabled = true;
                }
                return;
            }

            const pageNumber = Number(model?.paging?.pageNumber ?? 1);
            const hasNextPage = !!model?.paging?.hasNextPage;
            const hasPreviousPage = Array.isArray(model?.paging?.history) && model.paging.history.length > 0;

            if (pageIndicator instanceof HTMLElement) {
                pageIndicator.hidden = false;
                pageIndicator.textContent = "Page " + pageNumber;
            }

            if (previousPageBtn instanceof HTMLButtonElement) {
                previousPageBtn.hidden = !hasPreviousPage;
                previousPageBtn.disabled = !hasPreviousPage;
            }

            if (nextPageBtn instanceof HTMLButtonElement) {
                nextPageBtn.hidden = !hasNextPage;
                nextPageBtn.disabled = !hasNextPage;
            }
        }

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }
`;
