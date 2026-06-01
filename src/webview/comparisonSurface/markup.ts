import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { escapeHtml, type ComparisonSurfaceRenderOptions } from "./comparisonSurfacePrimitives.js";
import { renderCommunityFooter, renderToolbar } from "./comparisonSurfaceActions.js";
import { renderGroupNavigation, renderTopOperationalSignals } from "./comparisonSurfaceFindings.js";
import { simplifyDifferenceTitle } from "./comparisonSurfaceDifferences.js";
import { renderComparisonPostureNote, renderComparisonSessionMetadata, renderEnvironmentPanel, renderSnapshotTrustBanner, renderSummary } from "./comparisonSurfaceSummary.js";
import { renderHandoffReadiness, renderInvestigationContinuations, renderInvestigationObservationBriefing, renderInvestigationSession, renderInvestigationWorkspace } from "./comparisonSurfaceWorkspace.js";
import { collectVerificationChecklist, renderOperationalVerificationChecklist } from "./comparisonSurfaceVerification.js";
import { getOperationalImpactSummary, getParticipationDensitySignalTitle, getSignalPriority, renderGroup, renderObservedOperationalStoryline, shortGroupTitle } from "./comparisonSurfaceGroups.js";


function renderComparisonSearchNavigation(): string {
  return `<section class="dvqr-search-nav" aria-label="Search comparison evidence">
    <div class="dvqr-search-nav-row">
      <label class="dvqr-search-label" for="dvqr-comparison-search">Search comparison evidence</label>
      <div class="dvqr-search-input-wrap">
        <input id="dvqr-comparison-search" class="dvqr-search-input" type="search" placeholder="Search plugins, workflows, solutions, identities, checklist items..." autocomplete="off" spellcheck="false" />
        <div class="dvqr-search-actions">
          <div class="dvqr-search-navigation" aria-label="Search match navigation">
            <button type="button" class="dvqr-search-nav-button" data-search-prev aria-label="Previous search match" disabled>&lt;</button>
            <span class="dvqr-search-count" data-search-count>0 / 0</span>
            <button type="button" class="dvqr-search-nav-button" data-search-next aria-label="Next search match" disabled>&gt;</button>
          </div>
          <button type="button" class="dvqr-search-clear" data-search-clear aria-label="Clear comparison search">Clear</button>
          <div class="dvqr-search-status" aria-live="polite" data-search-status>Search is local to this comparison.</div>
        </div>
      </div>
    </div>
    <p class="dvqr-search-note">Local search only. DVQR searches rendered evidence in this workspace; it does not query Dataverse or retrieve additional evidence.</p>
  </section>`;
}

function renderGroupTabs(model: ComparisonViewModel): string {
  if (model.groups.length <= 1) {
    return "";
  }

  const tabs = [
    `<button type="button" class="dvqr-tab is-active" data-group-filter="all">All <span>${model.summary.differenceCount}</span></button>`,
    ...model.groups.map((group) => `<button type="button" class="dvqr-tab" data-group-filter="${escapeHtml(group.id)}">${escapeHtml(shortGroupTitle(group.title))} <span>${group.differences.length}</span></button>`)
  ];

  return `<div class="dvqr-tabbar" role="tablist" aria-label="Comparison drift groups">${tabs.join("")}</div>`;
}

function getComparisonSurfaceEyebrow(model: ComparisonViewModel, options: ComparisonSurfaceRenderOptions = {}): string {
  const prefix = options.isProPreview === true ? "Pro Preview" : "Pro";
  return model.title.startsWith("Timeline Diff")
    ? `${prefix} · Timeline Diff`
    : `${prefix} · Cross-Environment Diff`;
}

export function getComparisonSurfaceMarkup(model: ComparisonViewModel, options: ComparisonSurfaceRenderOptions = {}): string {
  const empty = model.groups.length === 0
    ? `<section class="dvqr-card dvqr-empty dvqr-empty-success"><h2>✓ No operational drift detected</h2><p class="dvqr-muted">The selected providers did not return evidence-backed operational differences for the supplied snapshots.</p></section>`
    : "";
  const hasVerificationItems = collectVerificationChecklist(model).some((group) => group.items.length > 0);
  const initialVerificationPosture = hasVerificationItems
    ? "Verification posture: In Progress"
    : "Verification posture: No verification items";
  const initialVerificationPostureClass = hasVerificationItems
    ? " dvqr-investigation-status-pill-warning"
    : "";
  const initialOutstandingVerificationItems = hasVerificationItems
    ? `<li>
              <strong>Account Create Validation plugin disabled</strong>
              <span>High-significance runtime verification still requires external validation.</span>
            </li>

            <li>
              <strong>Workflow orchestration participation changed</strong>
              <span>Observed automation/runtime adjacency should be reviewed externally before corrective action.</span>
            </li>`
    : `<li class="dvqr-outstanding-verification-resolved">
              <strong>No rendered operational verification items</strong>
              <span>No provider drift evidence produced verification checklist items for this comparison.</span>
            </li>`;

  return `<main id="dvqr-comparison-top" class="dvqr-comparison" data-entity-logical-name="${escapeHtml(model.summary.entityLogicalName ?? "")}">
    <section class="dvqr-hero">
      <div class="dvqr-hero-topline">
        <div>
          <div class="dvqr-eyebrow">${escapeHtml(getComparisonSurfaceEyebrow(model, options))}</div>
          <div class="dvqr-title-row">
            <h1>${escapeHtml(model.title)}</h1>
          </div>
        </div>
        ${renderToolbar(options)}
      </div>
      <p class="dvqr-muted">DVQR observes operational drift. DVQR does not fix operational drift.</p>
      <div class="dvqr-toolbar dvqr-baseline-toolbar" role="toolbar" aria-label="Baseline export action"></div>
      ${renderSnapshotTrustBanner(model)}
      ${renderComparisonSessionMetadata(model)}
      
      <section class="dvqr-baseline-export-status" aria-label="Pre-investigation baseline export status">
        <div>
          <span class="dvqr-baseline-export-label">Pre-investigation baseline</span>
          <strong data-baseline-status-label>Baseline not exported</strong>
          <p data-baseline-status-description>Export the untouched comparison evidence before review state, checklist ticks, notes, or handoff decisions are captured.</p>
        </div>
        <button type="button" class="dvqr-baseline-export-button" data-export-kind="baseline">Export Baseline Diff</button>
      </section>
      <div class="dvqr-hero-detail-grid">
        <div>
          <p><strong>Source:</strong> ${escapeHtml(model.summary.sourceLabel)} · <strong>Target:</strong> ${escapeHtml(model.summary.targetLabel)}</p>
          ${renderSummary(model)}
        </div>
        ${renderEnvironmentPanel(model)}
      </div>
      ${renderComparisonPostureNote(model)}
    </section>

    ${renderInvestigationWorkspace()}

    ${renderInvestigationObservationBriefing()}

    ${renderInvestigationSession({ initialVerificationPosture, initialVerificationPostureClass, initialOutstandingVerificationItems })}

${renderObservedOperationalStoryline(model)}

${renderInvestigationContinuations()}

    ${renderTopOperationalSignals(model, { shortGroupTitle, simplifyDifferenceTitle, getParticipationDensitySignalTitle, getOperationalImpactSummary, getSignalPriority })}

    <section class="dvqr-workspace-mode-section dvqr-findings-mode" id="dvqr-findings-mode" data-workspace-section="findings">
      <h2>Operational Drift</h2>
      <p class="dvqr-section-note">Grouped, evidence-backed differences from comparison providers. These are investigation signals, not remediation instructions.</p>
      ${renderGroupNavigation(model, { shortGroupTitle })}
      ${renderComparisonSearchNavigation()}
      ${renderGroupTabs(model)}
      <div class="dvqr-group-list">${model.groups.map((group) => renderGroup(group, model.summary.sourceLabel, model.summary.targetLabel)).join("")}</div>
      ${empty}
    </section>
${renderHandoffReadiness()}

    ${renderOperationalVerificationChecklist(model)}
    ${renderCommunityFooter()}
  </main>`;
}
