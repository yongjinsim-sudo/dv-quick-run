export const workspaceRefinementStyles = `/* Workstream 21 structural order fix: selector first, mode body after */
.dvqr-investigation-mode-surface {
  margin-bottom: 22px;
}

.dvqr-findings-mode {
  margin-top: 22px;
}

body[data-active-workspace-mode="investigation"] #dvqr-findings-mode,
body[data-active-workspace-mode="verification"] #dvqr-findings-mode,
body[data-active-workspace-mode="handoff"] #dvqr-findings-mode {
  display: none !important;
}

body[data-active-workspace-mode="findings"] #dvqr-findings-mode {
  display: block !important;
}

body[data-active-workspace-mode="findings"] .dvqr-top-signals {
  display: block !important;
}

body[data-active-workspace-mode="verification"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness {
  display: block !important;
}


/* Workstream 21 refinement: investigation observation/storyline body */
.dvqr-investigation-observation-briefing {
  margin-top: 22px;
}

.dvqr-observation-briefing-grid {
  display: grid;
  gap: 14px;
  grid-template-columns: minmax(320px, 1.35fr) repeat(2, minmax(220px, 1fr));
  margin-top: 14px;
}

.dvqr-observation-briefing-card {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 74%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 12px;
  display: grid;
  gap: 8px;
  padding: 14px;
}

.dvqr-observation-briefing-card-primary {
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 45%, var(--vscode-panel-border));
}

.dvqr-observation-briefing-label {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.dvqr-observation-briefing-card strong {
  color: var(--vscode-foreground);
  font-size: 14px;
}

.dvqr-observation-briefing-card p {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
  line-height: 1.5;
  margin: 0;
}

body[data-active-workspace-mode="investigation"] .dvqr-investigation-observation-briefing,
body[data-active-workspace-mode="investigation"] #dvqr-investigation-session,
body[data-active-workspace-mode="investigation"] #dvqr-operational-storyline,
body[data-active-workspace-mode="investigation"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="investigation"] .dvqr-top-signals {
  display: block !important;
}

@media (max-width: 960px) {
  .dvqr-observation-briefing-grid {
    grid-template-columns: 1fr;
  }
}


/* Workstream 21 HTML integrity fix: prevent mode contamination */
body[data-active-workspace-mode="findings"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="verification"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="investigation"] #dvqr-handoff-readiness {
  display: none !important;
}

body[data-active-workspace-mode="findings"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-verification-checklist,
body[data-active-workspace-mode="investigation"] #dvqr-verification-checklist {
  display: none !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-operational-storyline,
body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness,
body[data-active-workspace-mode="verification"] #dvqr-verification-checklist {
  display: block !important;
}


/* Workstream 21 final mode behaviour fix */
body[data-active-workspace-mode="verification"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="verification"] #dvqr-verification-checklist {
  display: block !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-handoff-readiness {
  display: block !important;
}

body[data-active-workspace-mode="handoff"] #dvqr-operational-storyline,
body[data-active-workspace-mode="handoff"] #dvqr-verification-checklist,
body[data-active-workspace-mode="handoff"] #dvqr-investigation-continuations,
body[data-active-workspace-mode="verification"] #dvqr-operational-storyline,
body[data-active-workspace-mode="verification"] #dvqr-handoff-readiness {
  display: none !important;
}


/* Workstream 22: session-local investigation state */
.dvqr-verification-checkbox {
  background: transparent;
  border: 0;
  color: var(--vscode-descriptionForeground);
  cursor: pointer;
  font: inherit;
  font-family: monospace;
  line-height: 1.45;
  padding: 0;
}

.dvqr-verification-checkbox:hover {
  color: var(--vscode-foreground);
}

.dvqr-verification-checkbox.is-reviewed {
  color: color-mix(in srgb, #2ea043 78%, var(--vscode-foreground));
}

.dvqr-verification-checklist-group li.is-reviewed {
  opacity: 0.78;
}

.dvqr-verification-checklist-group li.is-reviewed strong {
  text-decoration: line-through;
  text-decoration-thickness: 1px;
}


/* Workstream 24: evidence status and reviewer notes */
.dvqr-verification-item-body {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.dvqr-verification-review-controls {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 84%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 240px) minmax(260px, 1fr);
  margin-top: 6px;
  padding: 10px;
}

.dvqr-verification-review-controls label {
  display: grid;
  gap: 4px;
}

.dvqr-verification-review-controls label > span {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.dvqr-verification-status-select,
.dvqr-verification-note {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 78%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 8px;
  color: var(--vscode-foreground);
  font: inherit;
  padding: 7px 9px;
}

.dvqr-verification-note {
  min-height: 44px;
  resize: vertical;
}

.dvqr-verification-checklist-group li[data-review-status="VerifiedExternally"] {
  border-left: 3px solid color-mix(in srgb, #2ea043 68%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="RecheckedCurrent"] {
  border-left: 3px solid color-mix(in srgb, #4aa5d9 68%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="ResolvedOutsideDvqr"] {
  border-left: 3px solid color-mix(in srgb, #7ee787 60%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-verification-checklist-group li[data-review-status="NeedsFollowUp"] {
  border-left: 3px solid color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
  padding-left: 8px;
}

.dvqr-handoff-review-summary {
  border-top: 1px solid var(--vscode-panel-border);
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
  padding-top: 10px;
}

.dvqr-handoff-review-summary span {
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  padding: 4px 8px;
}

.dvqr-handoff-review-summary strong {
  color: var(--vscode-foreground);
}

@media (max-width: 760px) {
  .dvqr-verification-review-controls {
    grid-template-columns: 1fr;
  }
}


/* Workstream 25: review-aware evidence surfaces */
.dvqr-review-aware-surface {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.dvqr-review-pill {
  align-items: center;
  background: color-mix(in srgb, var(--vscode-button-background) 10%, transparent);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  display: inline-flex;
  font-size: 11px;
  font-weight: 600;
  gap: 6px;
  padding: 4px 10px;
}

.dvqr-review-pill strong {
  color: var(--vscode-foreground);
}

.dvqr-review-pill[data-review-status="VerifiedExternally"] {
  border-color: color-mix(in srgb, #2ea043 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="RecheckedCurrent"] {
  border-color: color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="ResolvedOutsideDvqr"] {
  border-color: color-mix(in srgb, #7ee787 70%, var(--vscode-panel-border));
}

.dvqr-review-pill[data-review-status="NeedsFollowUp"] {
  border-color: color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
}


/* Workstream 25 fix: reflected review posture spacing */
.dvqr-difference-card > .dvqr-review-aware-surface,
.dvqr-difference-body > .dvqr-review-aware-surface {
  border-top: 1px solid color-mix(in srgb, var(--vscode-panel-border) 72%, transparent);
  margin: 14px 18px 16px;
  padding-top: 12px;
}

.dvqr-top-signals a > .dvqr-review-aware-surface {
  margin-top: 10px;
  padding-top: 8px;
}

.dvqr-review-aware-surface {
  row-gap: 8px;
}

.dvqr-review-pill {
  line-height: 1.45;
  max-width: 100%;
}

.dvqr-review-pill strong {
  margin-right: 2px;
}


/* Workstream 25 fix: dynamic outstanding/posture states */
.dvqr-investigation-status-pill-success {
  border-color: color-mix(in srgb, #2ea043 72%, var(--vscode-panel-border));
  color: color-mix(in srgb, #7ee787 78%, var(--vscode-foreground));
}

.dvqr-outstanding-verification-list li[data-review-status="NeedsFollowUp"] {
  border-left-color: color-mix(in srgb, #d9a441 70%, var(--vscode-panel-border));
}

.dvqr-outstanding-verification-resolved {
  border-left-color: color-mix(in srgb, #2ea043 70%, var(--vscode-panel-border)) !important;
}


/* Workstream 26: inline evidence context */
.dvqr-evidence-item {
  align-items: flex-start;
  display: grid !important;
  gap: 6px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.dvqr-evidence-continuation-pill {
  background: transparent;
  cursor: pointer;
}

.dvqr-evidence-continuation-pill.is-active {
  border-color: color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
  color: var(--vscode-foreground);
}

.dvqr-inline-evidence-context {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-left: 3px solid color-mix(in srgb, #4aa5d9 70%, var(--vscode-panel-border));
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: grid;
  gap: 8px;
  grid-column: 1 / -1;
  margin-top: 4px;
  padding: 10px 12px;
}

.dvqr-inline-evidence-context[hidden] {
  display: none !important;
}

.dvqr-inline-evidence-context strong {
  color: var(--vscode-foreground);
}

.dvqr-inline-evidence-context dl {
  display: grid;
  gap: 6px;
  grid-template-columns: max-content minmax(0, 1fr);
  margin: 0;
}

.dvqr-inline-evidence-context dt {
  color: var(--vscode-descriptionForeground);
  font-weight: 700;
}

.dvqr-inline-evidence-context dd {
  margin: 0;
  min-width: 0;
  overflow-wrap: anywhere;
}


/* Workstream 26 fix: visible reset confirmation */
.dvqr-reset-review-notice {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, #2ea043 10%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 62%, #2ea043 38%);
  border-left: 4px solid color-mix(in srgb, #2ea043 76%, var(--vscode-panel-border));
  border-radius: 10px;
  color: var(--vscode-descriptionForeground);
  display: none;
  font-size: 12px;
  line-height: 1.45;
  margin: 12px 0 0;
  padding: 10px 12px;
}

.dvqr-reset-review-notice.is-visible {
  display: block;
}


/* Workstream 26 fix: in-page reset confirmation */
.dvqr-reset-review-confirmation {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 82%, var(--vscode-testing-iconQueued) 8%);
  border: 1px solid color-mix(in srgb, var(--vscode-panel-border) 62%, var(--vscode-testing-iconQueued) 38%);
  border-left: 4px solid color-mix(in srgb, var(--vscode-testing-iconQueued) 76%, var(--vscode-panel-border));
  border-radius: 10px;
  display: none;
  gap: 8px;
  line-height: 1.45;
  margin: 12px 0 0;
  padding: 12px;
}

.dvqr-reset-review-confirmation.is-visible {
  display: grid;
}

.dvqr-reset-review-confirmation span {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-reset-review-confirmation div {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}


/* Workstream 27: evidence pivot host contract */
.dvqr-inline-evidence-context [data-evidence-live-result] {
  color: var(--vscode-descriptionForeground);
}

.dvqr-inline-evidence-context [data-evidence-live-result].is-available {
  color: color-mix(in srgb, #7ee787 78%, var(--vscode-foreground));
}

.dvqr-inline-evidence-context [data-evidence-live-result].is-unavailable {
  color: color-mix(in srgb, var(--vscode-testing-iconQueued) 70%, var(--vscode-descriptionForeground));
}


/* Workstream 28: live evidence pivot preview polish */
.dvqr-inline-evidence-context [data-evidence-live-result].is-available {
  font-weight: 600;
}


.dvqr-inline-evidence-context [data-evidence-live-result].is-error {
  color: color-mix(in srgb, var(--vscode-errorForeground) 78%, var(--vscode-descriptionForeground));
}


.dvqr-classified-drift-evidence-item {
  align-items: flex-start;
  gap: 8px;
}

.dvqr-classified-drift-evidence-item .dvqr-inline-evidence-context {
  margin-left: 0;
}

.dvqr-live-pivot-timeout {
  color: var(--vscode-testing-iconQueued);
}


.dvqr-inline-evidence-context dd.is-available {
  color: color-mix(in srgb, #2ea043 82%, var(--vscode-foreground));
}

.dvqr-inline-evidence-context dd.is-unavailable {
  color: var(--vscode-testing-iconQueued);
}

.dvqr-inline-evidence-context dd.is-error,
.dvqr-live-pivot-timeout {
  color: var(--vscode-errorForeground);
}

/* v0.13.1 Audit evidence inline enrichment */
.dvqr-evidence-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.dvqr-audit-evidence-pill {
  border-color: rgba(251, 191, 36, 0.42);
}

.dvqr-audit-evidence-pill.is-active {
  background: rgba(251, 191, 36, 0.12);
}

.dvqr-inline-audit-context {
  margin-top: 10px;
  padding: 12px;
  border: 1px solid rgba(251, 191, 36, 0.28);
  border-radius: 12px;
  background: rgba(251, 191, 36, 0.06);
  display: grid;
  gap: 8px;
}

.dvqr-inline-audit-context[hidden] {
  display: none;
}

.dvqr-audit-result p,
.dvqr-audit-boundary,
.dvqr-audit-warning {
  margin: 6px 0 0;
}

.dvqr-audit-interval,
.dvqr-audit-record dl {
  display: grid;
  grid-template-columns: minmax(90px, auto) 1fr;
  gap: 4px 10px;
  margin: 8px 0;
}

.dvqr-audit-interval dt,
.dvqr-audit-record dt {
  color: var(--dvqr-muted);
  font-size: 12px;
}

.dvqr-audit-record {
  margin-top: 10px;
  padding: 10px;
  border: 1px solid rgba(148, 163, 184, 0.22);
  border-radius: 10px;
  background: rgba(15, 23, 42, 0.36);
}

.dvqr-audit-record-heading {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: space-between;
}

.dvqr-audit-query code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
  margin-top: 6px;
}

.dvqr-audit-raw-payload code,
.dvqr-audit-query code {
  display: block;
  white-space: pre-wrap;
  word-break: break-word;
}

.dvqr-audit-experimental {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid rgba(251, 191, 36, 0.22);
  color: var(--dvqr-muted);
}

.dvqr-audit-experimental p,
.dvqr-audit-edge-case {
  margin: 6px 0 0;
}

.dvqr-audit-experimental a,
.dvqr-audit-edge-case a {
  color: #7dd3fc;
}


/* v0.13.2 DVAF reconstruction artifact export */
.dvqr-dvaf-export-actions {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.dvqr-dvaf-action-button {
  background: color-mix(in srgb, var(--vscode-button-background) 16%, transparent);
  border: 1px solid color-mix(in srgb, #4aa5d9 72%, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  cursor: pointer;
  display: inline-flex;
  font-size: 11px;
  line-height: 1.45;
  padding: 3px 9px;
  white-space: nowrap;
}

.dvqr-dvaf-action-button:hover:not(:disabled) {
  background: color-mix(in srgb, var(--vscode-button-background) 24%, transparent);
  border-color: color-mix(in srgb, #4aa5d9 86%, var(--vscode-panel-border));
}

.dvqr-dvaf-action-button:disabled {
  background: transparent;
  border-color: var(--vscode-panel-border);
  color: var(--vscode-descriptionForeground);
  cursor: default;
  opacity: 0.82;
}

.dvqr-dvaf-export-result {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.dvqr-dvaf-export-result.is-visible {
  display: inline-flex;
}
`;
