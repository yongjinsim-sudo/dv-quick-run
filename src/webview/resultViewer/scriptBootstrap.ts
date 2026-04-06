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
        const jsonSaveBtn = document.getElementById("jsonSaveBtn");
        const jsonMatchStatus = document.getElementById("jsonMatchStatus");
        const showTableBtn = document.getElementById("showTableBtn");
        const showJsonBtn = document.getElementById("showJsonBtn");
        const showRelationshipsBtn = document.getElementById("showRelationshipsBtn");
        const showMetadataBtn = document.getElementById("showMetadataBtn");
        const exportCsvBtn = document.getElementById("exportCsvBtn");
        const saveJsonBtn = document.getElementById("saveJsonBtn");
        const previousPageBtn = document.getElementById("previousPageBtn");
        const nextPageBtn = document.getElementById("nextPageBtn");
        const siblingExpandBtn = document.getElementById("siblingExpandBtn");
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

        const model = JSON.parse(__INITIAL_MODEL_JSON__);

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

        jsonSaveBtn.addEventListener("click", () => {
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
        renderTraversalStatus(model.traversal);
        renderSiblingExpandButton(model);
        renderPagingState(model);
        renderTable(model);
        renderJson(model);
        rowCount.textContent = model.rowCount + " rows returned";


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
