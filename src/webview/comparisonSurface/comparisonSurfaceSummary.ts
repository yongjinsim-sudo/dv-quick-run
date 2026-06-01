import type { ComparisonSnapshotTrustStatus, ComparisonViewModel } from "../../core/comparison/index.js";
import { escapeHtml, formatCapturedAt, significanceRank } from "./comparisonSurfacePrimitives.js";

function getPrimaryDriftDomain(model: ComparisonViewModel): string {
  const group = [...model.groups].sort((left, right) => {
    const rank = significanceRank(right.significance) - significanceRank(left.significance);
    if (rank !== 0) {
      return rank;
    }

    return right.differences.length - left.differences.length;
  })[0];

  return group?.title ?? "None observed";
}

function getComparisonScope(model: ComparisonViewModel): string {
  return model.summary.subjectLabel?.trim() || getPrimaryDriftDomain(model);
}

function getComparedSubject(model: ComparisonViewModel): string {
  const cleanSubjectLabel = (value: string): string => {
    const label = value.split("·").pop()?.trim() ?? value;
    return label.replace(/\s+(source|target)$/i, "").trim();
  };

  return `${cleanSubjectLabel(model.summary.sourceLabel)} → ${cleanSubjectLabel(model.summary.targetLabel)}`;
}

function getComparisonDensityLevel(model: ComparisonViewModel): "quiet" | "focused" | "dense" | "very-dense" {
  if (model.summary.differenceCount >= 75 || model.groups.some((group) => group.differences.length >= 50)) {
    return "very-dense";
  }

  if (model.summary.differenceCount >= 40 || model.groups.some((group) => group.differences.length >= 30)) {
    return "dense";
  }

  if (model.summary.differenceCount >= 8) {
    return "focused";
  }

  return "quiet";
}

export function renderComparisonPostureNote(model: ComparisonViewModel): string {
  const density = getComparisonDensityLevel(model);
  if (density === "quiet") {
    return `<div class="dvqr-investigation-posture dvqr-investigation-posture-quiet">
      <strong>Quiet comparison surface</strong>
      <span>Few operational drift signals were observed. Review the available evidence, but avoid inferring parity beyond the selected providers and snapshots.</span>
    </div>`;
  }

  if (density === "very-dense") {
    return `<div class="dvqr-investigation-posture dvqr-investigation-posture-dense">
      <strong>Very dense grouped operational surface</strong>
      <span>${model.summary.differenceCount} drift signals across ${model.summary.providerCount} provider${model.summary.providerCount === 1 ? "" : "s"}. DVQR groups lower-priority platform and matching details so the comparison remains investigable rather than becoming a raw diff wall.</span>
    </div>`;
  }

  if (density === "dense") {
    return `<div class="dvqr-investigation-posture dvqr-investigation-posture-dense">
      <strong>Grouped operational surface</strong>
      <span>${model.summary.differenceCount} drift signals were observed. Start with top signals and provider summaries; lower-priority platform and matching details are grouped for readability.</span>
    </div>`;
  }

  return `<div class="dvqr-investigation-posture">
    <strong>Focused operational surface</strong>
    <span>Multiple drift signals were observed. Use grouped provider sections to preserve operational context before drilling into individual evidence.</span>
  </div>`;
}

export function renderSummary(model: ComparisonViewModel): string {
  const items = [
    { label: "High significance", value: String(model.summary.highCount) },
    { label: "Medium significance", value: String(model.summary.mediumCount) },
    { label: "Low significance", value: String(model.summary.lowCount) },
    { label: "Differences", value: String(model.summary.differenceCount) },
    { label: "Providers", value: String(model.summary.providerCount) },
    { label: "Comparison scope", value: getComparisonScope(model) },
    { label: "Comparison", value: getComparedSubject(model) }
  ];

  return `<div class="dvqr-summary-grid">${items.map((item) => {
    const textClass = item.label === "Comparison scope" || item.label === "Comparison" ? " is-text" : "";
    return `<div class="dvqr-summary-item${textClass}"><span class="dvqr-summary-value">${escapeHtml(item.value)}</span><span class="dvqr-summary-label">${escapeHtml(item.label)}</span></div>`;
  }).join("")}</div>`;
}



function formatSnapshotLineage(origin: string | undefined, createdAtIso: string | undefined): string | undefined {
  if (!origin) {
    return undefined;
  }

  const label = origin === "captured"
    ? "Captured lineage"
    : origin === "derivedComparison"
      ? "Derived comparison lineage"
      : origin === "imported"
        ? "Imported lineage"
        : "Legacy lineage";
  const createdAt = createdAtIso ? formatCapturedAt(createdAtIso) : undefined;
  return createdAt ? `${label}: ${createdAt}` : label;
}

export function renderComparisonSessionMetadata(model: ComparisonViewModel): string {
  const session = model.session;
  if (!session) {
    return "";
  }

  const sourceTrust = session.sourceSnapshot.trustState ? describeSnapshotTrustState(session.sourceSnapshot.trustState).label : "Not available";
  const targetTrust = session.targetSnapshot.trustState ? describeSnapshotTrustState(session.targetSnapshot.trustState).label : "Not available";
  const sourceLineage = formatSnapshotLineage(session.sourceSnapshot.lineageOrigin, session.sourceSnapshot.lineageCreatedAtIso);
  const targetLineage = formatSnapshotLineage(session.targetSnapshot.lineageOrigin, session.targetSnapshot.lineageCreatedAtIso);
  const scopeNote = session.unalignedSubjects
    ? `<p class="dvqr-session-warning">Unaligned comparison scope: source and target snapshots represent different operational subjects.</p>`
    : "";

  return `<section class="dvqr-session-card" aria-label="Comparison session metadata">
    <div class="dvqr-session-title">Comparison session</div>
    <p class="dvqr-session-summary">Generated ${escapeHtml(formatCapturedAt(session.generatedAtIso))}. Snapshot evidence remains local investigation context, not deployment authority.</p>
    ${scopeNote}
    <div class="dvqr-session-grid">
      <div class="dvqr-session-item">
        <span class="dvqr-value-label">Source snapshot</span>
        <strong>${escapeHtml(session.sourceSnapshot.label)}</strong>
        <span>${escapeHtml(formatCapturedAt(session.sourceSnapshot.capturedAtIso))} · ${escapeHtml(sourceTrust)}${sourceLineage ? ` · ${escapeHtml(sourceLineage)}` : ""}</span>
      </div>
      <div class="dvqr-session-item">
        <span class="dvqr-value-label">Target snapshot</span>
        <strong>${escapeHtml(session.targetSnapshot.label)}</strong>
        <span>${escapeHtml(formatCapturedAt(session.targetSnapshot.capturedAtIso))} · ${escapeHtml(targetTrust)}${targetLineage ? ` · ${escapeHtml(targetLineage)}` : ""}</span>
      </div>
    </div>
  </section>`;
}

export function renderEnvironmentPanel(model: ComparisonViewModel): string {
  const sourceTrust = model.snapshotTrust?.sourceTrustState;
  const targetTrust = model.snapshotTrust?.targetTrustState;

  return `<aside class="dvqr-environment-card" aria-label="Comparison environments">
    <div class="dvqr-environment-title">Environments</div>
    <div class="dvqr-environment-grid">
      <div class="dvqr-environment-item">
        <span class="dvqr-value-label">Source</span>
        <strong class="dvqr-environment-name"><span>${escapeHtml(model.summary.sourceLabel)}</span>${renderInlineSnapshotTrustIcon(sourceTrust)}</strong>
        <span>${escapeHtml(formatCapturedAt(model.summary.sourceCapturedAtIso))}</span>
      </div>
      <div class="dvqr-environment-item">
        <span class="dvqr-value-label">Target</span>
        <strong class="dvqr-environment-name"><span>${escapeHtml(model.summary.targetLabel)}</span>${renderInlineSnapshotTrustIcon(targetTrust)}</strong>
        <span>${escapeHtml(formatCapturedAt(model.summary.targetCapturedAtIso))}</span>
      </div>
    </div>
  </aside>`;
}

function getSnapshotTrustRank(value: ComparisonSnapshotTrustStatus | undefined): number {
  switch (value) {
    case "Invalid":
      return 4;
    case "Modified":
      return 3;
    case "Legacy / Unverified":
      return 2;
    case "Verified":
      return 0;
    default:
      return 1;
  }
}

function getOverallSnapshotTrustStatus(model: ComparisonViewModel): ComparisonSnapshotTrustStatus | undefined {
  const states = [model.snapshotTrust?.sourceTrustState, model.snapshotTrust?.targetTrustState];
  return states.sort((left, right) => getSnapshotTrustRank(right) - getSnapshotTrustRank(left))[0];
}

function renderInlineSnapshotTrustIcon(state: ComparisonSnapshotTrustStatus | undefined): string {
  const trust = describeSnapshotTrustState(state);
  return `<span class="dvqr-inline-trust-icon dvqr-inline-trust-${escapeHtml(trust.kind)}" title="${escapeHtml(trust.label)} snapshot trust — ${escapeHtml(trust.detail)}" aria-label="${escapeHtml(trust.label)} snapshot trust">${escapeHtml(trust.icon)}</span>`;
}

export function renderSnapshotTrustBanner(model: ComparisonViewModel): string {
  const overallTrust = getOverallSnapshotTrustStatus(model);
  if (!overallTrust || overallTrust === "Verified") {
    return "";
  }

  const trust = describeSnapshotTrustState(overallTrust);
  const message = overallTrust === "Modified"
    ? "One or more snapshots appear to have changed after capture. DVQR keeps the comparison inspectable, but treat drift evidence as trust-limited until the snapshot is reviewed."
    : overallTrust === "Legacy / Unverified"
      ? "One or more snapshots were captured before DVQR integrity metadata was available. DVQR keeps the comparison inspectable, but replay trust is limited."
      : "One or more snapshots have invalid integrity metadata. Use this comparison for inspection only until trusted snapshot evidence is available.";

  return `<div class="dvqr-snapshot-trust-banner dvqr-snapshot-trust-banner-${escapeHtml(trust.kind)}" role="note">
    <strong>${escapeHtml(trust.label)} snapshot evidence</strong>
    <span>${escapeHtml(message)}</span>
  </div>`;
}

function describeSnapshotTrustState(value: ComparisonSnapshotTrustStatus | undefined): { readonly label: string; readonly detail: string; readonly kind: string; readonly icon: string } {
  switch (value) {
    case "Verified":
      return {
        label: "Verified",
        detail: "Snapshot content matches its DVQR integrity hash.",
        kind: "verified",
        icon: "✓"
      };
    case "Modified":
      return {
        label: "Modified",
        detail: "Snapshot content no longer matches its DVQR integrity hash. Treat comparison output as untrusted evidence until reviewed.",
        kind: "modified",
        icon: "◉"
      };
    case "Legacy / Unverified":
      return {
        label: "Legacy / Unverified",
        detail: "Snapshot was captured before integrity hashes were available. It remains inspectable, but cannot be verified.",
        kind: "legacy",
        icon: "◌"
      };
    case "Invalid":
      return {
        label: "Invalid",
        detail: "Snapshot integrity metadata is invalid. Comparison should be used for inspection only.",
        kind: "invalid",
        icon: "⚠"
      };
    default:
      return {
        label: "Not available",
        detail: "Snapshot trust metadata was not supplied for this comparison.",
        kind: "unknown",
        icon: "?"
      };
  }
}

