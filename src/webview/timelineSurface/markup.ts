import type {
  TimelineEvent,
  TimelineFindingsSummary,
  TimelineFindingsSummaryItem,
  TimelineInterval,
  TimelineReconstruction,
  TimelineWarning,
} from "../../pro/timeline/index.js";
import { escapeHtml, formatCapturedAt } from "../comparisonSurface/comparisonSurfacePrimitives.js";

export function getTimelineSurfaceMarkup(timeline: TimelineReconstruction): string {
  return `<main id="dvqr-timeline-top" class="dvqr-timeline" data-timeline-id="${escapeHtml(timeline.id)}">
    <section class="dvqr-timeline-hero">
      <div class="dvqr-timeline-hero-topline">
        <div>
          <div class="dvqr-eyebrow">Pro · Timeline Reconstruction</div>
          <h1>${escapeHtml(timeline.summary.title)}</h1>
        </div>
        <div class="dvqr-timeline-status-pill ${getStatusClass(timeline.status)}">${escapeHtml(timeline.status)}</div>
      </div>
      <p class="dvqr-muted">Timeline Reconstruction preserves observed evidence evolution. It does not create historical certainty, causality, remediation status, or operational authority.</p>
      ${renderTimelineToolbar()}
      ${renderTrustBanner(timeline)}
      ${renderTimelineSummaryGrid(timeline)}
      ${renderWarnings(timeline.warnings)}
    </section>

    ${renderInteractiveTimelineGraph(timeline)}
    ${renderTimelineFindingsSummary(timeline.findingsSummary)}
    ${renderTopTimelineEvents(timeline.topEvents)}
    ${renderTimelineIntervals(timeline.intervals, timeline.summary.noChangesObserved)}
  </main>`;
}

function renderTimelineToolbar(): string {
  return `<div class="dvqr-timeline-toolbar" role="toolbar" aria-label="Timeline report actions">
    <details class="dvqr-timeline-report-menu">
      <summary class="dvqr-timeline-action-button">Reports ▾</summary>
      <div class="dvqr-timeline-report-menu-panel" role="menu" aria-label="Export timeline reports">
        <span class="dvqr-timeline-report-menu-heading">Export reports</span>
        <button type="button" data-timeline-export-kind="findings-summary-html" role="menuitem">Timeline Findings Summary <span>HTML</span></button>
        <button type="button" data-timeline-export-kind="findings-summary-pdf" role="menuitem">Timeline Findings Summary <span>PDF</span></button>
        <button type="button" data-timeline-export-kind="investigation-handoff-html" role="menuitem">Timeline Investigation Handoff <span>HTML</span></button>
        <button type="button" data-timeline-export-kind="investigation-handoff-pdf" role="menuitem">Timeline Investigation Handoff <span>PDF</span></button>
      </div>
    </details>
    <a class="dvqr-timeline-action-button dvqr-timeline-action-link" href="#dvqr-timeline-interval-index">Jump to intervals</a>
  </div>`;
}

function renderTimelineSummaryGrid(timeline: TimelineReconstruction): string {
  const subject = timeline.subject;
  const range = `${formatCapturedAt(timeline.summary.rangeStartCapturedAtIso)} → ${formatCapturedAt(timeline.summary.rangeEndCapturedAtIso)}`;

  return `<section class="dvqr-timeline-summary-grid" aria-label="Timeline reconstruction summary">
    ${renderMetric("Subject", subject.subjectLabel)}
    ${renderMetric("Environment", subject.environmentLabel ?? "Not specified")}
    ${renderMetric("Timeline Range", range)}
    ${renderMetric("Snapshots Analysed", String(timeline.summary.snapshotCount))}
    ${renderMetric("Intervals Compared", String(timeline.summary.intervalCount))}
    ${renderMetric("Timeline Events", String(timeline.summary.eventCount))}
  </section>`;
}

function renderMetric(label: string, value: string): string {
  return `<div class="dvqr-timeline-metric">
    <span>${escapeHtml(label)}</span>
    <strong>${escapeHtml(value)}</strong>
  </div>`;
}

function renderTrustBanner(timeline: TimelineReconstruction): string {
  return `<section class="dvqr-timeline-trust dvqr-timeline-trust-${escapeHtml(timeline.trust.state.toLowerCase().replace(/\s+/g, "-"))}" aria-label="Timeline trust state">
    <div>
      <span class="dvqr-timeline-label">Timeline Trust</span>
      <strong>${escapeHtml(timeline.trust.state)}</strong>
      <p>${escapeHtml(timeline.trust.summary)}</p>
    </div>
    <div class="dvqr-timeline-trust-counts">
      <span>${timeline.trust.verifiedCount} verified</span>
      <span>${timeline.trust.modifiedCount} modified</span>
      <span>${timeline.trust.legacyOrUnverifiedCount} legacy / unverified</span>
      <span>${timeline.trust.invalidCount} invalid</span>
    </div>
  </section>`;
}

function renderWarnings(warnings: readonly TimelineWarning[]): string {
  if (warnings.length === 0) {
    return "";
  }

  return `<section class="dvqr-timeline-warnings" aria-label="Timeline warnings">
    <h2>Evidence Boundary & Warnings</h2>
    <div class="dvqr-timeline-warning-list">
      ${warnings.map(renderWarning).join("")}
    </div>
  </section>`;
}

function renderWarning(warning: TimelineWarning): string {
  return `<article class="dvqr-timeline-warning dvqr-timeline-warning-${escapeHtml(warning.severity.toLowerCase())}">
    <strong>${escapeHtml(warning.title)}</strong>
    <p>${escapeHtml(warning.message)}</p>
  </article>`;
}


function renderInteractiveTimelineGraph(timeline: TimelineReconstruction): string {
  if (timeline.intervals.length === 0) {
    return "";
  }

  const max = Math.max(...timeline.intervals.map((interval) => interval.events.length), 1);
  const intervals = timeline.intervals.map((interval) => {
    const eventCount = interval.events.length;
    const percent = eventCount <= 0 ? 0 : Math.max(8, Math.round((eventCount / max) * 100));
    const range = `${formatCapturedAt(interval.fromCapturedAtIso)} → ${formatCapturedAt(interval.toCapturedAtIso)}`;
    const title = `Interval ${interval.index + 1}: ${eventCount} event${eventCount === 1 ? "" : "s"} first observed`;
    return `<a class="dvqr-timeline-graph-interval ${eventCount > 0 ? "has-events" : "is-quiet"}" href="#${escapeHtml(interval.id)}" title="${escapeHtml(title)}">
      <span class="dvqr-timeline-graph-segment"><i style="width:${percent}%"></i></span>
      <span class="dvqr-timeline-graph-marker" aria-hidden="true"></span>
      <strong>I${interval.index + 1}</strong>
      <em>${escapeHtml(String(eventCount))} event${eventCount === 1 ? "" : "s"}</em>
      <small>${escapeHtml(range)}</small>
    </a>`;
  }).join("");

  const first = timeline.intervals[0];
  const last = timeline.intervals[timeline.intervals.length - 1];

  return `<section class="dvqr-timeline-card dvqr-timeline-graph" aria-label="Interactive timeline graph">
    <div class="dvqr-timeline-section-heading">
      <h2>Timeline Graph</h2>
      <p>Click an interval to jump to the drift first observed in that capture window.</p>
    </div>
    <div class="dvqr-timeline-graph-line" style="grid-template-columns: repeat(${timeline.intervals.length}, minmax(132px, 1fr));">
      <span class="dvqr-timeline-graph-boundary is-start"><strong>${escapeHtml(formatCapturedAt(first.fromCapturedAtIso))}</strong></span>
      ${intervals}
      <span class="dvqr-timeline-graph-boundary is-end"><strong>${escapeHtml(formatCapturedAt(last.toCapturedAtIso))}</strong></span>
    </div>
  </section>`;
}

function renderTimelineFindingsSummary(findings: TimelineFindingsSummary): string {
  const changed = findings.changed.length > 0
    ? `<ul class="dvqr-timeline-finding-list dvqr-timeline-finding-list-changed">${findings.changed.map(renderFindingSummaryItem).join("")}</ul>`
    : `<p class="dvqr-muted">No provider-level changes were first observed across the selected snapshot sequence.</p>`;
  const noChange = findings.noChange.length > 0
    ? `<details class="dvqr-timeline-no-change-summary"><summary>No changes observed for ${findings.noChange.length} provider${findings.noChange.length === 1 ? "" : "s"}</summary><ul>${findings.noChange.map(renderFindingSummaryItem).join("")}</ul></details>`
    : "";

  return `<section class="dvqr-timeline-card dvqr-timeline-findings-summary" aria-label="Timeline Findings Summary">
    <div class="dvqr-timeline-section-heading">
      <h2>Timeline Findings Summary</h2>
      <p>${escapeHtml(findings.summary)} Summary bullets link to the supporting evidence below.</p>
    </div>
    ${changed}
    ${noChange}
  </section>`;
}

function renderFindingSummaryItem(item: TimelineFindingsSummaryItem): string {
  const href = item.anchorId ? `#${escapeHtml(item.anchorId)}` : "#dvqr-timeline-top";
  const counts = item.eventCount > 0
    ? ` (${item.eventCount} finding${item.eventCount === 1 ? "" : "s"}${item.highCount > 0 ? `, ${item.highCount} high` : ""}${item.mediumCount > 0 ? `, ${item.mediumCount} medium` : ""}${item.lowCount > 0 ? `, ${item.lowCount} low` : ""})`
    : "";
  const observed = item.firstObservedBetween
    ? `<span class="dvqr-timeline-finding-observed">First observed between ${escapeHtml(formatCapturedAt(item.firstObservedBetween.fromCapturedAtIso))} → ${escapeHtml(formatCapturedAt(item.firstObservedBetween.toCapturedAtIso))}</span>`
    : "";

  return `<li class="dvqr-timeline-finding-summary-item dvqr-timeline-finding-${escapeHtml(item.kind.toLowerCase())}">
    <a href="${href}">${escapeHtml(item.title)}${escapeHtml(counts)}</a>
    <span>${escapeHtml(item.summary)}</span>
    ${observed}
  </li>`;
}

function renderTopTimelineEvents(events: readonly TimelineEvent[]): string {
  if (events.length === 0) {
    return `<section class="dvqr-timeline-card dvqr-timeline-empty">
      <h2>Top Timeline Events</h2>
      <p>No top timeline events were identified from the selected snapshot sequence.</p>
    </section>`;
  }

  return `<section class="dvqr-timeline-card" aria-label="Top Timeline Events">
    <div class="dvqr-timeline-section-heading">
      <h2>Top Timeline Events</h2>
      <p>Highest-signal changes first observed across the selected snapshot sequence.</p>
    </div>
    <div class="dvqr-timeline-event-list">
      ${events.map((event, index) => renderTimelineEvent(event, `top-${index}`, true)).join("")}
    </div>
  </section>`;
}

function renderTimelineIntervals(intervals: readonly TimelineInterval[], noChangesObserved: boolean): string {
  if (noChangesObserved) {
    return `<section class="dvqr-timeline-card dvqr-timeline-empty-success">
      <h2>Full Operational Timeline</h2>
      <p>No changes observed across the selected snapshots and intervals.</p>
    </section>`;
  }

  return `<section class="dvqr-timeline-card" aria-label="Full Operational Timeline">
    <div class="dvqr-timeline-section-heading">
      <h2>Full Operational Timeline</h2>
      <p>Changes are grouped by snapshot interval and reported as first observed between captures.</p>
    </div>
    ${renderTimelineIntervalIndex(intervals)}
    <div class="dvqr-timeline-interval-list">
      ${intervals.map(renderTimelineInterval).join("")}
    </div>
  </section>`;
}

function renderTimelineIntervalIndex(intervals: readonly TimelineInterval[]): string {
  if (intervals.length === 0) {
    return "";
  }

  return `<nav id="dvqr-timeline-interval-index" class="dvqr-timeline-interval-index" aria-label="Timeline interval index">
    <h3>Timeline Intervals</h3>
    <ol>
      ${intervals.map((interval) => `<li><a href="#${escapeHtml(interval.id)}">Interval ${interval.index + 1}: ${escapeHtml(formatCapturedAt(interval.fromCapturedAtIso))} → ${escapeHtml(formatCapturedAt(interval.toCapturedAtIso))} (${interval.events.length} event${interval.events.length === 1 ? "" : "s"})</a></li>`).join("")}
    </ol>
  </nav>`;
}

function renderTimelineInterval(interval: TimelineInterval): string {
  const providerSummary = interval.providerSummaries.length > 0
    ? interval.providerSummaries.map((provider) => `<span>${escapeHtml(provider.title)} · ${provider.eventCount}</span>`).join("")
    : `<span>No provider changes observed</span>`;

  return `<article class="dvqr-timeline-interval" id="${escapeHtml(interval.id)}">
    <div class="dvqr-timeline-interval-header">
      <div>
        <span class="dvqr-timeline-label">Interval ${interval.index + 1}</span>
        <h3>${escapeHtml(interval.label)}</h3>
      </div>
      <strong>${interval.events.length} event${interval.events.length === 1 ? "" : "s"}</strong>
    </div>
    <p class="dvqr-muted">${escapeHtml(formatCapturedAt(interval.fromCapturedAtIso))} → ${escapeHtml(formatCapturedAt(interval.toCapturedAtIso))}</p>
    <div class="dvqr-timeline-provider-summary">${providerSummary}</div>
    ${interval.events.length > 0 ? `<div class="dvqr-timeline-event-list">${interval.events.map((event, index) => renderTimelineEvent(event, `interval-${interval.index}-${index}`, false)).join("")}</div>` : `<p class="dvqr-muted">No changes first observed in this interval.</p>`}
  </article>`;
}


function renderTimelineDvafExportAction(event: TimelineEvent, instanceKey: string): string {
  const candidate = event.sourceDifference?.reconstructionCandidate;
  if (event.sourceDifference?.reconstructionCandidateKind === "dvaf-attribute" && candidate) {
    const exportId = `${event.id}::dvaf::${instanceKey}`;
    const candidateJson = JSON.stringify(candidate);
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" data-timeline-dvaf-export="${escapeHtml(exportId)}" data-timeline-dvaf-candidate="${escapeHtml(candidateJson)}" data-timeline-event-id="${escapeHtml(event.id)}" title="Export this event's source-side attribute definition as a DVAF reconstruction artifact. DVAF owns preview/apply.">
        Export DVAF artifact ›
      </button>
      <span class="dvqr-timeline-dvaf-result" data-timeline-dvaf-result="${escapeHtml(exportId)}" hidden></span>
    </div>`;
  }

  if (event.sourceDifference?.reconstructionCandidateKind === "dvaf-attribute-unavailable") {
    const reason = event.sourceDifference.reconstructionCandidateUnavailableReason
      ?? "DVAF export is unavailable for this timeline attribute event.";
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" disabled title="${escapeHtml(reason)}">
        Export DVAF unavailable
      </button>
      <span class="dvqr-timeline-dvaf-result is-visible">${escapeHtml(reason)}</span>
    </div>`;
  }

  if (event.sourceDifference?.reconstructionCandidateKind === "dvim-identity-participation" && candidate) {
    const exportId = `${event.id}::dvim::${instanceKey}`;
    const candidateJson = JSON.stringify(candidate);
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" data-timeline-dvim-export="${escapeHtml(exportId)}" data-timeline-dvim-candidate="${escapeHtml(candidateJson)}" data-timeline-event-id="${escapeHtml(event.id)}" title="Export this event's source-side identity participation intent as a DVIM reconstruction artifact. DVIM owns stage/validate/preview/apply.">
        Export DVIM artifact ›
      </button>
      <span class="dvqr-timeline-dvaf-result" data-timeline-dvim-result="${escapeHtml(exportId)}" hidden></span>
    </div>`;
  }

  if (event.sourceDifference?.reconstructionCandidateKind === "dvim-identity-participation-unavailable") {
    const reason = event.sourceDifference.reconstructionCandidateUnavailableReason
      ?? "DVIM export is unavailable for this timeline identity participation event.";
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" disabled title="${escapeHtml(reason)}">
        Export DVIM unavailable
      </button>
      <span class="dvqr-timeline-dvaf-result is-visible">${escapeHtml(reason)}</span>
    </div>`;
  }

  if (event.sourceDifference?.reconstructionCandidateKind === "dvce-choice-definition" && candidate) {
    const exportId = `${event.id}::dvce::${instanceKey}`;
    const candidateJson = JSON.stringify(candidate);
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" data-timeline-dvce-export="${escapeHtml(exportId)}" data-timeline-dvce-candidate="${escapeHtml(candidateJson)}" data-timeline-event-id="${escapeHtml(event.id)}" title="Export this event's source-side choice reconstruction intent as a DVCE .dvce.json artifact. DVCE owns stage/validate/preview/apply/publish.">
        Export DVCE artifact ›
      </button>
      <span class="dvqr-timeline-dvaf-result" data-timeline-dvce-result="${escapeHtml(exportId)}" hidden></span>
    </div>`;
  }

  if (event.sourceDifference?.reconstructionCandidateKind === "dvce-choice-definition-unavailable") {
    const reason = event.sourceDifference.reconstructionCandidateUnavailableReason
      ?? "DVCE export is unavailable for this timeline choice metadata event.";
    return `<div class="dvqr-timeline-audit-actions dvqr-timeline-dvaf-actions">
      <button type="button" class="dvqr-timeline-audit-button dvqr-timeline-dvaf-button" disabled title="${escapeHtml(reason)}">
        Export DVCE unavailable
      </button>
      <span class="dvqr-timeline-dvaf-result is-visible">${escapeHtml(reason)}</span>
    </div>`;
  }

  return "";
}

function renderTimelineEvent(event: TimelineEvent, instanceKey: string, ownsAnchor: boolean): string {
  const auditKey = `${event.id}::${instanceKey}`;
  const articleId = ownsAnchor ? event.id : `${event.id}-${instanceKey}`;
  return `<article id="${escapeHtml(articleId)}" class="dvqr-timeline-event dvqr-timeline-event-${escapeHtml(event.significance.toLowerCase())}" data-provider-id="${escapeHtml(event.providerId)}" data-timeline-event-id="${escapeHtml(event.id)}">
    <div class="dvqr-timeline-event-header">
      <span class="dvqr-timeline-significance">${escapeHtml(event.significance)}</span>
      <span class="dvqr-timeline-provider">${escapeHtml(event.providerTitle)}</span>
    </div>
    <h3>${escapeHtml(event.title)}</h3>
    <p>${escapeHtml(event.summary)}</p>
    <div class="dvqr-timeline-observed-between">
      <span>First observed between</span>
      <strong>${escapeHtml(formatCapturedAt(event.firstObservedBetween.fromCapturedAtIso))} → ${escapeHtml(formatCapturedAt(event.firstObservedBetween.toCapturedAtIso))}</strong>
    </div>
    ${renderEvidenceRefs(event)}
    ${renderTimelineDvafExportAction(event, instanceKey)}
    ${renderTimelineAuditAction(event, auditKey)}
  </article>`;
}

function renderTimelineAuditAction(event: TimelineEvent, auditKey: string): string {
  return `<div class="dvqr-timeline-audit-actions">
    <button type="button" class="dvqr-timeline-audit-button" data-timeline-audit-check="${escapeHtml(auditKey)}" data-timeline-event-id="${escapeHtml(event.id)}" data-event-title="${escapeHtml(event.title)}" data-event-summary="${escapeHtml(event.summary)}" data-provider-id="${escapeHtml(event.providerId)}" data-provider-title="${escapeHtml(event.providerTitle)}" data-entity-logical-name="${escapeHtml(event.sourceDifference?.evidence.find((item) => item.label.toLowerCase().includes("entity logical name"))?.value ?? "")}" data-from-captured-at="${escapeHtml(event.firstObservedBetween.fromCapturedAtIso)}" data-to-captured-at="${escapeHtml(event.firstObservedBetween.toCapturedAtIso)}" aria-expanded="false">
      Check audit evidence ›
    </button>
  </div>
  <div class="dvqr-timeline-audit-context" data-timeline-audit-context="${escapeHtml(auditKey)}" hidden>
    <strong>Audit evidence</strong>
    <p class="dvqr-muted">Audit lookup is explicit and interval-bounded. Audit evidence enriches this timeline event; it does not establish root cause.</p>
    <div data-timeline-audit-result="${escapeHtml(auditKey)}">Not queried yet.</div>
  </div>`;
}

function renderEvidenceRefs(event: TimelineEvent): string {
  if (event.evidenceRefs.length === 0) {
    return "";
  }

  return `<details class="dvqr-timeline-evidence">
    <summary>Evidence references (${event.evidenceRefs.length})</summary>
    <ul>
      ${event.evidenceRefs.map((evidence) => `<li><strong>${escapeHtml(evidence.label)}</strong>${evidence.summary ? ` — ${escapeHtml(evidence.summary)}` : ""}</li>`).join("")}
    </ul>
  </details>`;
}

function getStatusClass(status: TimelineReconstruction["status"]): string {
  return status === "Ready" ? "is-ready" : status === "InspectOnly" ? "is-inspect-only" : "is-blocked";
}


export function getTimelineSurfaceScript(): string {
  return `(() => {
    const vscode = acquireVsCodeApi();
    document.addEventListener('click', (event) => {
      const target = event.target instanceof Element ? event.target.closest('[data-timeline-export-kind]') : null;
      const dvafTarget = event.target instanceof Element ? event.target.closest('[data-timeline-dvaf-export]') : null;
      const auditTarget = event.target instanceof Element ? event.target.closest('[data-timeline-audit-check]') : null;
      const dvimTarget = event.target instanceof Element ? event.target.closest('[data-timeline-dvim-export]') : null;
      const dvceTarget = event.target instanceof Element ? event.target.closest('[data-timeline-dvce-export]') : null;
      if (dvafTarget) {
        event.preventDefault();
        const exportId = dvafTarget.getAttribute('data-timeline-dvaf-export') || '';
        const result = document.querySelector('[data-timeline-dvaf-result="' + exportId + '"]') || document.querySelector('[data-timeline-dvim-result="' + exportId + '"]') || document.querySelector('[data-timeline-dvce-result="' + exportId + '"]');
        if (result) {
          result.removeAttribute('hidden');
          result.classList.remove('is-error');
          result.classList.remove('is-success');
          result.textContent = 'Exporting source-side attribute definition to DVAF...';
        }
        vscode.postMessage({
          type: 'timelineDvafExportRequested',
          exportId,
          eventId: dvafTarget.getAttribute('data-timeline-event-id') || '',
          candidateJson: dvafTarget.getAttribute('data-timeline-dvaf-candidate') || ''
        });
        return;
      }
      if (dvimTarget) {
        event.preventDefault();
        const exportId = dvimTarget.getAttribute('data-timeline-dvim-export') || '';
        const result = document.querySelector('[data-timeline-dvim-result="' + exportId + '"]');
        if (result) {
          result.removeAttribute('hidden');
          result.classList.remove('is-error');
          result.classList.remove('is-success');
          result.textContent = 'Exporting source-side identity participation intent to DVIM...';
        }
        vscode.postMessage({
          type: 'timelineDvimExportRequested',
          exportId,
          eventId: dvimTarget.getAttribute('data-timeline-event-id') || '',
          candidateJson: dvimTarget.getAttribute('data-timeline-dvim-candidate') || ''
        });
        return;
      }
      if (dvceTarget) {
        event.preventDefault();
        const exportId = dvceTarget.getAttribute('data-timeline-dvce-export') || '';
        const result = document.querySelector('[data-timeline-dvce-result="' + exportId + '"]');
        if (result) {
          result.removeAttribute('hidden');
          result.classList.remove('is-error');
          result.classList.remove('is-success');
          result.textContent = 'Exporting source-side choice reconstruction intent to DVCE...';
        }
        vscode.postMessage({
          type: 'timelineDvceExportRequested',
          exportId,
          eventId: dvceTarget.getAttribute('data-timeline-event-id') || '',
          candidateJson: dvceTarget.getAttribute('data-timeline-dvce-candidate') || ''
        });
        return;
      }
      if (auditTarget) {
        event.preventDefault();
        const auditKey = auditTarget.getAttribute('data-timeline-audit-check') || '';
        const eventId = auditTarget.getAttribute('data-timeline-event-id') || auditKey;
        const context = document.querySelector('[data-timeline-audit-context="' + auditKey + '"]');
        const result = document.querySelector('[data-timeline-audit-result="' + auditKey + '"]');
        const isHidden = context?.hasAttribute('hidden');
        context?.toggleAttribute('hidden', !isHidden);
        auditTarget.classList.toggle('is-active', Boolean(isHidden));
        auditTarget.setAttribute('aria-expanded', isHidden ? 'true' : 'false');
        auditTarget.textContent = isHidden ? 'Hide audit evidence ↑' : 'Check audit evidence ›';
        if (isHidden && result?.textContent === 'Not queried yet.') {
          result.textContent = 'Checking audit evidence inside this snapshot-bounded interval...';
          vscode.postMessage({
            type: 'timelineAuditEvidenceRequested',
            eventId,
            auditKey,
            title: auditTarget.getAttribute('data-event-title') || '',
            summary: auditTarget.getAttribute('data-event-summary') || '',
            providerId: auditTarget.getAttribute('data-provider-id') || '',
            providerTitle: auditTarget.getAttribute('data-provider-title') || '',
            entityLogicalName: auditTarget.getAttribute('data-entity-logical-name') || '',
            fromCapturedAtIso: auditTarget.getAttribute('data-from-captured-at') || '',
            toCapturedAtIso: auditTarget.getAttribute('data-to-captured-at') || ''
          });
        }
        return;
      }

      if (!target) {
        return;
      }
      const kind = target.getAttribute('data-timeline-export-kind');
      if (!kind) {
        return;
      }
      event.preventDefault();
      vscode.postMessage({ type: 'saveTimelineReport', kind });
    });

    window.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.type !== 'timelineDvafExportResult' && message.type !== 'timelineDvimExportResult' && message.type !== 'timelineDvceExportResult') {
        return;
      }
      const exportId = message.exportId || '';
      const result = document.querySelector('[data-timeline-dvaf-result="' + exportId + '"]') || document.querySelector('[data-timeline-dvim-result="' + exportId + '"]') || document.querySelector('[data-timeline-dvce-result="' + exportId + '"]');
      if (!result) {
        return;
      }
      result.removeAttribute('hidden');
      result.classList.toggle('is-error', message.ok !== true);
      result.classList.toggle('is-success', message.ok === true);
      result.textContent = message.summary || (message.ok ? 'Reconstruction artifact exported.' : 'Export did not complete.');
    });

    window.addEventListener('message', (event) => {
      const message = event.data || {};
      if (message.type !== 'timelineAuditEvidenceResult') {
        return;
      }
      const auditKey = message.auditKey || message.eventId || '';
      const result = document.querySelector('[data-timeline-audit-result="' + auditKey + '"]');
      if (result) {
        result.innerHTML = message.html || '<p>Audit evidence result was returned without renderable content.</p>';
      }
    });
  })();`;
}
