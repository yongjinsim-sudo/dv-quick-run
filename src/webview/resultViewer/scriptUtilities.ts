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
                .replace(/\"/g, "&quot;")
                .replace(/'/g, "&#039;");
        }

        function escapeAttribute(value) {
            return String(value)
                .replace(/&/g, "&amp;")
                .replace(/\"/g, "&quot;");
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
                ? "<span class='traversal-status-subtitle'>Choose a row to continue using " + escapeHtml(traversal.requiredCarryField) + "</span>"
                : "";

            traversalStatus.innerHTML =
                "<span class='traversal-status-pill'>" +
                "<span class='traversal-status-title'>" + escapeHtml(traversal.title) + "</span>" +
                subtitle +
                carryHint +
                "</span>";
        }
`;