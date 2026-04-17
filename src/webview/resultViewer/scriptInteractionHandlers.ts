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

                const clearFilterButton = target.closest("#tableFilterClearBtn");
                if (clearFilterButton instanceof HTMLElement) {
                    event.preventDefault();
                    event.stopPropagation();
                    setUnifiedSearchText("", "table");
                    renderTable(model);

                    const nextFilterInput = document.getElementById("tableFilterInput");
                    if (nextFilterInput instanceof HTMLInputElement) {
                        nextFilterInput.focus();
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


function showHeaderContextMenu(clientX, clientY, columnName) {
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
    button.textContent = "Preview root $orderby asc";
    button.setAttribute("data-action-id", "preview-root-odata-orderby");
    button.setAttribute("data-column-name", columnName);

    button.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        executeAction(button);
        removeResultViewerContextMenu();
    });

    menu.appendChild(button);

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
            const row = target.closest("tr[data-row-index]");
            if (!(row instanceof HTMLElement)) {
                return null;
            }

            const investigateAction = row.querySelector('[data-action-id="investigate-record"]');
            return investigateAction instanceof HTMLElement ? investigateAction : null;
        }

`;
