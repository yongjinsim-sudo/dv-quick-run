export const RESULT_VIEWER_STYLES = `
        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-editor-foreground);
            background-color: var(--vscode-editor-background);
            padding: 12px;
            margin: 0;
        }

        .page {
            display: flex;
            flex-direction: column;
            gap: 12px;
            height: 100vh;
            box-sizing: border-box;
            padding: 12px;
        }

        .toolbar {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            flex-wrap: wrap;
        }

        .toolbar button + button {
            margin-left: 6px;
        }

        #showRelationshipsBtn {
            margin-left: 16px;
        }

        .toolbar-left {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .toolbar-right {
            display: flex;
            align-items: center;
            gap: 8px;
            opacity: 0.9;
            flex-wrap: wrap;
        }
        
        .toolbar button {
            min-width: 36px;
        }

        .viewer-title {
            font-size: 13px;
            font-weight: 600;
        }

        .row-count {
            font-size: 12px;
            opacity: 0.8;
        }

        .copy-status {
            font-size: 12px;
            color: var(--vscode-testing-iconPassed);
            min-width: 56px;
            text-align: right;
        }

        .viewer-icon {
            width: 16px;
            height: 16px;
            margin-right: 4px;
            opacity: 0.9;
        }

        .environment-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 3px 8px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            font-size: 12px;
            line-height: 1;
        }

        .environment-dot {
            width: 8px;
            height: 8px;
            border-radius: 999px;
            display: inline-block;
            border: 1px solid rgba(0, 0, 0, 0.25);
        }

        .environment-dot.white {
            background: #d4d4d4;
        }

        .environment-dot.amber {
            background: #d7ba7d;
        }

        .environment-dot.red {
            background: #f48771;
        }

        button {
            padding: 6px 14px;
            border-radius: 6px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            cursor: pointer;
            font-size: 12px;
        }

        button:hover {
            background: var(--vscode-button-hoverBackground);
        }

        button.active {
            outline: 1px solid var(--vscode-focusBorder);
        }

        .view-container {
            min-height: 0;
            flex: 1;
        }

        #tableView {
            display: block;
            overflow: auto;
            max-height: calc(100vh - 90px);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
        }

        #jsonView {
            display: none;
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 12px;
            overflow: auto;
            max-height: calc(100vh - 90px);
            box-sizing: border-box;
            background: var(--vscode-editor-background);
        }

        .table-tools {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            gap: 8px;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
            z-index: 3;
        }

        .table-filter-input {
            min-width: 220px;
            max-width: 320px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        table {
            border-collapse: collapse;
            width: max-content;
            min-width: 100%;
            font-size: 12px;
            table-layout: auto;
        }

        thead {
            position: sticky;
            top: 41px;
            z-index: 2;
            background: var(--vscode-editorWidget-background);
        }

        th,
        td {
            border-bottom: 1px solid var(--vscode-panel-border);
            border-right: 1px solid var(--vscode-panel-border);
            padding: 8px 10px;
            text-align: left;
            vertical-align: top;
            white-space: nowrap;
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
            overflow: hidden;
            text-overflow: ellipsis;
            box-sizing: border-box;
        }

        th:last-child,
        td:last-child {
            border-right: none;
        }

        th {
            font-weight: 600;
            position: relative;
            user-select: none;
        }

        .th-content {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            min-width: 0;
        }

        .sort-button {
            all: unset;
            cursor: pointer;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            flex: 1;
        }

        .sort-indicator {
            opacity: 0.85;
        }

        .resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            cursor: col-resize;
        }

        .resize-handle:hover,
        .resizing .resize-handle {
            background: var(--vscode-focusBorder);
            opacity: 0.35;
        }

        tbody tr:nth-child(even) {
            background: rgba(255, 255, 255, 0.03);
        }

        tbody tr:hover {
            background: rgba(255, 255, 255, 0.06);
        }

        tbody tr:hover .cell-actions {
            opacity: 1;
        }

        .cell-actions:focus-within {
            opacity: 1;
        }

        .copyable {
            cursor: pointer;
        }

        .copyable:hover {
            background: rgba(255, 255, 255, 0.08);
        }

        .guid-cell {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }

        .context-action-cell {
            position: relative;
        }

        .guid-value {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .cell-actions {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            margin-left: auto;
            position: relative;
            flex: 0 0 auto;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .inline-action {
            border: none;
            background: transparent;
            padding: 0 2px;
            margin: 0;
            cursor: pointer;
            font-size: 12px;
            line-height: 1;
            opacity: 0.78;
            transition: opacity 0.12s ease;
        }

        .inline-action:hover {
            background: transparent;
            opacity: 1;
        }

        .overflow-menu {
            position: absolute;
            top: 18px;
            right: 0;
            min-width: 170px;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            box-shadow: 0 6px 14px rgba(0, 0, 0, 0.2);
            padding: 4px;
            z-index: 20;
        }

        .overflow-menu[hidden] {
            display: none;
        }

        .overflow-menu.open-up {
            top: auto;
            bottom: 18px;
        }

        .overflow-menu-overlay {
            position: fixed;
            display: inline-block;
            width: max-content;
            min-width: 170px;
            max-width: 260px;

            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            box-shadow: 0 6px 14px rgba(0,0,0,0.2);
            padding: 4px;
        }

        .overflow-menu-overlay button {
            display: block;
            width: 100%;
            white-space: nowrap;
        }

        .overflow-item {
            display: flex;
            width: 100%;
            align-items: center;
            gap: 8px;
            border: none;
            background: transparent;
            color: inherit;
            text-align: left;
            padding: 7px 8px;
            border-radius: 4px;
        }

        .overflow-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .empty-state {
            padding: 18px 14px;
            opacity: 0.75;
        }

        .array-cell {
            cursor: default;
            background: rgba(47, 129, 247, 0.10);
        }

        .array-cell:hover {
            background: rgba(47, 129, 247, 0.18);
        }

        .array-cell-content {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            min-width: 0;
            max-width: 100%;
        }

        .array-cell-text {
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
            color: #9ecbff;
        }

        .array-badge {
            display: inline-block;
            padding: 1px 6px;
            border-radius: 999px;
            background: #2f81f7;
            color: white;
            font-size: 10px;
            font-weight: 700;
            letter-spacing: 0.3px;
            flex: 0 0 auto;
        }

        .legend {
            margin-top: 10px;
            padding: 10px 12px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            color: var(--vscode-descriptionForeground);
        }

        .legend-title {
            font-weight: 600;
            margin-bottom: 6px;
            color: var(--vscode-editor-foreground);
        }

        .legend-list {
            display: flex;
            flex-wrap: wrap;
            gap: 10px 18px;
        }

        .legend-item code {
            font-family: var(--vscode-editor-font-family, var(--vscode-font-family));
            font-size: 12px;
        }

        .drawer {
            display: none;
            margin-top: 12px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-editorWidget-background);
            overflow: hidden;
        }

        .drawer.open {
            display: block;
        }

        .drawer-header {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 12px;
            padding: 10px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: rgba(255, 255, 255, 0.02);
        }

        .drawer-title {
            font-size: 13px;
            font-weight: 600;
        }

        .drawer-subtitle {
            font-size: 12px;
            opacity: 0.8;
        }

        .drawer-actions {
            display: flex;
            gap: 8px;
            align-items: center;
        }

        .drawer-body {
            padding: 12px;
            display: flex;
            flex-direction: column;
            gap: 12px;
            max-height: 320px;
            overflow: auto;
        }

        .drawer-tab-strip {
            display: flex;
            gap: 8px;
        }

        .drawer-tab {
            padding: 5px 10px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            background: transparent;
            color: inherit;
            cursor: pointer;
            font-size: 12px;
        }

        .drawer-tab.active {
            background: rgba(47, 129, 247, 0.18);
            border-color: rgba(47, 129, 247, 0.45);
        }

        .drawer-json {
            white-space: pre-wrap;
            word-break: break-word;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            padding: 10px;
            background: var(--vscode-editor-background);
            margin: 0;
        }

        .drawer-table-wrap {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: auto;
        }

        .drawer-empty {
            opacity: 0.75;
            padding: 12px;
        }

        .drawer-list {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }

        .drawer-chip {
            display: inline-block;
            padding: 3px 8px;
            border-radius: 999px;
            background: rgba(47, 129, 247, 0.18);
            color: #9ecbff;
            font-size: 12px;
        }

        .drawer-resize-handle {
            position: absolute;
            top: 0;
            right: 0;
            width: 8px;
            height: 100%;
            cursor: col-resize;
        }

        .drawer-resize-handle:hover,
        .drawer-resizing .drawer-resize-handle {
            background: var(--vscode-focusBorder);
            opacity: 0.35;
        }

        .drawer-table-wrap thead {
            position: static;
        }

        .traversal-status {
            display: inline-flex;
            align-items: center;
            margin-right: 8px;
        }

        .traversal-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid var(--vscode-editorWidget-border, rgba(255,255,255,0.12));
            background: var(--vscode-editorWidget-background, rgba(255,255,255,0.04));
            font-size: 11px;
        }

        .traversal-status-title {
            font-weight: 600;
        }

        .traversal-status-subtitle {
            opacity: 0.8;
        }

        .inline-action-labeled {
            display: inline-flex;
            align-items: center;
            justify-content: center;

            width: 28px;
            height: 28px;

            border-radius: 6px;
            cursor: pointer;

            transition: all 0.15s ease;
        }

        .inline-action-icon {
            font-size: 18px;   
            line-height: 1;
        }

        .inline-action-labeled:hover {
            background-color: rgba(255, 255, 255, 0.08);
        }

        .inline-action-labeled:hover .inline-action-icon {
            transform: translateX(2px); /* subtle forward motion */
        }

        .empty-state-title {
            font-weight: 600;
            margin-bottom: 6px;
        }

        .empty-state-message {
            opacity: 0.8;
            font-size: 12px;
        }
`;
