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
        renderTraversalStatus(model.traversal);
        renderSiblingExpandButton(model);
        renderTable(model);
        renderJson(model);
        rowCount.textContent = model.rowCount + " rows returned";

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }
`;
