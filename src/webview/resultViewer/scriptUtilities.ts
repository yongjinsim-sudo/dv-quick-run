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
            const source = isBatchRoot && !isBatchSummarySelected() ? model : rootModel;
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

        function isExecutionSummaryPayload(payload) {
            return payload.kind === "pluginTraceExecutionSummary" ||
                payload.kind === "asyncOperationExecutionSummary" ||
                payload.kind === "workflowExecutionMetadata" ||
                payload.kind === "flowSessionExecutionMetadata";
        }

        function buildRawTraceDetailsHtml(suggestion) {
            const payload = suggestion?.payload || {};
            if (!isExecutionSummaryPayload(payload)) {
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

        function buildInsightIdentifierGroupHtml(label, identifiers) {
            const values = identifiers
                .map((identifier) => String(identifier?.value || "").trim())
                .filter(Boolean);
            if (values.length === 0) {
                return "";
            }

            const queries = Array.from(new Set(identifiers
                .map((identifier) => String(identifier?.query || "").trim())
                .filter(Boolean)));
            const joined = values.join("\\n");
            const batchQueries = JSON.stringify(queries);
            const previewValues = values.slice(0, 3);
            const overflow = values.length - previewValues.length;
            const valuesHtml = previewValues
                .map((value) => "<code class=\\"insights-identifier-value\\">" + escapeHtml(value) + "</code>")
                .join("");
            const overflowHtml = overflow > 0 ? "<span class=\\"insights-muted\\">+" + overflow + " more</span>" : "";

            return "<li class=\\"insights-identifier-row insights-identifier-group-row\\">" +
                "<span class=\\"insights-identifier-label\\">" + escapeHtml(label) + " (" + values.length + ")</span>" +
                "<span class=\\"insights-identifier-group-values\\">" + valuesHtml + overflowHtml + "</span>" +
                "<div class=\\"insights-identifier-actions\\">" +
                "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-copy-insight-value=\\"" + escapeAttribute(joined) + "\\">Copy all</button>" +
                (queries.length > 0 ? "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-run-insight-batch-queries=\\"" + escapeAttribute(batchQueries) + "\\">Query all</button>" : "") +
                 "</div>" +
                "</li>";
        }

        function buildInsightIdentifierHtml(identifier) {
            if (!identifier || !identifier.value) {
                return "";
            }

            const label = identifier.label || "Identifier";
            const value = String(identifier.value);
            const query = typeof identifier.query === "string" ? identifier.query : "";
            return "<li class=\\"insights-identifier-row\\">" +
                "<span class=\\"insights-identifier-label\\">" + escapeHtml(label) + "</span>" +
                "<code class=\\"insights-identifier-value\\">" + escapeHtml(value) + "</code>" +
                "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-copy-insight-value=\\"" + escapeAttribute(value) + "\\">Copy</button>" +
                (query ? "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-run-insight-query=\\"" + escapeAttribute(query) + "\\">Query</button>" : "") +
                "</li>";
        }

        function buildInsightIdentifiersHtml(payload) {
            const identifiers = Array.isArray(payload.keyIdentifiers) ? payload.keyIdentifiers : [];
            if (identifiers.length === 0) {
                return "";
            }

            const groupableLabels = ["CorrelationId", "RequestId", "AsyncOperationId", "PluginTraceLogId", "WorkflowActivationId", "FlowSessionId", "FlowId", "RunId"];
            const groupedLabels = new Set();
            const groupedRows = groupableLabels
                .map((label) => {
                    const group = identifiers.filter((identifier) => identifier?.label === label);
                    if (group.length <= 1) {
                        return "";
                    }

                    groupedLabels.add(label);
                    return buildInsightIdentifierGroupHtml(label, group);
                })
                .join("");
            const remainingRows = identifiers
                .filter((identifier) => !groupedLabels.has(identifier?.label))
                .map(buildInsightIdentifierHtml)
                .join("");

            return "<div class=\\"insights-section\\">" +
                "<div class=\\"insights-section-title\\">Key identifiers</div>" +
                "<ul class=\\"insights-section-list insights-identifier-list\\">" +
                groupedRows +
                remainingRows +
                "</ul>" +
                "</div>";
        }

        function buildInsightRelatedSignalsHtml(payload) {
            const relatedSignals = Array.isArray(payload.relatedSignals) ? payload.relatedSignals : [];
            if (relatedSignals.length === 0) {
                return "";
            }

            return "<div class=\\"insights-section\\">" +
                "<div class=\\"insights-section-title\\">Related signals</div>" +
                "<ul class=\\"insights-section-list insights-query-list\\">" +
                relatedSignals.map((item) => {
                    const label = String(item?.label || "Related signal");
                    const description = String(item?.description || "");
                    const query = String(item?.query || "");
                    return "<li class=\\"insights-query-row\\">" +
                        "<span>" + escapeHtml(label) + (description ? "<br><span class=\\"insights-muted\\">" + escapeHtml(description) + "</span>" : "") + "</span>" +
                        (query ? "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-copy-insight-value=\\"" + escapeAttribute(query) + "\\">Copy query</button>" : "") +
                        (query ? "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-run-insight-query=\\"" + escapeAttribute(query) + "\\">Query</button>" : "") +
                        "</li>";
                }).join("") +
                "</ul>" +
                "</div>";
        }

        function buildInsightFollowUpQueriesHtml(payload) {
            const queries = Array.isArray(payload.followUpQueries) ? payload.followUpQueries : [];
            if (queries.length === 0) {
                return "";
            }

            return "<div class=\\"insights-section\\">" +
                "<div class=\\"insights-section-title\\">Follow-up queries</div>" +
                "<ul class=\\"insights-section-list insights-query-list\\">" +
                queries.map((item) => {
                    const query = String(item?.query || "");
                    const label = String(item?.label || "Run follow-up query");
                    if (!query) {
                        return "";
                    }

                    return "<li class=\\"insights-query-row\\">" +
                        "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-copy-insight-value=\\"" + escapeAttribute(query) + "\\">Copy query</button>" +
                        "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-run-insight-query=\\"" + escapeAttribute(query) + "\\">" + escapeHtml(label) + "</button>" +
                        "</li>";
                }).join("") +
                "</ul>" +
                "</div>";
        }


        function buildInsightExternalActionsHtml(payload) {
            const actions = Array.isArray(payload.externalActions) ? payload.externalActions : [];
            if (actions.length === 0) {
                return "";
            }

            return "<div class=\\"insights-section\\">" +
                "<div class=\\"insights-section-title\\">External actions</div>" +
                "<ul class=\\"insights-section-list insights-query-list\\">" +
                actions.map((item) => {
                    const url = String(item?.url || "");
                    const label = String(item?.label || "Open link");
                    const copyLabel = String(item?.copyLabel || "Copy link");
                    if (!url) {
                        return "";
                    }

                    return "<li class=\\"insights-query-row\\">" +
                        "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-copy-insight-value=\\"" + escapeAttribute(url) + "\\">" + escapeHtml(copyLabel) + "</button>" +
                        "<button class=\\"insights-copy-raw-btn\\" type=\\"button\\" data-open-insight-url=\\"" + escapeAttribute(url) + "\\">" + escapeHtml(label) + "</button>" +
                        "</li>";
                }).join("") +
                "</ul>" +
                "</div>";
        }

        function buildExecutionInsightContentHtml(suggestion) {
            const payload = suggestion?.payload || {};
            if (!isExecutionSummaryPayload(payload)) {
                return "";
            }

            const detected = Array.isArray(payload.detectedSignals)
                ? payload.detectedSignals
                : (payload.signalSummary ? String(payload.signalSummary).split(" · ").filter(Boolean) : []);
            const nextSteps = Array.isArray(payload.nextSteps) ? payload.nextSteps : [];
            const guidedInvestigationSteps = Array.isArray(payload.guidedInvestigationSteps) ? payload.guidedInvestigationSteps : [];
            const displayName = payload.displayPluginName || payload.displayOperationName || payload.displayWorkflowName || payload.displayFlowSessionName || payload.typeName || "Execution evidence";
            const primarySignal = payload.isPrimarySignal ? "<div class=\\"insights-section\\"><div class=\\"insights-section-title\\">Primary signal</div><p class=\\"insights-section-text\\">DV Quick Run treats this as the main execution pattern to investigate first.</p></div>" : "";
            const summary = payload.summary ? "<div class=\\"insights-section\\"><div class=\\"insights-section-title\\">Summary</div><p class=\\"insights-section-text\\">" + escapeHtml(payload.summary) + "</p></div>" : "";
            return "<div class=\\"insights-plugin-name\\">" + escapeHtml(displayName) + "</div>" +
                primarySignal +
                summary +
                buildInsightListHtml("What\\'s happening", detected) +
                buildInsightIdentifiersHtml(payload) +
                (payload.impact ? "<div class=\\"insights-section\\"><div class=\\"insights-section-title\\">Impact</div><p class=\\"insights-section-text\\">" + escapeHtml(payload.impact) + "</p></div>" : "") +
                buildInsightListHtml("Guided investigation", guidedInvestigationSteps) +
                buildInsightRelatedSignalsHtml(payload) +
                buildInsightListHtml("Recommended next steps", nextSteps) +
                buildInsightExternalActionsHtml(payload) +
                buildInsightFollowUpQueriesHtml(payload) +
                buildRawTraceDetailsHtml(suggestion);
        }

        function getInsightKicker(suggestion) {
            const payload = suggestion?.payload || {};
            if (payload.kind === "pluginTraceLookupFailed" || payload.kind === "pluginTraceNoSignals" || payload.kind === "pluginTraceSampleInspected" ||
                payload.kind === "asyncOperationLookupFailed" || payload.kind === "asyncOperationNoSignals" || payload.kind === "asyncOperationSampleInspected") {
                return "Execution status";
            }

            if (payload.kind === "pluginTraceUnavailable" || payload.kind === "asyncOperationUnavailable") {
                return "Execution Insights availability";
            }

            if (payload.kind === "asyncOperationExecutionSummary") {
                return payload.isPrimarySignal ? "Primary async operation insight" : "Async operation insight";
            }

            if (payload.kind === "workflowExecutionMetadata") {
                return "Workflow metadata";
            }

            if (payload.kind === "flowSessionExecutionMetadata") {
                return payload.flowRunUrl ? "Power Automate run" : "FlowSession context";
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
            if (suggestion?.source === "execution" || suggestion?.actionId === "requestExecutionInsights") {
                return "";
            }

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
                    payload: Object.assign({}, suggestion.payload || {}, isBatchRoot && !isBatchSummarySelected() ? { batchItemKey: activeBatchKey } : {})
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
            if (insightsDrawerOpen) {
                profileDrawerOpen = false;
                renderProfileDrawer();
            }
            renderInsightsButton(suggestion);
            renderInsightsDrawer();
        }

        function closeInsightsDrawer() {
            insightsDrawerOpen = false;
            renderInsightsButton(resolveActiveInsightSuggestion());
            renderInsightsDrawer();
        }



        function bandCssClass(band) {
            const safeBand = String(band || "none");
            if (safeBand === "veryHigh") {
                return "very-high";
            }

            return safeBand.replace(/[^a-z0-9-]/gi, "-").toLowerCase();
        }

        function bandDisplayLabel(profile) {
            const label = String(profile?.headlineLabel || "Operational profile");
            return label.replace(/ complexity$/i, " operational density");
        }

        function profileIconSvg(kind, title) {
            const safeTitle = escapeHtml(title || "Profile icon");
            const common = ' class="profile-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"';
            if (kind === "entity") {
                return '<svg' + common + '><path d="M12 3 4.5 7.2 12 11.4l7.5-4.2L12 3Z"/><path d="M4.5 11.1 12 15.3l7.5-4.2"/><path d="M4.5 15 12 19.2l7.5-4.2"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "automation") {
                return '<svg' + common + '><path d="M8.8 3.8h3.1v4.1h3.6l.7 3h-4.3v3.5h3.5v3.2h-3.5v2.6H8.8v-2.6H5.3v-3.2h3.5v-3.5H4.5l.7-3h3.6V3.8Z"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "relationship") {
                return '<svg' + common + '><path d="M9.5 7.5 11 6a4 4 0 0 1 5.7 5.7l-2.2 2.2a4 4 0 0 1-5.7 0"/><path d="M14.5 16.5 13 18a4 4 0 0 1-5.7-5.7l2.2-2.2a4 4 0 0 1 5.7 0"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "columns") {
                return '<svg' + common + '><rect x="4" y="5" width="16" height="14" rx="1.5"/><path d="M4 10h16"/><path d="M4 15h16"/><path d="M9.5 5v14"/><path d="M14.5 5v14"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "async") {
                return '<svg' + common + '><path d="M13 2 5.5 13h5L9 22l9.5-13h-5L13 2Z"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "managed") {
                return '<svg' + common + '><path d="M12 3.5 19 6v5.3c0 4.1-2.8 7.2-7 9.2-4.2-2-7-5.1-7-9.2V6l7-2.5Z"/><path d="m9.5 12 1.8 1.8 3.5-4"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "evidence") {
                return '<svg' + common + '><path d="M9 4h6"/><path d="M9 4a3 3 0 0 0 6 0"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="M8 11h8"/><path d="M8 15h6"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "flow") {
                return '<svg' + common + '><path d="M12 5v4"/><path d="M7 15v2"/><path d="M17 15v2"/><path d="M12 9H7v3"/><path d="M12 9h5v3"/><rect x="9" y="3" width="6" height="4" rx="1"/><rect x="4" y="12" width="6" height="4" rx="1"/><rect x="14" y="12" width="6" height="4" rx="1"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "info") {
                return '<svg' + common + '><circle cx="12" cy="12" r="9"/><path d="M12 10v6"/><path d="M12 7h.01"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "external") {
                return '<svg class="profile-external-svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M20 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h4"/></svg>';
            }
            if (kind === "target") {
                return '<svg' + common + '><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/><path d="M12 2v3"/><path d="M12 19v3"/><path d="M2 12h3"/><path d="M19 12h3"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "user") {
                return '<svg' + common + '><circle cx="12" cy="8" r="3"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "document") {
                return '<svg' + common + '><path d="M7 3h7l4 4v14H7z"/><path d="M14 3v5h5"/><path d="M9 13h6"/><path d="M9 17h6"/><title>' + safeTitle + '</title></svg>';
            }
            if (kind === "blocked") {
                return '<svg' + common + '><circle cx="12" cy="12" r="9"/><path d="M6.5 6.5 17.5 17.5"/><title>' + safeTitle + '</title></svg>';
            }
            return '<svg' + common + '><path d="M12 5 5 9l7 4 7-4-7-4Z"/><path d="M5 15l7 4 7-4"/><title>' + safeTitle + '</title></svg>';
        }

        function profileDimensionIconKind(dimension) {
            const id = String(dimension?.id || "").toLowerCase();
            const label = String(dimension?.label || "").toLowerCase();
            if (id.includes("plugin") || label.includes("plugin") || label.includes("automation")) {
                return "automation";
            }
            if (id.includes("relationship") || label.includes("relationship")) {
                return "relationship";
            }
            if (id.includes("attribute") || id.includes("column") || label.includes("column")) {
                return "columns";
            }
            if (id.includes("async") || label.includes("async")) {
                return "async";
            }
            if (id.includes("managed") || label.includes("managed")) {
                return "managed";
            }
            return "entity";
        }

        function profileEvidenceIconKind(item) {
            const kind = String(item?.kind || "").toLowerCase();
            const label = String(item?.label || "").toLowerCase();
            if (kind.includes("plugin") || label.includes("plugin")) {
                return "automation";
            }
            if (kind.includes("relationship") || label.includes("relationship")) {
                return "relationship";
            }
            if (kind.includes("attribute") || kind.includes("column") || label.includes("column")) {
                return "columns";
            }
            if (kind.includes("async") || label.includes("async")) {
                return "async";
            }
            if (kind.includes("flow") || label.includes("flow") || label.includes("workflow")) {
                return "flow";
            }
            if (kind.includes("managed") || label.includes("managed")) {
                return "managed";
            }
            return "evidence";
        }

        function profileEvidenceActionLabel(item) {
            const label = String(item?.label || "evidence").toLowerCase();
            if (label.includes("plugin")) {
                return "View plugin steps";
            }
            if (label.includes("relationship")) {
                return "View relationships";
            }
            if (label.includes("column") || label.includes("attribute")) {
                return "View columns";
            }
            if (label.includes("async")) {
                return "View async operations";
            }
            if (label.includes("workflow")) {
                return "View workflows";
            }
            if (label.includes("flow")) {
                return "View flows";
            }
            if (label.includes("managed")) {
                return "View managed state";
            }
            return "View evidence";
        }

        function buildProfileMetricRowHtml(profile, dimension) {
            const band = String(dimension?.band || "none");
            const bandClass = escapeAttribute(bandCssClass(band));
            const hasEvidence = Array.isArray(dimension?.evidence) && dimension.evidence.length > 0;
            const intensity = Math.max(0, Math.min(100, Number(dimension?.intensityPercent || 0)));
            const evidenceLabel = hasEvidence ? String(dimension.evidenceStateLabel || dimension.valueLabel || "Evidence observed") : "No evidence observed";
            const rawValueLabel = String(dimension?.valueLabel || evidenceLabel);
            const valueLabel = String(dimension?.stateKind || "") === "managed" && rawValueLabel === evidenceLabel ? "" : rawValueLabel;
            const iconKind = profileDimensionIconKind(dimension);
            return '<div class="profile-metric-row profile-evidence-' + (hasEvidence ? 'present' : 'empty') + '">' +
                '<div class="profile-metric-name"><span class="profile-metric-icon profile-icon-kind-' + escapeAttribute(iconKind) + '" aria-hidden="true">' + profileIconSvg(iconKind, dimension?.label || "Profile signal") + '</span><span>' + escapeHtml(dimension?.label || "Profile signal") + '</span></div>' +
                '<div class="profile-metric-bar profile-band-' + bandClass + '" aria-hidden="true"><span style="width: ' + intensity + '%"></span></div>' +
                '<div class="profile-metric-status profile-band-' + bandClass + '">' + escapeHtml(evidenceLabel) + '</div>' +
                '<div class="profile-metric-value">' + escapeHtml(valueLabel) + '</div>' +
                '</div>';
        }

        function buildProfileEvidenceActionHtml(profile, item) {
            const actionId = String(item?.actionId || "");
            if (!actionId) {
                return "";
            }

            return '<button class="profile-evidence-action" type="button" data-profile-action="' + escapeAttribute(actionId) + '"' +
                ' data-entity-logical-name="' + escapeAttribute(profile?.entityLogicalName || "") + '"' +
                ' data-entity-set-name="' + escapeAttribute(model.entitySetName || "") + '">' + escapeHtml(profileEvidenceActionLabel(item)) + ' ' + profileIconSvg("external", "Open evidence") + '</button>';
        }

        function buildProfileEvidenceRowHtml(profile, item) {
            const iconKind = profileEvidenceIconKind(item);
            return '<div class="profile-evidence-row">' +
                '<span class="profile-evidence-dot profile-evidence-dot-' + escapeAttribute(iconKind) + '"></span>' +
                '<div class="profile-evidence-label"><span class="profile-evidence-icon profile-icon-kind-' + escapeAttribute(iconKind) + '" aria-hidden="true">' + profileIconSvg(iconKind, item?.label || "Evidence") + '</span><span>' + escapeHtml(item?.label || "Evidence") + '</span></div>' +
                '<div class="profile-evidence-value">' + escapeHtml(item?.value || "Observed") + (item?.detail ? ' <span class="profile-evidence-detail">' + escapeHtml(item.detail) + '</span>' : "") + '</div>' +
                buildProfileEvidenceActionHtml(profile, item) +
                '</div>';
        }

        function buildProfileEvidenceSectionHtml(profile) {
            const evidence = Array.isArray(profile?.evidence) ? profile.evidence : [];
            if (!evidence.length) {
                return '<div class="profile-evidence-empty">No expandable evidence was available for this profile yet.</div>';
            }

            return evidence.map((item) => buildProfileEvidenceRowHtml(profile, item)).join("");
        }

        function buildProfileGuidanceHtml(profile) {
            const guidance = Array.isArray(profile?.investigationGuidance) ? profile.investigationGuidance : [];
            if (!guidance.length) {
                return "";
            }

            return '<div class="profile-guidance">' +
                '<div class="profile-guidance-icon">' + profileIconSvg("info", "Investigation guidance") + '</div>' +
                '<div class="profile-guidance-text">' + guidance.map((item) => '<div>' + escapeHtml(item) + '</div>').join("") + '</div>' +
                '</div>';
        }

        function buildProfileCardHtml(profile) {
            const dimensions = Array.isArray(profile?.dimensions) ? profile.dimensions : [];
            const band = String(profile?.headlineBand || "none");
            return '<div class="profile-card">' +
                '<div class="profile-card-heading">' +
                '<div class="profile-title-row"><span class="profile-entity-icon">' + profileIconSvg("entity", "Entity") + '</span><span>' + escapeHtml(profile?.entityDisplayName || profile?.entityLogicalName || "Entity") + ' (' + escapeHtml(profile?.entityLogicalName || "") + ') — Operational Profile</span></div>' +
                '<div class="profile-summary-row">' +
                '<span class="profile-band-badge profile-band-' + escapeAttribute(bandCssClass(band)) + '">' + escapeHtml(bandDisplayLabel(profile)) + '</span>' +
                '<div class="profile-summary">' + escapeHtml(profile?.summary || "Operational profile evidence is unavailable.") + '</div>' +
                '<button class="profile-why-link" type="button" data-profile-action="viewMetadata" data-entity-logical-name="' + escapeAttribute(profile?.entityLogicalName || "") + '" data-entity-set-name="' + escapeAttribute(model.entitySetName || "") + '">Why is this?</button>' +
                '</div>' +
                '</div>' +
                '<div class="profile-metrics">' + dimensions.map((dimension) => buildProfileMetricRowHtml(profile, dimension)).join("") + '</div>' +
                '<details class="profile-evidence" open><summary><span class="profile-evidence-summary-icon">' + profileIconSvg("evidence", "Evidence") + '</span><span>Evidence (click to expand)</span></summary>' + buildProfileEvidenceSectionHtml(profile) + '</details>' +
                buildProfileGuidanceHtml(profile) +
                '<div class="profile-guardrails"><span>' + profileIconSvg("target", "Entity scoped") + 'Entity-scoped</span><span>•</span><span>' + profileIconSvg("user", "User triggered") + 'User-triggered</span><span>•</span><span>' + profileIconSvg("managed", "Advisory only") + 'Advisory-only</span><span>•</span><span>' + profileIconSvg("document", "Evidence backed") + 'Evidence-backed</span><span>•</span><span>' + profileIconSvg("blocked", "No root-cause claim") + 'No root-cause claim</span></div>' +
                '</div>';
        }

        function renderProfileDrawer() {
            if (!(profileDrawer instanceof HTMLElement) || !(profileDrawerBody instanceof HTMLElement)) {
                return;
            }

            profileDrawer.classList.toggle("open", profileDrawerOpen);
            profileDrawer.setAttribute("aria-hidden", String(!profileDrawerOpen));

            if (profileDrawerOpen) {
                insightsDrawerOpen = false;
                renderInsightsButton(resolveActiveInsightSuggestion());
                renderInsightsDrawer();
                profileDrawer.removeAttribute("hidden");
            } else {
                profileDrawer.setAttribute("hidden", "true");
            }

            if (!profileDrawerOpen) {
                profileDrawerBody.innerHTML = "";
                return;
            }

            if (profileDrawerState?.status === "loading") {
                if (profileDrawerTitle instanceof HTMLElement) {
                    profileDrawerTitle.textContent = "Operational Profile";
                }
                if (profileDrawerSubtitle instanceof HTMLElement) {
                    profileDrawerSubtitle.textContent = "Building entity-scoped profile evidence…";
                }
                profileDrawerBody.innerHTML = '<div class="profile-loading">Building Operational Profile for <code>' + escapeHtml(profileDrawerState.entityLogicalName || "entity") + '</code>…</div>';
                return;
            }

            if (profileDrawerState?.status === "error") {
                if (profileDrawerTitle instanceof HTMLElement) {
                    profileDrawerTitle.textContent = "Operational Profile";
                }
                if (profileDrawerSubtitle instanceof HTMLElement) {
                    profileDrawerSubtitle.textContent = "Profile evidence unavailable";
                }
                profileDrawerBody.innerHTML = '<div class="profile-error"><strong>Profile unavailable</strong><div>' + escapeHtml(profileDrawerState.message || "Operational Profile could not be built.") + '</div></div>';
                return;
            }

            const profile = profileDrawerState?.profile;
            if (!profile) {
                profileDrawerBody.innerHTML = "";
                return;
            }

            if (profileDrawerTitle instanceof HTMLElement) {
                profileDrawerTitle.textContent = "Operational Profile";
            }
            if (profileDrawerSubtitle instanceof HTMLElement) {
                profileDrawerSubtitle.textContent = "Entity-scoped operational understanding";
            }
            profileDrawerBody.innerHTML = buildProfileCardHtml(profile);
        }

        function closeProfileDrawer() {
            profileDrawerOpen = false;
            renderProfileDrawer();
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
