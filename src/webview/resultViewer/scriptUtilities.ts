export const RESULT_VIEWER_SCRIPT_UTILITIES = `
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
                .replace(/\\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/\\"/g, "&quot;");
        }


        function buildBatchResponseTabsHtml() {
            if (!isBatchRoot) {
                return "";
            }

            const summaryActiveClass = isBatchSummarySelected() ? " active" : "";
            const summaryButton = "<button class=\\"batch-response-tab" + summaryActiveClass + "\\" type=\\"button\\" data-batch-response-key=\\"" + BATCH_SUMMARY_KEY + "\\">$batch Summary</button>";

            const itemButtons = getBatchItems().map((item) => {
                const activeClass = item.key === activeBatchKey ? " active" : "";
                const statusClass = item.statusCode >= 400 || item.statusCode === 0 ? " error" : " success";
                const title = item.queryText + " • " + item.statusCode + " " + item.statusText;
                return "<button class=\\"batch-response-tab" + activeClass + statusClass + "\\" type=\\"button\\" data-batch-response-key=\\"" + escapeAttribute(item.key) + "\\" title=\\"" + escapeAttribute(title) + "\\">" + escapeHtml(item.label) + "</button>";
            }).join("");

            const batchTraversal = rootModel.batchTraversal;
            const canShowKebab = !!(batchTraversal && batchTraversal.canRunOptimizedBatch && batchTraversal.traversalSessionId);
            const kebabHtml = canShowKebab
            ? "<div class=\\"batch-kebab-container\\">" +
                "<button class=\\"batch-kebab-btn\\" type=\\"button\\" title=\\"Advanced options\\" data-batch-kebab-toggle=\\"true\\">⋮</button>" +
                "<div class=\\"batch-kebab-menu\\" data-batch-kebab-menu=\\"true\\" hidden>" +
                    "<button class=\\"batch-kebab-item\\" type=\\"button\\" data-batch-kebab-action=\\"tighten\\" data-traversal-session-id=\\"" + escapeAttribute(batchTraversal.traversalSessionId || "") + "\\">Tighten with chosen contactid</button>" +
                "</div>" +
                "</div>"
            : "";

            return "<div class=\\"batch-response-tabs\\">" + summaryButton + itemButtons + kebabHtml + "</div>";
        }

        function buildBatchSummaryHtml() {
            if (!isBatchRoot) {
                return "";
            }

            const summary = rootModel.summary || {};
            const itemsHtml = getBatchItems().map((item, index) => {
                const status = (item.statusCode || 0) + " " + (item.statusText || "");
                const rowCount = typeof item.rowCount === "number"
                    ? item.rowCount + (item.rowCount === 1 ? " row" : " rows")
                    : (item.error ? item.error : "No payload");
                return "<div class=\\"batch-summary-item\\">" +
                    "<div class=\\"batch-summary-item-title\\">Request " + escapeHtml(String(index + 1)) + ": " + escapeHtml(item.queryText) + "</div>" +
                    "<div class=\\"batch-summary-item-meta\\">Status: " + escapeHtml(status.trim()) + "</div>" +
                    "<div class=\\"batch-summary-item-meta\\">Result: " + escapeHtml(rowCount) + "</div>" +
                    "</div>";
            }).join("");

            return "<div class=\\"batch-summary-card\\">" +
                "<div class=\\"batch-summary-title\\">$batch Summary</div>" +
                "<div class=\\"batch-summary-meta\\">Requests: " + escapeHtml(String(summary.totalRequests ?? getBatchItems().length)) + "</div>" +
                "<div class=\\"batch-summary-meta\\">Succeeded: " + escapeHtml(String(summary.successCount ?? 0)) + "</div>" +
                "<div class=\\"batch-summary-meta\\">Failed: " + escapeHtml(String(summary.failureCount ?? 0)) + "</div>" +
                "<div class=\\"batch-summary-list\\">" + itemsHtml + "</div>" +
                "</div>";
        }

        function renderBatchResponseBar() {
            if (!(batchResponseBar instanceof HTMLElement)) {
                return;
            }

            if (!isBatchRoot) {
                batchResponseBar.hidden = true;
                batchResponseBar.innerHTML = "";
                return;
            }

            batchResponseBar.hidden = false;
            batchResponseBar.innerHTML = buildBatchResponseTabsHtml();
        }



        function setUnifiedSearchText(nextSearchText, source) {
            const normalized = String(nextSearchText ?? "");
            const changed = tableState.filterText !== normalized || jsonState.searchText !== normalized;

            tableState.filterText = normalized;
            jsonState.searchText = normalized;

            if (changed && source !== "json") {
                jsonState.currentMatchIndex = -1;
            }
        }

        function assertExclusiveViewMode() {
            if (!(tableView instanceof HTMLElement) || !(jsonPanel instanceof HTMLElement)) {
                return;
            }

            const tableVisible = tableView.style.display !== "none";
            const jsonVisible = !jsonPanel.hidden;

            if (tableVisible === jsonVisible) {
                console.warn("[DV Quick Run][Result Viewer] Mode invariant violated", {
                    tableVisible,
                    jsonVisible
                });
            }
        }

        function updateJsonMatchStatus(activeIndex, totalMatches) {
            if (!(jsonMatchStatus instanceof HTMLElement)) {
                return;
            }

            if (totalMatches <= 0) {
                jsonMatchStatus.textContent = jsonState.searchText.trim() ? "No matches" : "";
                return;
            }

            jsonMatchStatus.textContent = activeIndex + " / " + totalMatches;
        }

        function updateJsonNavigationButtons(totalMatches) {
            const disabled = totalMatches <= 0;

            if (jsonPrevMatchBtn instanceof HTMLButtonElement) {
                jsonPrevMatchBtn.disabled = disabled;
            }

            if (jsonNextMatchBtn instanceof HTMLButtonElement) {
                jsonNextMatchBtn.disabled = disabled;
            }

            if (jsonClearSearchBtn instanceof HTMLButtonElement) {
                jsonClearSearchBtn.disabled = !jsonState.searchText.trim();
            }
        }

        function escapeRegExp(value) {
            return String(value).replace(/[.*+?^{}()|[\]\$]/g, "\$&");
        }

        function buildHighlightedJsonHtml(rawJson, searchText) {
            const safeJson = escapeHtml(rawJson);
            const escapedSearchText = escapeHtml(searchText);

            if (!escapedSearchText) {
                return safeJson;
            }

            const pattern = new RegExp(escapeRegExp(escapedSearchText), "gi");
            return safeJson.replace(pattern, (match) => '<span class="json-match">' + match + '</span>');
        }

        function activateJsonMatch(matches, matchIndex) {
            matches.forEach((match, index) => {
                match.classList.toggle("json-match-active", index === matchIndex);
            });

            const activeMatch = matches[matchIndex];
            if (activeMatch instanceof HTMLElement) {
                activeMatch.scrollIntoView({
                    block: "center",
                    inline: "nearest"
                });
            }
        }

        function moveJsonMatch(direction) {
            const matches = Array.from(jsonView.querySelectorAll(".json-match"));
            if (matches.length === 0) {
                jsonState.currentMatchIndex = -1;
                updateJsonMatchStatus(0, 0);
                updateJsonNavigationButtons(0);
                return;
            }

            if (jsonState.currentMatchIndex < 0 || jsonState.currentMatchIndex >= matches.length) {
                jsonState.currentMatchIndex = direction > 0 ? 0 : matches.length - 1;
            } else {
                jsonState.currentMatchIndex = (jsonState.currentMatchIndex + direction + matches.length) % matches.length;
            }

            activateJsonMatch(matches, jsonState.currentMatchIndex);
            updateJsonMatchStatus(jsonState.currentMatchIndex + 1, matches.length);
            updateJsonNavigationButtons(matches.length);
        }

        function renderTraversalStatus(traversal) {
            if (!traversalStatus) {
                return;
            }

            if (!traversal || !traversal.title) {
                traversalStatus.innerHTML = "";
                return;
            }

            const subtitle = traversal.subtitle
                ? "<span class='traversal-status-subtitle'>" + escapeHtml(traversal.subtitle) + "</span>"
                : "";

            const carryHint = traversal.requiredCarryField
                ? "<span class='traversal-status-subtitle'> • Choose a row to continue using " + escapeHtml(traversal.requiredCarryField) + "</span>"
                : "";

            traversalStatus.innerHTML =
                "<span class='traversal-status-pill'>" +
                "<span class='traversal-status-title'>" + escapeHtml(traversal.title) + "</span>" +
                subtitle +
                carryHint +
                "</span>";
        }
`;
