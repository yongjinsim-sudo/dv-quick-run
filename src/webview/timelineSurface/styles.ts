export function getTimelineSurfaceStyles(): string {
  return `
    :root {
      color-scheme: dark;
      --dvqr-bg: #121212;
      --dvqr-card: #1f1f1f;
      --dvqr-card-strong: #252525;
      --dvqr-border: #333;
      --dvqr-border-strong: #278ac5;
      --dvqr-text: #ddd;
      --dvqr-muted: #aaa;
      --dvqr-accent: #2eaadc;
      --dvqr-warning: #f0b429;
      --dvqr-error: #f97583;
      --dvqr-success: #7ee787;
    }
    body {
      margin: 0;
      padding: 20px;
      background: var(--dvqr-bg);
      color: var(--dvqr-text);
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif);
      font-size: var(--vscode-font-size, 13px);
    }
    .dvqr-timeline {
      max-width: 1180px;
      margin: 0 auto;
    }
    .dvqr-timeline-hero,
    .dvqr-timeline-card,
    .dvqr-timeline-interval,
    .dvqr-timeline-event,
    .dvqr-timeline-warning {
      border: 1px solid var(--dvqr-border);
      border-radius: 10px;
      background: var(--dvqr-card);
    }
    .dvqr-timeline-hero {
      padding: 18px;
      border-left: 4px solid var(--dvqr-border-strong);
      margin-bottom: 16px;
    }
    .dvqr-timeline-hero-topline,
    .dvqr-timeline-interval-header,
    .dvqr-timeline-event-header,
    .dvqr-timeline-section-heading,
    .dvqr-timeline-trust {
      display: flex;
      justify-content: space-between;
      gap: 16px;
      align-items: flex-start;
    }
    .dvqr-eyebrow,
    .dvqr-timeline-label,
    .dvqr-timeline-event-header,
    .dvqr-timeline-observed-between span {
      color: var(--dvqr-muted);
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: .05em;
    }
    h1, h2, h3, p {
      margin-top: 0;
    }
    h1 {
      font-size: 28px;
      margin-bottom: 0;
    }
    h2 {
      font-size: 20px;
    }
    h3 {
      font-size: 15px;
      margin-bottom: 6px;
    }
    .dvqr-muted {
      color: var(--dvqr-muted);
    }
    .dvqr-timeline-status-pill,
    .dvqr-timeline-significance,
    .dvqr-timeline-provider-summary span,
    .dvqr-timeline-trust-counts span {
      border: 1px solid var(--dvqr-border-strong);
      border-radius: 999px;
      padding: 3px 8px;
      color: #dff6ff;
      background: rgba(46, 170, 220, .12);
      white-space: nowrap;
    }
    .dvqr-timeline-status-pill.is-blocked {
      border-color: var(--dvqr-error);
      color: var(--dvqr-error);
      background: rgba(249, 117, 131, .08);
    }
    .dvqr-timeline-status-pill.is-inspect-only {
      border-color: var(--dvqr-warning);
      color: var(--dvqr-warning);
      background: rgba(240, 180, 41, .08);
    }
    .dvqr-timeline-summary-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 10px;
      margin-top: 16px;
    }
    .dvqr-timeline-metric {
      border: 1px solid var(--dvqr-border);
      border-radius: 8px;
      padding: 10px;
      background: var(--dvqr-card-strong);
    }
    .dvqr-timeline-metric span,
    .dvqr-timeline-metric strong {
      display: block;
    }
    .dvqr-timeline-metric span {
      color: var(--dvqr-muted);
      font-size: 12px;
      margin-bottom: 4px;
    }
    .dvqr-timeline-trust {
      margin-top: 16px;
      padding: 12px;
      border-radius: 8px;
      background: rgba(46, 170, 220, .08);
      border: 1px solid rgba(46, 170, 220, .32);
    }
    .dvqr-timeline-trust-counts,
    .dvqr-timeline-provider-summary {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }

    .dvqr-timeline-finding-list,
    .dvqr-timeline-no-change-summary ul {
      margin: 0;
      padding-left: 18px;
    }
    .dvqr-timeline-finding-list {
      display: grid;
      gap: 8px;
    }
    .dvqr-timeline-finding-summary-item {
      padding: 4px 0;
    }
    .dvqr-timeline-finding-summary-item a {
      color: #dff6ff;
      font-weight: 700;
      text-decoration: none;
    }
    .dvqr-timeline-finding-summary-item a:hover {
      text-decoration: underline;
    }
    .dvqr-timeline-finding-summary-item span {
      display: block;
      color: var(--dvqr-muted);
      margin-top: 2px;
    }
    .dvqr-timeline-finding-observed {
      color: var(--dvqr-text) !important;
    }
    .dvqr-timeline-no-change-summary {
      margin-top: 12px;
      color: var(--dvqr-muted);
    }
    .dvqr-timeline-no-change-summary summary {
      cursor: pointer;
      color: var(--dvqr-text);
    }

    .dvqr-timeline-card {
      padding: 16px;
      margin-bottom: 16px;
    }
    .dvqr-timeline-event-list,
    .dvqr-timeline-interval-list,
    .dvqr-timeline-warning-list {
      display: grid;
      gap: 10px;
    }
    .dvqr-timeline-event {
      padding: 12px;
      border-left: 4px solid var(--dvqr-border-strong);
    }
    .dvqr-timeline-event-high {
      border-left-color: var(--dvqr-error);
    }
    .dvqr-timeline-event-medium {
      border-left-color: var(--dvqr-warning);
    }
    .dvqr-timeline-event-low {
      border-left-color: var(--dvqr-accent);
    }
    .dvqr-timeline-interval {
      padding: 14px;
      background: var(--dvqr-card-strong);
    }
    .dvqr-timeline-observed-between {
      border-top: 1px solid var(--dvqr-border);
      margin-top: 10px;
      padding-top: 10px;
    }
    .dvqr-timeline-observed-between strong {
      display: block;
      margin-top: 3px;
    }
    .dvqr-timeline-evidence {
      margin-top: 10px;
      color: var(--dvqr-muted);
    }
    .dvqr-timeline-evidence summary {
      cursor: pointer;
      color: var(--dvqr-text);
    }
    .dvqr-timeline-empty,
    .dvqr-timeline-empty-success {
      border-style: dashed;
    }
    .dvqr-timeline-empty-success {
      border-color: var(--dvqr-success);
    }
    .dvqr-timeline-warning {
      padding: 10px;
      border-left: 4px solid var(--dvqr-warning);
    }
    .dvqr-timeline-warning-error {
      border-left-color: var(--dvqr-error);
    }
.dvqr-timeline-toolbar { display: flex; flex-wrap: wrap; gap: 10px; margin: 14px 0 16px; }
.dvqr-timeline-action-button { align-items: center; background: #0e639c; border: 1px solid #2f9fd7; border-radius: 8px; color: #fff; cursor: pointer; display: inline-flex; font-size: 13px; font-weight: 700; gap: 8px; padding: 7px 11px; text-decoration: none; }
.dvqr-timeline-action-link { background: transparent; color: #7dd3fc; }
.dvqr-timeline-report-menu { position: relative; }
.dvqr-timeline-report-menu > summary { list-style: none; }
.dvqr-timeline-report-menu > summary::-webkit-details-marker { display: none; }
.dvqr-timeline-report-menu-panel { background: #252526; border: 1px solid #3c3c3c; border-radius: 10px; box-shadow: 0 12px 32px rgba(0,0,0,.35); display: grid; gap: 4px; left: 0; min-width: 310px; padding: 10px; position: absolute; top: calc(100% + 6px); z-index: 5; }
.dvqr-timeline-report-menu-heading { color: #9da5b4; font-size: 11px; font-weight: 700; letter-spacing: .08em; padding: 4px 8px 8px; text-transform: uppercase; }
.dvqr-timeline-report-menu-panel button { align-items: center; background: transparent; border: 0; border-radius: 7px; color: #e6edf3; cursor: pointer; display: flex; justify-content: space-between; padding: 8px 10px; text-align: left; }
.dvqr-timeline-report-menu-panel button:hover { background: rgba(47,159,215,.18); }
.dvqr-timeline-report-menu-panel button span { color: #7dd3fc; font-size: 12px; font-weight: 700; }
.dvqr-timeline-interval-index { background: rgba(255,255,255,.025); border: 1px solid #30363d; border-radius: 12px; margin: 10px 0 16px; padding: 14px; }
.dvqr-timeline-interval-index h3 { margin: 0 0 8px; }
.dvqr-timeline-interval-index ol { display: grid; gap: 6px; margin: 0; padding-left: 20px; }
.dvqr-timeline-interval-index a { color: #7dd3fc; text-decoration: none; }
.dvqr-timeline-interval-index a:hover { text-decoration: underline; }

.dvqr-timeline-graph { border-left: 4px solid var(--dvqr-border-strong); }
.dvqr-timeline-graph-line { align-items: start; display: grid; gap: 0; margin: 20px 8px 4px; min-width: 560px; overflow-x: auto; padding: 28px 4px 8px; position: relative; }
.dvqr-timeline-graph-line::before { background: linear-gradient(90deg, rgba(46,170,220,.25), rgba(46,170,220,.85), rgba(46,170,220,.25)); border-radius: 999px; content: ""; height: 3px; left: 4px; position: absolute; right: 4px; top: 42px; }
.dvqr-timeline-graph-boundary { color: #dff6ff; font-size: 11px; font-weight: 700; position: absolute; top: 0; z-index: 1; }
.dvqr-timeline-graph-boundary::after { background: #7dd3fc; border: 2px solid #1f6feb; border-radius: 999px; content: ""; height: 9px; position: absolute; top: 37px; width: 9px; }
.dvqr-timeline-graph-boundary.is-start { left: 0; }
.dvqr-timeline-graph-boundary.is-start::after { left: 0; }
.dvqr-timeline-graph-boundary.is-end { right: 0; text-align: right; }
.dvqr-timeline-graph-boundary.is-end::after { right: 0; }
.dvqr-timeline-graph-interval { color: var(--dvqr-text); display: grid; gap: 5px; min-width: 0; padding: 0 8px; position: relative; text-align: center; text-decoration: none; z-index: 2; }
.dvqr-timeline-graph-interval:hover .dvqr-timeline-graph-segment { box-shadow: 0 0 0 2px rgba(46,170,220,.28); }
.dvqr-timeline-graph-interval:hover strong { color: #7dd3fc; }
.dvqr-timeline-graph-segment { background: rgba(255,255,255,.08); border: 1px solid #30363d; border-radius: 999px; display: block; height: 12px; margin: 22px 0 14px; overflow: hidden; }
.dvqr-timeline-graph-segment i { background: linear-gradient(90deg, #0969da, #54aeef); border-radius: 999px; display: block; height: 100%; min-width: 8px; }
.dvqr-timeline-graph-interval.is-quiet .dvqr-timeline-graph-segment i { background: #6e7681; min-width: 0; opacity: .6; }
.dvqr-timeline-graph-marker { background: #7dd3fc; border: 2px solid #1f6feb; border-radius: 999px; height: 11px; left: 50%; position: absolute; top: 37px; transform: translateX(-50%); width: 11px; }
.dvqr-timeline-graph-interval strong { color: #dff6ff; font-size: 13px; }
.dvqr-timeline-graph-interval em { color: #7dd3fc; font-style: normal; font-weight: 800; }
.dvqr-timeline-graph-interval small { color: var(--dvqr-muted); font-size: 10.5px; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

  `;
}
