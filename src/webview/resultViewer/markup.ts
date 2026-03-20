export function getResultViewerMarkup(iconUri: string): string {
    return `
    <div class="page">
        <div class="toolbar">
            <div class="toolbar-left">
                <button id="showTableBtn" type="button">TABLE</button>
                <button id="showJsonBtn" type="button">JSON</button>
                <button id="showRelationshipsBtn" title="View Relationships">🔗</button>
                <button id="showMetadataBtn" title="View Entity Metadata">📘</button>
                <button id="exportCsvBtn" title="Export current view to CSV">⬇️</button>
            </div>
            <div class="toolbar-right">
                <img src="${iconUri}" class="viewer-icon" />
                <span class="viewer-title">DV Quick Run Result Viewer</span>
                <span id="rowCount" class="row-count"></span>
                <span id="copyStatus" class="copy-status"></span>
                <span id="environmentBadge"></span>
            </div>
        </div>

        <div class="view-container">
            <div id="tableView"></div>
            <pre id="jsonView"></pre>
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
