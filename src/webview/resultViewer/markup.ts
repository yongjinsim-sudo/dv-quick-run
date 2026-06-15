export function getResultViewerMarkup(iconUri: string): string {
    return `
    <div class="page">
        <div class="toolbar">
            <div class="toolbar-left">
                <button id="showTableBtn" type="button" title="Table view">TABLE</button>
                <button id="showJsonBtn" type="button" title="JSON view">JSON</button>
                <button id="showInsightsBtn" type="button" title="View read-only insights" data-result-viewer-action="toggle-insights" aria-expanded="false" hidden>Insights</button>
                <button id="showProfileBtn" type="button" title="View Operational Profile">Profile</button>
                <button id="showRelationshipsBtn" title="View Relationships">🔗</button>
                <button id="showMetadataBtn" title="View Entity Metadata">📘</button>
                <div class="export-menu" id="exportMenu">
                    <button id="exportMenuBtn" type="button" class="export-menu-button" title="Export result data and artifacts" aria-haspopup="true" aria-expanded="false">⬇️ Export ▾</button>
                    <div id="exportMenuPanel" class="export-menu-panel" role="menu" hidden>
                        <button id="exportCsvBtn" type="button" role="menuitem" title="Export current view to CSV"><span class="export-menu-icon">📄</span><span>CSV</span></button>
                        <button id="saveJsonBtn" type="button" role="menuitem" title="Save current page JSON"><span class="export-menu-icon">📋</span><span>JSON</span></button>
                        <div class="export-menu-separator" role="separator"></div>
                        <button id="exportDvburBtn" type="button" role="menuitem" title="Export Upsert Artifact (DVBUR) (Pro)"><span class="export-menu-icon">📦</span><span>Upsert Artifact (DVBUR)</span><span id="exportDvburLock" class="export-menu-lock">🔒</span></button>
                    </div>
                </div>
                <button id="previousPageBtn" title="Load previous page" hidden>⬅️</button>
                <button id="nextPageBtn" title="Load next page" hidden>➡️</button>
                <button id="siblingExpandBtn" title="Sibling expand current traversal leg" hidden>✨</button>
                <button id="runTraversalBatchBtn" title="Run completed traversal as $batch" hidden>⚡</button>
            </div>
            <div class="toolbar-right">
                <img src="${iconUri}" class="viewer-icon" />
                <span class="viewer-title">DV Quick Run Result Viewer</span>
                <span id="traversalStatus" class="traversal-status"></span>
                <button id="binderSuggestionBtn" class="binder-suggestion-btn" type="button" hidden></button>
                <span id="pageIndicator" class="page-indicator" hidden></span>
                <span id="rowCount" class="row-count"></span>
                <span id="copyStatus" class="copy-status"></span>
                <span id="environmentBadge"></span>
            </div>
        </div>

        <div id="investigationPivotBar" class="investigation-pivot-bar" hidden></div>

        <div class="view-container">
            <div id="tableView"></div>
            <div id="jsonPanel" hidden>
                <div id="jsonTools" class="json-tools" hidden>
                    <div id="batchResponseBar" class="batch-response-bar" hidden></div>
                    <div class="json-search-cluster">
                        <input id="jsonSearchInput" class="json-search-input" type="text" placeholder="Search JSON keys and values..." title="Enter = next, Shift+Enter = previous, Esc = clear" />
                        <div class="json-search-actions">
                            <button id="jsonPrevMatchBtn" type="button" title="Previous match (Shift+Enter)">↑</button>
                            <button id="jsonNextMatchBtn" type="button" title="Next match (Enter)">↓</button>
                            <button id="jsonClearSearchBtn" type="button" title="Clear JSON search (Esc)">✕</button>
                        </div>
                    </div>
                    <span id="jsonMatchStatus" class="json-match-status"></span>
                </div>
                <pre id="jsonView"></pre>
            </div>
        </div>



        <div id="profileDrawer" class="profile-drawer" aria-hidden="true" hidden>
            <div class="profile-drawer-shell">
                <div class="profile-drawer-header">
                    <div>
                        <div id="profileDrawerTitle" class="profile-drawer-title">Operational Profile</div>
                        <div id="profileDrawerSubtitle" class="profile-drawer-subtitle">Entity-scoped operational understanding</div>
                    </div>
                    <button id="profileDrawerCloseBtn" type="button">Close</button>
                </div>
                <div id="profileDrawerBody" class="profile-drawer-body"></div>
            </div>
        </div>
        <div id="insightsDrawer" class="insights-drawer" aria-hidden="true" hidden>
            <div class="insights-drawer-header">
                <div>
                    <div class="insights-drawer-title">Insights</div>
                    <div class="insights-drawer-subtitle">Read-only reasoning from the current Result Viewer context</div>
                </div>
                <button id="insightsDrawerCloseBtn" type="button">Close</button>
            </div>
            <div id="insightsDrawerBody" class="insights-drawer-body"></div>
        </div>

        <div id="arrayDrawer" class="drawer">
            <div class="drawer-header">
                <div>
                    <div id="arrayDrawerTitle" class="drawer-title">Expanded records</div>
                    <div id="arrayDrawerSubtitle" class="drawer-subtitle"></div>
                </div>
                <div class="drawer-actions">
                    <button id="arrayDrawerTableTab" class="drawer-tab" type="button">TABLE</button>
                    <button id="arrayDrawerJsonTab" class="drawer-tab" type="button">JSON</button>
                    <button id="arrayDrawerCloseBtn" type="button">Close</button>
                </div>
            </div>
            <div class="drawer-body">
                <div id="arrayDrawerTableView"></div>
                <pre id="arrayDrawerJsonView" class="drawer-json"></pre>
            </div>
        </div>
    </div>
`;
}
