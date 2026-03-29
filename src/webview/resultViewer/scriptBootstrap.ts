export const RESULT_VIEWER_SCRIPT_BOOTSTRAP = String.raw`
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
        const traversalStatus = document.getElementById("traversalStatus");

        const model = JSON.parse(\`__INITIAL_MODEL_JSON__\`);

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
        renderTraversalStatus(model.traversal);
        renderTable(model);
        jsonView.textContent = model.rawJson;
        rowCount.textContent = model.rowCount + " rows returned";

        if (model.mode === "collection") {
            showTable();
        } else {
            showJson();
        }
`;
