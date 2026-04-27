export const RESULT_VIEWER_SCRIPT_INTERACTION_HANDLERS = `
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

                setUnifiedSearchText(nextFilterText, "table");
                requestSessionSearch(nextFilterText);
                renderTable(model);

                const nextFilterInput = document.getElementById("tableFilterInput");
                if (nextFilterInput instanceof HTMLInputElement) {
                    nextFilterInput.focus();
                    nextFilterInput.setSelectionRange(selectionStart, selectionEnd);
                }
            });

            tableView.addEventListener("keydown", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLInputElement) || target.id !== "tableFilterInput") {
                    return;
                }

                if (event.key !== "Escape") {
                    return;
                }

                if (!target.value) {
                    return;
                }

                event.preventDefault();
                setUnifiedSearchText("", "table");
                requestSessionSearch("");
                renderTable(model);

                const nextFilterInput = document.getElementById("tableFilterInput");
                if (nextFilterInput instanceof HTMLInputElement) {
                    nextFilterInput.focus();
                }
            });

            tableView.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const rowWindowSizeButton = target.closest("[data-row-window-size]");
                if (rowWindowSizeButton instanceof HTMLElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    const size = Number(rowWindowSizeButton.getAttribute("data-row-window-size") || "100");
                    const session = getActiveSession();
                    if (session) {
                        const totalRows = Number(session.totalRows || model.rowCount || 0);
                        requestSessionRows(0, getEffectiveRowWindowLimit(size, totalRows));
                        renderTable(model);
                    }
                    return;
                }

                const rowWindowNavButton = target.closest("[data-row-window-nav]");
                if (rowWindowNavButton instanceof HTMLElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    const session = getActiveSession();
                    if (session) {
                        const direction = rowWindowNavButton.getAttribute("data-row-window-nav") === "prev" ? -1 : 1;
                        const totalRows = Number(session.totalRows || model.rowCount || 0);
                        const limit = getEffectiveRowWindowLimit(Number(session.chunkSize || 100), totalRows);
                        const nextOffset = clampRowWindowOffset(Number(session.rowOffset || 0) + direction * limit, limit, totalRows);
                        requestSessionRows(nextOffset, limit);
                        renderTable(model);
                    }
                    return;
                }

                const clearFilterButton = target.closest("#tableFilterClearBtn");
                if (clearFilterButton instanceof HTMLElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    setUnifiedSearchText("", "table");
                    requestSessionSearch("");
                    renderTable(model);

                    const nextFilterInput = document.getElementById("tableFilterInput");
                    if (nextFilterInput instanceof HTMLInputElement) {
                        nextFilterInput.focus();
                    }

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

                const actionElement = target.closest("[data-action-id]");
                if (actionElement instanceof HTMLElement) {
                    event.stopPropagation();
                    executeAction(actionElement);
                    closeAllOverflowMenus();
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


            tableView.addEventListener("mousedown", (event) => {
                const target = event.target;
                if (!(target instanceof HTMLElement)) {
                    return;
                }

                const resizeHandle = target.closest("[data-resize-column]");
                if (!(resizeHandle instanceof HTMLElement)) {
                    return;
                }

                const column = resizeHandle.getAttribute("data-resize-column") ?? "";
                if (!column) {
                    return;
                }

                beginResize(event, resizeHandle, column);
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

    const investigateAction = findRowInvestigateAction(target);
    if (investigateAction instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();
        showInvestigateContextMenu(event.clientX, event.clientY, investigateAction);
        return;
    }

    const header = target.closest("th[data-column]");
    if (header instanceof HTMLElement) {
        event.preventDefault();
        event.stopPropagation();

        const columnName = header.getAttribute("data-column") ?? "";
        const isRootColumn = !!columnName && !columnName.includes(".");

        removeResultViewerContextMenu();
        closeAllOverflowMenus();

        if (isRootColumn) {
            showHeaderContextMenu(event.clientX, event.clientY, columnName);
        }

        return;
    }

    const cell = target.closest(".context-action-cell");
    if (!(cell instanceof HTMLElement)) {
        return;
    }

    const menu = cell.querySelector(".overflow-menu");
    if (!(menu instanceof HTMLElement)) {
        event.preventDefault();
        event.stopPropagation();
        removeResultViewerContextMenu();
        closeAllOverflowMenus();
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


        let activeResultViewerContextMenu = null;

        function removeResultViewerContextMenu() {
            if (activeResultViewerContextMenu instanceof HTMLElement) {
                activeResultViewerContextMenu.remove();
            }

            activeResultViewerContextMenu = null;
        }


function getHeaderContextActions(columnName) {
    if (!model || !Array.isArray(model.rows)) {
        return [];
    }

    const allowedSliceOperations = new Set(["isNull", "isNotNull"]);

    for (const row of model.rows) {
        const cell = row && row[columnName];
        const actions = Array.isArray(cell?.actions) ? cell.actions : [];
        if (actions.length === 0) {
            continue;
        }

        const headerActions = actions.filter((action) => {
            if (action.id === "preview-root-odata-orderby") {
                return true;
            }

            return action.id === "preview-odata-slice" && allowedSliceOperations.has(String(action.payload?.sliceOperation ?? ""));
        });

        headerActions.push({
            id: "copy-column-name",
            title: "Copy column name",
            icon: "📋",
            placement: "overflow",
            group: "copy",
            kind: "copy",
            payload: { columnName }
        });

        return headerActions;
    }

    return [];
}

function showHeaderContextMenu(clientX, clientY, columnName) {
    removeResultViewerContextMenu();
    closeAllOverflowMenus();

    const actions = getHeaderContextActions(columnName);
    if (!Array.isArray(actions) || actions.length === 0) {
        return;
    }

    const menu = document.createElement("div");
    menu.className = "overflow-menu-overlay";
    menu.style.left = clientX + "px";
    menu.style.top = clientY + "px";
    menu.setAttribute("role", "menu");

    actions.forEach((action) => {
        const button = document.createElement("button");
        const isEnabled = action.isEnabled !== false;
        button.type = "button";
        button.className = "overflow-action-button" + (isEnabled ? "" : " is-disabled");
        button.textContent = action.title;
        button.setAttribute("data-action-id", action.id);
        button.setAttribute("data-column-name", action.payload?.columnName ?? columnName);
        button.setAttribute("data-guid", action.payload?.guid ?? "");
        button.setAttribute("data-entity-set-name", action.payload?.entitySetName ?? "");
        button.setAttribute("data-entity-logical-name", action.payload?.entityLogicalName ?? "");
        button.setAttribute("data-primary-id-field", action.payload?.primaryIdField ?? "");
        button.setAttribute("data-field-logical-name", action.payload?.fieldLogicalName ?? action.payload?.columnName ?? columnName);
        button.setAttribute("data-field-attribute-type", action.payload?.fieldAttributeType ?? "");
        button.setAttribute("data-raw-value", action.payload?.rawValue ?? "");
        button.setAttribute("data-display-value", action.payload?.displayValue ?? "");
        button.setAttribute("data-is-null-value", action.payload?.isNullValue === true ? "true" : "false");
        button.setAttribute("data-slice-operation", action.payload?.sliceOperation ?? "");
        if (!isEnabled) {
            button.disabled = true;
            button.setAttribute("aria-disabled", "true");
            button.title = action.disabledReason ? action.title + " — " + action.disabledReason : action.title + " — Unavailable in this context";
        } else {
            button.title = action.title;
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            executeAction(button);
            removeResultViewerContextMenu();
        });

        menu.appendChild(button);
    });

    document.body.appendChild(menu);
    activeResultViewerContextMenu = menu;

    const viewportPadding = 8;
    const rect = menu.getBoundingClientRect();
    let left = clientX;
    let top = clientY;

    if (left + rect.width > window.innerWidth - viewportPadding) {
        left = Math.max(viewportPadding, window.innerWidth - rect.width - viewportPadding);
    }

    if (top + rect.height > window.innerHeight - viewportPadding) {
        top = Math.max(viewportPadding, window.innerHeight - rect.height - viewportPadding);
    }

    menu.style.left = Math.round(left) + "px";
    menu.style.top = Math.round(top) + "px";
}

        function showInvestigateContextMenu(clientX, clientY, actionElement) {
            removeResultViewerContextMenu();
            closeAllOverflowMenus();

            const menu = document.createElement("div");
            menu.className = "overflow-menu-overlay";
            menu.style.left = clientX + "px";
            menu.style.top = clientY + "px";
            menu.setAttribute("role", "menu");

            const button = document.createElement("button");
            button.type = "button";
            button.className = "overflow-action-button";
            button.textContent = "🔎 Investigate Record";
            button.addEventListener("click", () => {
                executeAction(actionElement);
                removeResultViewerContextMenu();
            });

            menu.appendChild(button);
            document.body.appendChild(menu);
            activeResultViewerContextMenu = menu;

            window.setTimeout(() => {
                document.addEventListener("click", removeResultViewerContextMenu, { once: true });
            }, 0);
        }

        function findRowInvestigateAction(target) {
            const cell = target.closest("td.context-action-cell");
            if (!(cell instanceof HTMLElement)) {
                return null;
            }

            const withinCellActions = target.closest(".cell-actions, .primary-actions, .overflow-actions, .overflow-trigger, .overflow-menu");
            if (withinCellActions instanceof HTMLElement) {
                return null;
            }

            const investigateAction = cell.querySelector('.primary-actions [data-action-id="investigate-record"], [data-action-id="investigate-record"]');
            return investigateAction instanceof HTMLElement ? investigateAction : null;
        }

`;
