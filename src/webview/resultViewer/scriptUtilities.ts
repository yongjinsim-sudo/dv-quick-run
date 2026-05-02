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
                    "<button class=\\"batch-kebab-item\\" type=\\"button\\" data-batch-kebab-action=\\"tighten\\" data-traversal-session-id=\\"" + escapeAttribute(batchTraversal.traversalSessionId || "") + "\\">Tighten selected-path replay</button>" +
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



        function buildInsightKey(suggestion) {
            if (!suggestion) {
                return "";
            }

            return [
                suggestion.actionId || "",
                suggestion.source || "",
                suggestion.text || ""
            ].join("::");
        }

        function isInsightSnoozed(suggestion) {
            const key = buildInsightKey(suggestion);
            if (!key) {
                return false;
            }

            const snoozedUntil = Number(snoozedInsightUntilByKey.get(key) || 0);
            if (snoozedUntil <= Date.now()) {
                if (snoozedUntil > 0) {
                    snoozedInsightUntilByKey.delete(key);
                }
                return false;
            }

            return true;
        }

        function snoozeInsight(suggestion) {
            const key = buildInsightKey(suggestion);
            if (!key) {
                return;
            }

            snoozedInsightUntilByKey.set(key, Date.now() + INSIGHT_SNOOZE_MS);
        }

        function collectActiveInsightSuggestions() {
            const source = isBatchRoot ? rootModel : model;
            const rawSuggestions = [];

            if (Array.isArray(source?.insightSuggestions)) {
                rawSuggestions.push(...source.insightSuggestions);
            }

            if (source?.binderSuggestion) {
                rawSuggestions.push(source.binderSuggestion);
            }

            const seen = new Set();
            return rawSuggestions.filter((suggestion) => {
                if (!suggestion || !suggestion.text) {
                    return false;
                }

                const key = buildInsightKey(suggestion);
                if (!key || seen.has(key) || isInsightSnoozed(suggestion)) {
                    return false;
                }

                seen.add(key);
                return true;
            });
        }

        function clampActiveInsightIndex(suggestions) {
            if (!Array.isArray(suggestions) || suggestions.length === 0) {
                activeInsightIndex = 0;
                return 0;
            }

            if (activeInsightIndex < 0) {
                activeInsightIndex = suggestions.length - 1;
            }

            if (activeInsightIndex >= suggestions.length) {
                activeInsightIndex = 0;
            }

            return activeInsightIndex;
        }

        function resolveActiveInsightSuggestion() {
            const suggestions = collectActiveInsightSuggestions();
            if (suggestions.length === 0) {
                return null;
            }

            return suggestions[clampActiveInsightIndex(suggestions)] || null;
        }

        function renderInsightsButton(suggestion) {
            if (!(showInsightsBtn instanceof HTMLButtonElement)) {
                return;
            }

            const activeSuggestion = suggestion && !isInsightSnoozed(suggestion)
                ? suggestion
                : resolveActiveInsightSuggestion();
            const canShow = !!activeSuggestion && !!activeSuggestion.text;
            showInsightsBtn.hidden = !canShow;
            showInsightsBtn.disabled = !canShow;
            showInsightsBtn.classList.toggle("active", insightsDrawerOpen && canShow);
            showInsightsBtn.setAttribute("aria-expanded", String(insightsDrawerOpen && canShow));
            showInsightsBtn.setAttribute(
                "title",
                canShow
                     ? (insightsDrawerOpen ? "Close insights" : "Open insights for the current result context")
                    : "No high-confidence insights for this result"
            );
        }

        function buildInsightMetaRow(label, value) {
            if (value === null || value === undefined || String(value).trim() === "") {
                return "";
            }

            return "<div class=\\"insights-meta-row\\">" +
                "<span class=\\"insights-meta-label\\">" + escapeHtml(label) + "</span>" +
                "<span class=\\"insights-meta-value\\">" + escapeHtml(String(value)) + "</span>" +
                "</div>";
        }


        function buildInsightListHtml(title, items) {
            if (!Array.isArray(items) || items.length === 0) {
                return "";
            }

            return "<div class=\\"insights-section\\">" +
                "<div class=\\"insights-section-title\\">" + escapeHtml(title) + "</div>" +
                "<ul class=\\"insights-section-list\\">" +
                items.map((item) => "<li>" + escapeHtml(item) + "</li>").join("") +
                "</ul>" +
                "</div>";
        }

        function buildRawTraceDetailsHtml(suggestion) {
            const payload = suggestion?.payload || {};
            if (payload.kind !== "pluginTraceExecutionSummary") {
                return "";
            }

            const rawSignals = Array.isArray(payload.rawSignals) ? payload.rawSignals : [];
            const rawDetails = Array.isArray(payload.rawDetails) ? payload.rawDetails : [];
            if (rawSignals.length === 0 && rawDetails.length === 0) {
                return "";
            }

            const rawJson = rawSignals.length > 0
                ? JSON.stringify(rawSignals, null, 2)
                : JSON.stringify(rawDetails, null, 2);
            const detailRows = rawDetails.length > 0
                ? "<ul class=\\"insights-raw-list\\">" + rawDetails.map((detail) => "<li>" + escapeHtml(detail) + "</li>").join("") + "</ul>"
                : "";

            return "<details class=\\"insights-raw-details\\">" +
                "<summary>" + escapeHtml(payload.rawTraceActionLabel || "View raw trace details") + "</summary>" +
                detailRows +
                "<div class=\\"insights-raw-actions\\">" +
                "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\\" data-copy-insight-raw-trace=\\"true\\">Copy raw JSON</button>" +
                "</div>" +
                "<pre class=\\"insights-raw-json\\">" + escapeHtml(rawJson) + "</pre>" +
                "</details>";
        }

        function buildExecutionInsightContentHtml(suggestion) {
            const payload = suggestion?.payload || {};
            if (payload.kind !== "pluginTraceExecutionSummary") {
                return "";
            }

            const detected = Array.isArray(payload.detectedSignals)
                ? payload.detectedSignals
                : (payload.signalSummary ? String(payload.signalSummary).split(" · ").filter(Boolean) : []);
            const nextSteps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
            const pluginName = payload.displayPluginName || payload.typeName || "Unknown plugin";
            return "<div class=\\"insights-plugin-name\\">" + escapeHtml(pluginName) + "</div>" +
                buildInsightListHtml("Detected", detected) +
                (payload.impact ? "<div class=\\"insights-section\\"><div class=\\"insights-section-title\\">Impact</div><p class=\\"insights-section-text\\">" + escapeHtml(payload.impact) + "</p></div>" : "") +
                buildInsightListHtml("Recommended next steps", nextSteps) +
                buildRawTraceDetailsHtml(suggestion);
        }

        function getInsightKicker(suggestion) {
            const payload = suggestion?.payload || {};
            if (payload.kind === "pluginTraceLookupFailed" || payload.kind === "pluginTraceNoSignals" || payload.kind === "pluginTraceSampleInspected") {
                return "Execution status";
            }

            if (payload.kind === "pluginTraceUnavailable") {
                return "Execution Insights availability";
            }

            return "Recommended next step";
        }

        function buildInsightsCardHtml(suggestion, confidence) {
            const executionContent = buildExecutionInsightContentHtml(suggestion);
            const title = "<div class=\\"insights-card-title\\">" + escapeHtml(suggestion.text) + "</div>";
            const reason = suggestion.reason ? "<p class=\\"insights-card-reason\\">" + escapeHtml(suggestion.reason) + "</p>" : "";

            return "<section class=\\"insights-card\\">" +
                "<div class=\\"insights-card-kicker\\">" + escapeHtml(getInsightKicker(suggestion)) + "</div>" +
                title +
                (executionContent || reason) +
                (executionContent ? reason : "") +
                "<div class=\\"insights-meta\\">" +
                buildInsightMetaRow("Source", suggestion.source) +
                buildInsightMetaRow("Confidence", confidence) +
                buildInsightMetaRow("Action", suggestion.actionId) +
                "</div>" +
                buildInsightsApplyHtml(suggestion) +
                "</section>";
        }

        function copyActiveInsightRawTrace() {
            const suggestion = resolveActiveInsightSuggestion();
            const payload = suggestion?.payload || {};
            const rawSignals = Array.isArray(payload.rawSignals) ? payload.rawSignals : [];
            const rawDetails = Array.isArray(payload.rawDetails) ? payload.rawDetails : [];
            const valueToCopy = rawSignals.length > 0 ? rawSignals : rawDetails;

            if (!valueToCopy || valueToCopy.length === 0) {
                showCopyStatus("No raw trace details available");
                return;
            }

            navigator.clipboard.writeText(JSON.stringify(valueToCopy, null, 2))
                .then(() => showCopyStatus("Raw trace JSON copied"))
                .catch(() => showCopyStatus("Copy failed"));
        }

        function buildInsightsApplyHtml(suggestion) {
            if (!suggestion || !suggestion.canApply || !suggestion.actionId) {
                return "";
            }

            return "<div class=\\"insights-action-row\\">" +
                "<button class=\\"insights-apply-btn\\" type=\\"button\\" data-insights-apply-action=\\"true\\">" +
                escapeHtml(suggestion.applyLabel || "Apply") +
                "</button>" +
                "<span class=\\"insights-action-hint\\">Uses the same preview-first Binder action path.</span>" +
                "</div>";
        }

        function buildInsightNavigationHtml(suggestions) {
            if (!Array.isArray(suggestions) || suggestions.length <= 1) {
                return "";
            }

            const currentIndex = clampActiveInsightIndex(suggestions);
            return "<div class=\\"insights-nav\\">" +
                "<button class=\\"insights-nav-btn\\" type=\\"button\\" data-insights-nav=\\"prev\\" title=\\"Previous insight\\">‹</button>" +
                "<span class=\\"insights-nav-status\\">Insight " + escapeHtml(String(currentIndex + 1)) + " of " + escapeHtml(String(suggestions.length)) + "</span>" +
                "<button class=\\"insights-nav-btn\\" type=\\"button\\" data-insights-nav=\\"next\\" title=\\"Next insight\\">›</button>" +
                "</div>";
        }

        function buildInsightsBoundaryHtml(suggestion) {
            if (suggestion && suggestion.canApply && suggestion.actionId) {
                return "<section class=\\"insights-boundary actionable\\">" +
                    "<div class=\\"insights-boundary-title\\">Actionable insight<\/div>" +
                    "<div class=\\"insights-boundary-text\\">Apply uses the same preview-first Binder action path. This insight is temporarily hidden after Apply so stale guidance is not repeated before the query is rerun.<\/div>" +
                    "<\/section>";
            }

            return "<section class=\\"insights-boundary\\">" +
                "<div class=\\"insights-boundary-title\\">Suggestion only<\/div>" +
                "<div class=\\"insights-boundary-text\\">This drawer explains the recommendation only. Upgrade-capable actions remain hidden unless the current plan can apply them.<\/div>" +
                "<\/section>";
        }

        function executeActiveInsightSuggestion() {
            const suggestion = resolveActiveInsightSuggestion();
            if (!suggestion || !suggestion.actionId || !suggestion.canApply) {
                return;
            }

            snoozeInsight(suggestion);
            vscodeApi.postMessage({
                type: "executeBinderSuggestion",
                payload: {
                    actionId: suggestion.actionId,
                    payload: suggestion.payload || {}
                }
            });

            const nextSuggestion = resolveActiveInsightSuggestion();
            renderBinderSuggestion(nextSuggestion);
            renderInsightsButton(nextSuggestion);
            if (nextSuggestion) {
                insightsDrawerOpen = true;
                renderInsightsDrawer();
            } else {
                closeInsightsDrawer();
            }
        }

        function moveActiveInsight(delta) {
            const suggestions = collectActiveInsightSuggestions();
            if (suggestions.length <= 1) {
                return;
            }

            activeInsightIndex = (clampActiveInsightIndex(suggestions) + delta + suggestions.length) % suggestions.length;
            renderInsightsButton(resolveActiveInsightSuggestion());
            renderInsightsDrawer();
        }

        function renderInsightsDrawer() {
            if (!(insightsDrawer instanceof HTMLElement) || !(insightsDrawerBody instanceof HTMLElement)) {
                return;
            }

            const suggestions = collectActiveInsightSuggestions();
            const suggestion = suggestions.length > 0 ? suggestions[clampActiveInsightIndex(suggestions)] : null;
            const canShow = !!suggestion && !!suggestion.text;
            const shouldShow = insightsDrawerOpen && canShow;

            insightsDrawer.classList.toggle("open", shouldShow);
            insightsDrawer.setAttribute("aria-hidden", String(!shouldShow));

            if (shouldShow) {
                insightsDrawer.removeAttribute("hidden");
            } else {
                insightsDrawer.setAttribute("hidden", "true");
            }

            if (!canShow) {
                insightsDrawerBody.innerHTML = "";
                return;
            }

            const confidence = typeof suggestion.confidence === "number"
                ? Math.round(suggestion.confidence * 100) + "%"
                : "";

            insightsDrawerBody.innerHTML =
                buildInsightNavigationHtml(suggestions) +
                buildInsightsCardHtml(suggestion, confidence) +
                buildInsightsBoundaryHtml(suggestion);
        }

        function toggleInsightsDrawer() {
            const suggestion = resolveActiveInsightSuggestion();

            if (!suggestion || !suggestion.text) {
                insightsDrawerOpen = false;
                renderInsightsButton(null);
                renderInsightsDrawer();
                return;
            }

            insightsDrawerOpen = !insightsDrawerOpen;
            renderInsightsButton(suggestion);
            renderInsightsDrawer();
        }

        function closeInsightsDrawer() {
            insightsDrawerOpen = false;
            renderInsightsButton(resolveActiveInsightSuggestion());
            renderInsightsDrawer();
        }

        function renderBinderSuggestion(suggestion) {
            if (!(binderSuggestionBtn instanceof HTMLButtonElement)) {
                return;
            }

            if (suggestion && isInsightSnoozed(suggestion)) {
                suggestion = resolveActiveInsightSuggestion();
            }

            if (!suggestion || !suggestion.text || !suggestion.actionId || suggestion.payload?.hideBinderButton === true) {
                binderSuggestionBtn.hidden = true;
                binderSuggestionBtn.textContent = "";
                binderSuggestionBtn.removeAttribute("data-binder-action-id");
                binderSuggestionBtn.removeAttribute("data-binder-payload");
                return;
            }

            binderSuggestionBtn.hidden = false;
            binderSuggestionBtn.textContent = suggestion.text;
            binderSuggestionBtn.setAttribute("title", suggestion.text);
            binderSuggestionBtn.setAttribute("data-binder-action-id", suggestion.actionId);
            binderSuggestionBtn.setAttribute("data-binder-payload", JSON.stringify(suggestion.payload || {}));
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
