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




        .profile-drawer {
            display: none;
            position: fixed;
            top: 64px;
            right: 20px;
            width: min(900px, calc(100vw - 48px));
            max-height: calc(100vh - 88px);
            overflow: auto;
            z-index: 10020;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 10px;
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 88%, var(--vscode-button-background) 12%);
            color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
            box-shadow: 0 18px 52px rgba(0, 0, 0, 0.58);
        }

        .profile-drawer.open {
            display: block !important;
        }

        .profile-drawer-shell {
            display: flex;
            flex-direction: column;
            min-height: 240px;
        }

        .profile-drawer-header {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 12px;
            padding: 12px 14px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 92%, var(--vscode-button-background) 8%);
            position: sticky;
            top: 0;
            z-index: 2;
        }

        .profile-drawer-title {
            font-weight: 700;
            font-size: 13px;
        }

        .profile-drawer-subtitle {
            margin-top: 3px;
            font-size: 11px;
            opacity: 0.75;
        }

        .profile-drawer-body {
            padding: 14px;
        }

        .profile-card {
            border: 1px solid var(--vscode-panel-border);
            border-radius: 10px;
            overflow: hidden;
            background: linear-gradient(135deg, color-mix(in srgb, var(--vscode-editorWidget-background) 90%, var(--vscode-button-background) 10%), var(--vscode-editor-background));
        }

        .profile-card-heading {
            padding: 14px 16px 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .profile-title-row {
            display: flex;
            align-items: center;
            gap: 8px;
            font-weight: 700;
            font-size: 16px;
        }

        .profile-entity-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 5px;
            border: 1px solid var(--vscode-focusBorder);
            color: var(--vscode-textLink-foreground);
            font-size: 12px;
        }

        .profile-summary-row {
            display: grid;
            grid-template-columns: minmax(150px, max-content) 1fr max-content;
            align-items: center;
            gap: 14px;
            margin-top: 14px;
        }

        .profile-band-badge {
            display: inline-flex;
            align-items: center;
            gap: 6px;
            padding: 7px 10px;
            border-radius: 6px;
            border: 1px solid var(--vscode-panel-border);
            font-size: 12px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.03em;
            white-space: nowrap;
        }

        .profile-band-badge::before {
            content: "";
            width: 8px;
            height: 8px;
            border-radius: 999px;
            background: currentColor;
        }

        .profile-summary {
            font-size: 12px;
            line-height: 1.45;
            opacity: 0.86;
        }

        .profile-why-link,
        .profile-evidence-action {
            background: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid transparent;
            padding: 3px 6px;
            min-width: 0;
            font-size: 11px;
        }

        .profile-why-link:hover,
        .profile-evidence-action:hover {
            background: var(--vscode-toolbar-hoverBackground);
            border-color: var(--vscode-panel-border);
        }

        .profile-metrics {
            display: grid;
            gap: 10px;
            padding: 14px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .profile-metric-row {
            display: grid;
            grid-template-columns: 210px minmax(140px, 1fr) 120px minmax(180px, 1.2fr);
            gap: 14px;
            align-items: center;
            font-size: 12px;
            color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
        }

        .profile-metric-row.profile-evidence-empty {
            opacity: 0.68;
        }

        .profile-metric-name {
            display: inline-flex;
            align-items: center;
            gap: 9px;
            font-weight: 700;
        }

        .profile-metric-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 18px;
            height: 18px;
            border-radius: 5px;
            border: 1px solid color-mix(in srgb, currentColor 46%, transparent 54%);
            font-size: 12px;
            line-height: 1;
            flex: 0 0 auto;
        }

        .profile-metric-bar {
            height: 12px;
            border-radius: 3px;
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 76%, var(--vscode-panel-border) 24%);
            overflow: hidden;
        }

        .profile-metric-bar span {
            display: block;
            height: 100%;
            border-radius: 3px;
            background: currentColor;
        }

        .profile-metric-status {
            font-weight: 700;
        }

        .profile-metric-value {
            color: var(--vscode-descriptionForeground);
            opacity: 0.98;
        }

        .profile-band-very-high,
        .profile-band-high {
            color: color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 76%, var(--vscode-editor-foreground) 24%);
        }

        .profile-band-moderate,
        .profile-band-partial {
            color: var(--vscode-testing-iconQueued, #cca700);
        }

        .profile-band-low {
            color: var(--vscode-testing-iconPassed, #89d185);
        }

        .profile-band-none {
            color: var(--vscode-descriptionForeground);
        }


        .profile-evidence-empty .profile-metric-bar span {
            opacity: 0.55;
        }

        .profile-icon-none {
            color: var(--vscode-descriptionForeground);
        }

        .profile-evidence {
            padding: 12px 16px;
            border-bottom: 1px solid var(--vscode-panel-border);
        }

        .profile-evidence summary {
            cursor: pointer;
            font-weight: 700;
            margin-bottom: 8px;
        }

        .profile-evidence-row {
            display: grid;
            grid-template-columns: 12px minmax(180px, 1fr) minmax(180px, 1.4fr) max-content;
            gap: 10px;
            align-items: center;
            padding: 7px 0;
            border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent 28%);
            font-size: 12px;
        }

        .profile-evidence-dot {
            width: 7px;
            height: 7px;
            border-radius: 999px;
            background: currentColor;
        }

        .profile-evidence-label {
            font-weight: 600;
        }

        .profile-evidence-value {
            opacity: 0.9;
        }

        .profile-evidence-detail {
            opacity: 0.75;
        }

        .profile-evidence-empty,
        .profile-loading,
        .profile-error {
            padding: 14px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 8px;
            background: var(--vscode-editor-background);
            font-size: 12px;
            line-height: 1.45;
        }

        .profile-guidance {
            display: grid;
            grid-template-columns: 28px 1fr;
            gap: 12px;
            padding: 14px 16px;
            align-items: start;
        }

        .profile-guidance-icon {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            width: 22px;
            height: 22px;
            border-radius: 999px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-weight: 700;
            font-size: 12px;
        }

        .profile-guidance-text {
            display: grid;
            gap: 4px;
            font-size: 12px;
            line-height: 1.45;
            color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
            opacity: 0.86;
        }

        .profile-guardrails {
            margin: 0 16px 14px;
            padding: 8px 10px;
            border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 70%, transparent 30%);
            border-radius: 7px;
            color: var(--vscode-descriptionForeground);
            background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, transparent 28%);
            font-size: 11px;
            opacity: 0.92;
        }

        @media (max-width: 760px) {
            .profile-summary-row,
            .profile-metric-row,
            .profile-evidence-row {
                grid-template-columns: 1fr;
            }

            .profile-metric-bar {
                width: 100%;
            }
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
            max-width: 100%;
            overflow-wrap: anywhere;
            word-break: break-word;
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
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .insights-card-reason {
            margin: 8px 0 0;
            font-size: 12px;
            line-height: 1.45;
            opacity: 0.9;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .insights-plugin-name {
            margin-top: 8px;
            font-weight: 700;
            font-size: 12px;
        }

        .insights-plugin-full-name {
            margin-top: 3px;
            font-size: 11px;
            line-height: 1.35;
            opacity: 0.72;
            overflow-wrap: anywhere;
            word-break: break-word;
        }

        .insights-section {
            margin-top: 10px;
        }

        .insights-section-title {
            font-weight: 700;
            font-size: 12px;
            margin-bottom: 4px;
        }

        .insights-section-list {
            margin: 0;
            padding-left: 18px;
            font-size: 12px;
            line-height: 1.45;
        }

        .insights-section-text {
            margin: 0;
            font-size: 12px;
            line-height: 1.45;
            opacity: 0.9;
        }

        .insights-raw-details {
            margin-top: 12px;
            padding-top: 10px;
            border-top: 1px solid var(--vscode-panel-border);
            font-size: 12px;
        }

        .insights-raw-details summary {
            cursor: pointer;
            font-weight: 700;
            color: var(--vscode-textLink-foreground);
        }

        .insights-raw-list {
            margin: 8px 0 0;
            padding-left: 18px;
            line-height: 1.45;
            opacity: 0.9;
        }

        .insights-raw-actions {
            margin-top: 8px;
        }

        .insights-copy-raw-btn {
            padding: 4px 10px;
            font-size: 11px;
        }

        .insights-raw-json {
            max-height: 220px;
            overflow: auto;
            margin: 8px 0 0;
            padding: 8px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 6px;
            background: var(--vscode-textCodeBlock-background, var(--vscode-editor-background));
            font-size: 11px;
            line-height: 1.35;
            white-space: pre-wrap;
            word-break: break-word;
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
            overflow-wrap: anywhere;
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

        .insights-identifier-group-row {
            display: flex;
            flex-direction: column;
            gap: 4px;
        }

        .insights-identifier-group-values {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
        }

        .insights-identifier-actions {
            display: flex;
            gap: 6px;
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
            width: 100%;
            min-width: 100%;
            box-sizing: border-box;
            padding: 8px;
            border-bottom: 1px solid var(--vscode-panel-border);
            background: var(--vscode-editorWidget-background);
            position: sticky;
            top: 0;
            left: 0;
            right: 0;
            z-index: 3;
        }



        .table-tools-left,
        .table-tools-right {
            display: flex;
            align-items: center;
            gap: 8px;
            flex-wrap: wrap;
            min-width: 0;
        }

        .table-tools-right {
            margin-left: auto;
            justify-content: flex-end;
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
/* Operational Profile drawer visual cohesion pass */
.profile-drawer-subtitle {
    display: none;
}

.profile-drawer-header {
    padding: 10px 14px;
}

.profile-card {
    background:
        radial-gradient(circle at 12% 0%, color-mix(in srgb, var(--vscode-textLink-foreground) 9%, transparent 91%), transparent 38%),
        linear-gradient(135deg, color-mix(in srgb, var(--vscode-editorWidget-background) 88%, var(--vscode-button-background) 12%), var(--vscode-editor-background));
}

.profile-card-heading {
    padding: 16px 18px 14px;
}

.profile-title-row {
    gap: 10px;
    color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
    font-size: 17px;
    letter-spacing: -0.01em;
}

.profile-entity-icon {
    width: 22px;
    height: 22px;
    border-radius: 5px;
    color: #a371ff;
    border-color: color-mix(in srgb, #a371ff 72%, transparent 28%);
    background: color-mix(in srgb, #a371ff 13%, transparent 87%);
}

.profile-svg {
    width: 16px;
    height: 16px;
    display: block;
}

.profile-entity-icon .profile-svg {
    width: 17px;
    height: 17px;
}

.profile-summary-row {
    grid-template-columns: minmax(190px, max-content) 1fr max-content;
    gap: 18px;
}

.profile-summary {
    color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
    opacity: 0.9;
}

.profile-why-link {
    font-weight: 600;
    color: var(--vscode-textLink-foreground);
}

.profile-metrics {
    gap: 0;
    padding: 0 18px;
}

.profile-metric-row {
    grid-template-columns: 210px minmax(170px, 1fr) 145px minmax(190px, 1.25fr);
    gap: 16px;
    min-height: 54px;
    padding: 8px 0;
    border-bottom: 1px solid color-mix(in srgb, var(--vscode-panel-border) 58%, transparent 42%);
}

.profile-metric-row:last-child {
    border-bottom: 0;
}

.profile-metric-row.profile-evidence-empty {
    opacity: 0.62;
}

.profile-metric-name {
    gap: 12px;
    color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
    font-size: 13px;
}

.profile-metric-icon {
    width: 24px;
    height: 24px;
    border: 0;
    border-radius: 0;
    background: transparent;
}

.profile-icon-kind-automation {
    color: #a371ff;
}

.profile-icon-kind-relationship {
    color: #9a72ff;
}

.profile-icon-kind-columns {
    color: #4ea3ff;
}

.profile-icon-kind-async {
    color: #ffc400;
}

.profile-icon-kind-managed,
.profile-icon-kind-flow {
    color: #35c46a;
}

.profile-icon-kind-evidence {
    color: #5aaeff;
}

.profile-metric-bar {
    height: 12px;
    border-radius: 4px;
    background: color-mix(in srgb, var(--vscode-editorWidget-background) 70%, var(--vscode-panel-border) 30%);
}

.profile-metric-bar span {
    border-radius: 4px;
}

.profile-band-very-high .profile-metric-bar span,
.profile-band-high .profile-metric-bar span {
    background: linear-gradient(90deg, #ff8175, #ff4646);
}

.profile-metric-status.profile-band-high,
.profile-metric-status.profile-band-very-high {
    color: #ff7f74;
}

.profile-metric-value {
    color: color-mix(in srgb, var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)) 78%, var(--vscode-descriptionForeground) 22%);
    opacity: 0.88;
}

.profile-evidence {
    padding: 14px 18px 12px;
}

.profile-evidence summary {
    display: flex;
    align-items: center;
    gap: 9px;
    color: var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground));
    font-size: 14px;
}

.profile-evidence-summary-icon {
    color: #4ea3ff;
    display: inline-flex;
}

.profile-evidence-row {
    grid-template-columns: 14px minmax(230px, 1fr) minmax(180px, 1.1fr) minmax(180px, max-content);
    gap: 12px;
    min-height: 38px;
    padding: 8px 0;
}

.profile-evidence-dot {
    width: 8px;
    height: 8px;
}

.profile-evidence-dot-relationship,
.profile-evidence-dot-automation {
    color: #9a72ff;
}

.profile-evidence-dot-columns {
    color: #4ea3ff;
}

.profile-evidence-dot-async {
    color: #ffc400;
}

.profile-evidence-dot-flow,
.profile-evidence-dot-managed {
    color: #35c46a;
}

.profile-evidence-label {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-weight: 500;
    color: color-mix(in srgb, var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)) 86%, var(--vscode-descriptionForeground) 14%);
}

.profile-evidence-icon {
    display: inline-flex;
    width: 18px;
    height: 18px;
    align-items: center;
    justify-content: center;
}

.profile-evidence-action {
    display: inline-flex;
    align-items: center;
    justify-content: flex-end;
    gap: 7px;
    font-size: 12px;
    font-weight: 500;
    white-space: nowrap;
    color: var(--vscode-textLink-foreground);
}

.profile-external-svg {
    width: 15px;
    height: 15px;
}

.profile-guidance {
    margin: 12px 18px 0;
    padding: 12px 14px;
    border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 74%, transparent 26%);
    border-radius: 8px;
    background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-button-background) 8%);
    grid-template-columns: 34px 1fr;
}

.profile-guidance-icon {
    width: 26px;
    height: 26px;
    background: color-mix(in srgb, var(--vscode-button-background) 88%, #2f6fe8 12%);
}

.profile-guidance-icon .profile-svg {
    width: 17px;
    height: 17px;
}

.profile-guardrails {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 10px;
    margin: 12px 18px 16px;
    padding: 9px 10px;
    border: 0;
    background: transparent;
    font-size: 12px;
    opacity: 0.78;
}

.profile-guardrails span {
    display: inline-flex;
    align-items: center;
    gap: 6px;
}

.profile-guardrails .profile-svg {
    width: 15px;
    height: 15px;
}


/* Operational Profile drawer compact card pass */
.profile-drawer {
    top: 8px;
    right: 12px;
    width: min(900px, calc(100vw - 24px));
    max-height: calc(100vh - 16px);
    overflow: hidden;
    border-radius: 8px;
}

.profile-drawer-shell {
    min-height: 0;
}

.profile-drawer-header {
    position: absolute;
    top: 14px;
    right: 18px;
    z-index: 4;
    padding: 0;
    border: 0;
    background: transparent;
}

.profile-drawer-header > div {
    display: none;
}

#profileDrawerCloseBtn {
    padding: 5px 14px;
    min-height: 28px;
    border-radius: 5px;
    font-size: 12px;
    font-weight: 600;
}

.profile-drawer-body {
    padding: 8px 10px 10px;
    max-height: calc(100vh - 16px);
    overflow: hidden;
}

.profile-card {
    max-height: calc(100vh - 34px);
    overflow: hidden;
    border-radius: 8px;
}

.profile-card-heading {
    padding: 12px 16px 10px;
}

.profile-title-row {
    gap: 8px;
    font-size: 17px;
    padding-right: 86px;
}

.profile-entity-icon {
    width: 20px;
    height: 20px;
}

.profile-entity-icon .profile-svg {
    width: 15px;
    height: 15px;
}

.profile-summary-row {
    grid-template-columns: minmax(185px, max-content) 1fr max-content;
    gap: 14px;
    margin-top: 10px;
}

.profile-band-badge {
    padding: 6px 10px;
    border-color: color-mix(in srgb, #ff3131 65%, transparent 35%);
    color: #ff4d4d;
    background: color-mix(in srgb, #ff3131 14%, transparent 86%);
}

.profile-band-badge.profile-band-moderate,
.profile-band-badge.profile-band-partial {
    color: #ffc857;
    border-color: color-mix(in srgb, #ffc857 58%, transparent 42%);
    background: color-mix(in srgb, #ffc857 12%, transparent 88%);
}

.profile-band-badge.profile-band-low {
    color: #7ee0a3;
    border-color: color-mix(in srgb, #7ee0a3 58%, transparent 42%);
    background: color-mix(in srgb, #7ee0a3 12%, transparent 88%);
}

.profile-summary {
    line-height: 1.35;
    color: color-mix(in srgb, var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)) 92%, var(--vscode-descriptionForeground) 8%);
}

.profile-metrics {
    padding: 8px 16px;
}

.profile-metric-row {
    grid-template-columns: 210px minmax(150px, 1fr) 120px minmax(180px, 1.2fr);
    gap: 14px;
    min-height: 36px;
    padding: 5px 0;
}

.profile-metric-row.profile-evidence-empty {
    opacity: 0.54;
}

.profile-metric-name {
    font-size: 12px;
}

.profile-metric-icon {
    width: 18px;
    height: 18px;
}

.profile-metric-icon .profile-svg {
    width: 14px;
    height: 14px;
}

.profile-metric-bar {
    height: 10px;
}

.profile-metric-bar.profile-band-very-high span,
.profile-metric-bar.profile-band-high span {
    background: linear-gradient(90deg, #ff3333, #e00000);
    box-shadow: 0 0 0 1px color-mix(in srgb, #ff3333 18%, transparent 82%);
}

.profile-metric-bar.profile-band-low span {
    background: linear-gradient(90deg, #5fd48d, #2bbf6a);
    box-shadow: 0 0 0 1px color-mix(in srgb, #5fd48d 16%, transparent 84%);
}

.profile-metric-status.profile-band-high,
.profile-metric-status.profile-band-very-high {
    color: #ff4d4d;
}

.profile-metric-status.profile-band-moderate,
.profile-metric-status.profile-band-partial {
    color: #ffc857;
    background: transparent;
    border-color: transparent;
}

.profile-metric-status.profile-band-low {
    color: #7ee0a3;
    background: transparent;
    border-color: transparent;
}

.profile-evidence {
    padding: 8px 16px 8px;
}

.profile-evidence summary {
    gap: 8px;
    margin-bottom: 6px;
    font-size: 13px;
}

.profile-evidence-row {
    grid-template-columns: 12px minmax(210px, 1fr) minmax(180px, 1.1fr) minmax(170px, max-content);
    gap: 8px;
    min-height: 30px;
    padding: 5px 0 5px 28px;
    margin-left: 12px;
    border-left: 1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 16%, transparent 84%);
}

.profile-evidence-label {
    gap: 8px;
    font-size: 12px;
    color: color-mix(in srgb, var(--vscode-editorWidget-foreground, var(--vscode-editor-foreground)) 90%, var(--vscode-descriptionForeground) 10%);
}

.profile-evidence-icon {
    width: 15px;
    height: 15px;
}

.profile-evidence-icon .profile-svg {
    width: 13px;
    height: 13px;
}

.profile-evidence-dot {
    width: 7px;
    height: 7px;
}

.profile-evidence-action {
    font-size: 12px;
    padding: 2px 4px;
}

.profile-external-svg {
    width: 13px;
    height: 13px;
}

.profile-guidance {
    margin: 8px 16px 0;
    padding: 9px 12px;
    grid-template-columns: 28px 1fr minmax(170px, max-content);
    gap: 10px;
}

.profile-guidance-icon {
    width: 24px;
    height: 24px;
}

.profile-guidance-text {
    gap: 2px;
    line-height: 1.35;
}

.profile-guardrails {
    margin: 8px 16px 10px;
    padding: 0;
    gap: 9px;
    font-size: 11px;
}

.profile-guardrails .profile-svg {
    width: 13px;
    height: 13px;
}

`;
