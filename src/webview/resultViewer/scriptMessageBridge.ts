export const RESULT_VIEWER_SCRIPT_MESSAGE_BRIDGE = `
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


        function getCopyableCellValue(cell) {
            if (!cell || typeof cell !== "object") {
                return cell;
            }

            if (Object.prototype.hasOwnProperty.call(cell, "rawValue")) {
                return cell.rawValue;
            }

            if (cell.drawerPayload && Object.prototype.hasOwnProperty.call(cell.drawerPayload, "payload")) {
                return cell.drawerPayload.payload;
            }

            if (Object.prototype.hasOwnProperty.call(cell, "copyValue")) {
                return cell.copyValue;
            }

            return cell.value ?? null;
        }

        function buildRowJsonForAction(element) {
            const rowElement = element.closest("tr[data-source-row-index]");
            const rowIndexText = rowElement ? rowElement.getAttribute("data-source-row-index") : "";
            const rowIndex = Number(rowIndexText);

            if (!Number.isInteger(rowIndex) || rowIndex < 0 || !model || !Array.isArray(model.rows)) {
                return "";
            }

            const row = model.rows[rowIndex];
            if (!row || typeof row !== "object") {
                return "";
            }

            const copyable = {};
            const columns = Array.isArray(model.columns) ? model.columns : Object.keys(row);
            columns.forEach((column) => {
                copyable[column] = getCopyableCellValue(row[column]);
            });

            return JSON.stringify(copyable, null, 2);
        }

        function executeAction(element) {

            if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") {
                return;
            }

            const actionId = element.getAttribute("data-action-id") ?? "";
            const guid = element.getAttribute("data-guid") ?? "";
            const entitySetName = element.getAttribute("data-entity-set-name") ?? "";
            const entityLogicalName = element.getAttribute("data-entity-logical-name") ?? "";
            const columnName = element.getAttribute("data-column-name") ?? "";
            const rawValue = element.getAttribute("data-raw-value") ?? "";
            const displayValue = element.getAttribute("data-display-value") ?? "";
            const isNullValue = element.getAttribute("data-is-null-value") === "true";
            const rowJson = actionId === "copy-row-json" ? buildRowJsonForAction(element) : "";
            const sliceOperation = element.getAttribute("data-slice-operation") ?? "";
            const traversalSessionId = element.getAttribute("data-traversal-session-id") ?? "";
            const traversalLegIndex = element.getAttribute("data-traversal-leg-index") ?? "";
            const carryField = element.getAttribute("data-carry-field") ?? "";
            const carryValue = element.getAttribute("data-carry-value") ?? "";
            const sourceDocumentUri = element.getAttribute("data-source-document-uri") ?? "";
            const sourceRangeStartLine = element.getAttribute("data-source-range-start-line") ?? "";
            const sourceRangeStartCharacter = element.getAttribute("data-source-range-start-character") ?? "";
            const sourceRangeEndLine = element.getAttribute("data-source-range-end-line") ?? "";
            const sourceRangeEndCharacter = element.getAttribute("data-source-range-end-character") ?? "";

            if (!actionId) {
                return;
            }

            const payload = {
                actionId,
                guid,
                entitySetName,
                entityLogicalName,
                columnName,
                rawValue,
                displayValue,
                rowJson,
                isNullValue,
                sliceOperation,
                traversalSessionId,
                traversalLegIndex,
                carryField,
                carryValue,
                sourceDocumentUri,
                sourceRangeStartLine,
                sourceRangeStartCharacter,
                sourceRangeEndLine,
                sourceRangeEndCharacter,
                primaryIdField: element.getAttribute("data-primary-id-field") ?? "",
                fieldLogicalName: element.getAttribute("data-field-logical-name") ?? "",
                fieldAttributeType: element.getAttribute("data-field-attribute-type") ?? ""
            };

            console.log("[DVQR][webview] executeResultViewerAction payload", payload);

            vscodeApi.postMessage({
                type: "executeResultViewerAction",
                payload
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
`;
