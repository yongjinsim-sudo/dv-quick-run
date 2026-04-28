export const RESULT_VIEWER_STYLES = `
        [hidden] {
            display: none !important;
        }

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
            margin-left: 30px;
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


        .binder-suggestion-btn {
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid var(--vscode-focusBorder);
            background: transparent;
            color: var(--vscode-textLink-foreground);
            cursor: pointer;
            font-size: 12px;
            line-height: 1.2;
            max-width: 420px;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .binder-suggestion-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
            color: var(--vscode-textLink-activeForeground);
        }


        #showInsightsBtn {
            margin-left: 6px;
            cursor: pointer;
        }

        #showInsightsBtn.active {
            background: var(--vscode-button-hoverBackground);
            color: var(--vscode-button-foreground);
        }

        .insights-drawer {
            display: none;
            position: fixed;
            top: 72px;
            right: 24px;
            width: 420px;
            max-width: calc(100vw - 48px);
            max-height: calc(100vh - 96px);
            overflow: auto;
            z-index: 10000;
            border: 1px solid var(--vscode-focusBorder);
            border-radius: 10px;
            background: var(--vscode-editorWidget-background);
            color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
            box-shadow: 0 12px 40px rgba(0, 0, 0, 0.55);
        }

        .insights-drawer.open {
            display: block !important;
            visibility: visible !important;
            opacity: 1 !important;
            pointer-events: auto !important;
        }

        .insights-drawer-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .insights-drawer-title {
            font-weight: 700;
            font-size: 13px;
        }

        .insights-drawer-subtitle {
            margin-top: 3px;
            font-size: 11px;
            opacity: 0.75;
        }

        .insights-drawer-body {
            padding: 12px;
        }

        .insights-card,
        .insights-boundary {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            padding: 12px;
            background: var(--vscode-editor-background);
        }

        .insights-card + .insights-boundary {
            margin-top: 10px;
        }

        .insights-card-kicker {
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.04em;
            opacity: 0.72;
            margin-bottom: 6px;
        }

        .insights-card-title {
            font-weight: 700;
            line-height: 1.35;
        }

        .insights-card-reason {
            margin: 8px 0 0;
            font-size: 12px;
            line-height: 1.45;
            opacity: 0.9;
        }

        .insights-meta {
            margin-top: 10px;
            display: grid;
            gap: 6px;
        }

        .insights-meta-row {
            display: grid;
            grid-template-columns: 90px 1fr;
            gap: 8px;
            font-size: 12px;
        }

        .insights-meta-label {
            opacity: 0.7;
        }

        .insights-meta-value {
            font-weight: 600;
            word-break: break-word;
        }


        .insights-nav {
            display: flex;
            align-items: center;
            justify-content: flex-end;
            gap: 8px;
            margin-bottom: 10px;
            font-size: 11px;
            opacity: 0.85;
        }

        .insights-nav-btn {
            min-width: 28px;
            width: 28px;
            height: 24px;
            padding: 0;
            border-radius: 6px;
        }

        .insights-nav-status {
            font-variant-numeric: tabular-nums;
        }

        .insights-action-row {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .insights-apply-btn {
            padding: 5px 12px;
            min-width: 64px;
        }

        .insights-action-hint {
            font-size: 11px;
            opacity: 0.72;
            line-height: 1.35;
        }

        .insights-boundary-title {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 5px;
        }

        .insights-boundary-text {
            font-size: 12px;
            line-height: 1.45;
            opacity: 0.82;
        }

        .viewer-title {
            font-size: 13px;
            font-weight: 600;
        }

        .page-indicator {
            font-size: 12px;
            opacity: 0.9;
            padding: 3px 8px;
            border-radius: 999px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
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

        #jsonPanel {
            display: block;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            overflow: hidden;
            background: var(--vscode-editor-background);
        }

        .json-tools {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
            z-index: 3;
        }

        .json-search-input {
            min-width: 240px;
            max-width: 360px;
            padding: 6px 8px;
            border-radius: 6px;
            border: 1px solid var(--vscode-input-border);
            background: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-size: 12px;
        }

        .json-search-input:focus {
            outline: 1px solid var(--vscode-focusBorder);
            outline-offset: 0;
        }

        .json-search-cluster {
            display: inline-flex;
            align-items: center;
            justify-content: flex-end;
            gap: 6px;
            margin-left: auto;
        }

        .json-search-actions {
            display: inline-flex;
            align-items: center;
            gap: 4px;
        }

        .json-search-actions button {
            min-width: 28px;
            width: 28px;
            height: 28px;
            padding: 0;
        }

        .json-match-status {
            min-width: 60px;
            text-align: right;
            font-size: 12px;
            opacity: 0.9;
            font-variant-numeric: tabular-nums;
        }

        #jsonView {
            display: block;
            white-space: pre-wrap;
            word-break: break-word;
            padding: 12px;
            overflow: auto;
            max-height: calc(100vh - 138px);
            box-sizing: border-box;
            background: var(--vscode-editor-background);
            margin: 0;
        }

        .json-match {
            background: rgba(255, 215, 0, 0.28);
            color: inherit;
            border-radius: 3px;
            box-shadow: inset 0 0 0 1px rgba(255, 215, 0, 0.18);
        }

        .json-match-active {
            background: rgba(255, 140, 0, 0.62);
            color: inherit;
            border-radius: 3px;
            outline: 1px solid var(--vscode-focusBorder);
            box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.18);
        }

        .table-tools {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
            z-index: 3;
        }



        .table-tools-left,
        .table-tools-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }



        .row-window-controls {
            display: flex;
            align-items: center;
            gap: 6px;
            flex-wrap: wrap;
            font-size: 12px;
        }

        .row-window-label,
        .row-window-status {
            opacity: 0.85;
        }

        .row-window-size-btn,
        .row-window-nav-btn {
            padding: 4px 8px;
            border-radius: 6px;
            border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 12px;
            line-height: 1.2;
        }

        .row-window-size-btn.active {
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border-color: var(--vscode-focusBorder);
        }

        .row-window-size-btn:hover:not(:disabled),
        .row-window-nav-btn:hover:not(:disabled) {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .row-window-nav-btn:disabled {
            opacity: 0.45;
            cursor: not-allowed;
        }

        .large-result-banner.warning {
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-inputValidation-warningBackground) 24%);
            border-color: var(--vscode-inputValidation-warningBorder, var(--vscode-panel-border));
        }

        .batch-kebab-container {
            margin-left: auto;
            position: relative;
            display: flex;
            align-items: center;
        }

        .batch-kebab-btn {
            background: transparent;
            border: 1px solid transparent;
            color: var(--vscode-foreground);
            cursor: pointer;
            padding: 2px 8px;
            border-radius: 4px;
            line-height: 1.2;
        }

        .batch-kebab-btn:hover {
            background: var(--vscode-toolbar-hoverBackground);
            border-color: var(--vscode-toolbar-hoverBackground);
        }

        .batch-kebab-menu {
            position: absolute;
            right: 0;
            top: calc(100% + 4px);
            min-width: 220px;
            display: flex;
            flex-direction: column;
            background: var(--vscode-editorWidget-background);
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.25);
            padding: 4px;
            z-index: 12;
        }

        .batch-kebab-item {
            background: transparent;
            color: var(--vscode-foreground);
            border: none;
            text-align: left;
            padding: 8px 10px;
            border-radius: 4px;
            cursor: pointer;
        }

        .batch-kebab-item:hover {
            background: var(--vscode-list-hoverBackground);
        }

        .batch-response-bar {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .batch-response-tabs {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
        }

        .batch-response-tab {
            padding: 5px 10px;
            border-radius: 999px;
            background: var(--vscode-editor-background);
            border: 1px solid var(--vscode-panel-border);
            color: var(--vscode-editor-foreground);
        }

        .batch-response-tab.active {
            outline: 1px solid var(--vscode-focusBorder);
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-button-background) 18%);
        }

        .batch-response-tab.success {
            border-color: color-mix(in srgb, var(--vscode-testing-iconPassed) 45%, var(--vscode-panel-border) 55%);
        }

        .batch-response-tab.error {
            border-color: color-mix(in srgb, var(--vscode-errorForeground) 45%, var(--vscode-panel-border) 55%);
        }

        .batch-summary-card {
            padding: 16px;
            display: flex;
            flex-direction: column;
            gap: 8px;
        }

        .batch-summary-title {
            font-size: 14px;
            font-weight: 600;
        }

        .batch-summary-meta {
            font-size: 12px;
            opacity: 0.9;
        }

        .batch-summary-list {
            display: flex;
            flex-direction: column;
            gap: 10px;
            margin-top: 8px;
        }

        .batch-summary-item {
            padding: 10px 12px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
        }

        .batch-summary-item-title {
            font-weight: 600;
            margin-bottom: 4px;
        }

        .batch-summary-item-meta {
            font-size: 12px;
            opacity: 0.88;
        }
        .large-result-banner {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            padding: 8px 10px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-button-background) 18%);
            font-size: 12px;
        }

        .large-result-title {
            font-weight: 600;
        }

        .large-result-text {
            opacity: 0.92;
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

        .table-filter-clear-btn {
            padding: 6px 10px;
            border-radius: 6px;
            border: 1px solid var(--vscode-button-border, transparent);
            background: var(--vscode-button-secondaryBackground);
            color: var(--vscode-button-secondaryForeground);
            cursor: pointer;
            font-size: 12px;
        }

        .table-filter-clear-btn:hover {
            background: var(--vscode-button-secondaryHoverBackground);
        }

        .table-filter-status {
            min-width: 120px;
            text-align: right;
            font-size: 12px;
            opacity: 0.85;
        }

        .empty-filter-state {
            text-align: center;
            font-style: italic;
            opacity: 0.8;
            padding: 16px 10px;
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


        .null-value-cell {
            color: var(--vscode-descriptionForeground);
            font-style: italic;
        }

        .copyable.null-value-cell:hover {
            background: rgba(255, 255, 255, 0.08);
        }

        .guid-cell {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            min-width: 0;
        }

        .context-action-cell {
            position: relative;
        }

        .guid-value {
            flex: 1 1 auto;
            min-width: 0;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        .cell-actions {
            display: flex;
            align-items: center;
            gap: 6px;
            margin-left: auto;
            position: relative;
            flex: 0 0 auto;
            z-index: 2;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        .primary-actions,
        .overflow-actions {
            display: inline-flex;
            align-items: center;
            position: relative;
            flex: 0 0 auto;
        }

        .primary-actions {
            gap: 4px;
            z-index: 2;
        }

        .overflow-actions {
            margin-left: 2px;
            z-index: 4;
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

        .overflow-trigger {
            position: relative;
            z-index: 4;
            pointer-events: auto;
            min-width: 18px;
            min-height: 18px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
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
            
            z-index: 10000;
        }

        .overflow-menu-overlay button {
            display: block;
            width: 100%;
            white-space: nowrap;
        }

        .row-actions-header {
            width: 56px;
            min-width: 56px;
        }

        .row-action-cell {
            width: 56px;
            min-width: 56px;
            text-align: center;
        }

        .row-action-shell {
            display: inline-flex;
            align-items: center;
            gap: 4px;
            opacity: 0;
            transition: opacity 0.15s ease;
        }

        tbody tr:hover .row-action-shell,
        .row-action-cell:focus-within .row-action-shell {
            opacity: 1;
        }

        .overflow-group {
            padding: 2px 0;
        }

        .overflow-group + .overflow-group {
            margin-top: 4px;
            padding-top: 6px;
            border-top: 1px solid var(--vscode-panel-border);
        }

        .overflow-group-title {
            font-size: 10px;
            text-transform: uppercase;
            letter-spacing: 0.06em;
            opacity: 0.7;
            padding: 4px 8px 2px;
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

        .empty-title {
            margin-bottom: 10px;
            font-weight: 500;
        }

        .empty-hint {
            margin-top: 6px;
            margin-bottom: 6px;
            opacity: 0.7;
        }

        .empty-list {
          margin-top: 0;
          padding-left: 18px;
          opacity: 0.85;
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
            gap: 10px;
            flex-wrap: wrap;
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

        .inline-action.is-disabled {
            opacity: 0.45;
            cursor: not-allowed;
            pointer-events: none; /* prevents click entirely */
        }

        .inline-action.is-disabled:hover {
            background: transparent; /* remove hover highlight */
        }
            
        .inline-action.is-disabled .inline-action-icon {
            opacity: 0.6;
        }
        .empty-state-title {
            font-weight: 600;
            margin-bottom: 6px;
        }

        .empty-state-message {
            opacity: 0.8;
            font-size: 12px;
        }

        #jsonSaveBtn {
            margin-left: 6px;
        }

        .batch-summary-item-meta.error {
            color: var(--vscode-errorForeground);
        }

        .batch-error-card {
            margin: 12px;
            padding: 16px;
            border: 1px solid color-mix(in srgb, var(--vscode-errorForeground) 35%, var(--vscode-panel-border) 65%);
            border-radius: 10px;
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, transparent 12%);
        }

        .batch-error-title {
            font-size: 16px;
            font-weight: 700;
            color: var(--vscode-errorForeground);
            margin-bottom: 12px;
        }

        .batch-error-meta {
            font-size: 12px;
            opacity: 0.9;
            margin-bottom: 6px;
        }

        .batch-error-message {
            margin-top: 10px;
            margin-bottom: 12px;
            color: var(--vscode-errorForeground);
            white-space: pre-wrap;
            word-break: break-word;
        }

        .batch-error-raw {
            margin: 0;
            padding: 12px;
            border-radius: 8px;
            border: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editor-background);
            white-space: pre-wrap;
            word-break: break-word;
            max-height: 320px;
            overflow: auto;
        }
`;
