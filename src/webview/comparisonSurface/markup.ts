import type { ComparisonDifference, ComparisonDriftGroup, ComparisonOperationalSignificance, ComparisonSnapshotTrustStatus, ComparisonViewModel } from "../../core/comparison/index.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "group";
}

interface ComparisonSurfaceRenderOptions {
  readonly canExport?: boolean;
  readonly isProPreview?: boolean;
}

function renderToolbar(options: ComparisonSurfaceRenderOptions = {}): string {
  const locked = options.canExport === false;
  const suffix = locked ? " 🔒" : "";
  return `<div class="dvqr-toolbar" role="toolbar" aria-label="Comparison export actions">
    <button type="button" class="dvqr-action-button" data-export-kind="json">Save JSON${suffix}</button>
    <button type="button" class="dvqr-action-button" data-export-kind="md">Save MD${suffix}</button>
    <button type="button" class="dvqr-action-button" data-export-kind="html">Save HTML${suffix}</button>
  </div>`;
}

function formatCapturedAt(value: string | undefined): string {
  if (!value) {
    return "Not captured";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
}

function significanceRank(value: ComparisonOperationalSignificance): number {
  return value === "High" ? 3 : value === "Medium" ? 2 : 1;
}

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

function renderSummary(model: ComparisonViewModel): string {
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


function renderComparisonSessionMetadata(model: ComparisonViewModel): string {
  const session = model.session;
  if (!session) {
    return "";
  }

  const sourceTrust = session.sourceSnapshot.trustState ? describeSnapshotTrustState(session.sourceSnapshot.trustState).label : "Not available";
  const targetTrust = session.targetSnapshot.trustState ? describeSnapshotTrustState(session.targetSnapshot.trustState).label : "Not available";
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
        <span>${escapeHtml(formatCapturedAt(session.sourceSnapshot.capturedAtIso))} · ${escapeHtml(sourceTrust)}</span>
      </div>
      <div class="dvqr-session-item">
        <span class="dvqr-value-label">Target snapshot</span>
        <strong>${escapeHtml(session.targetSnapshot.label)}</strong>
        <span>${escapeHtml(formatCapturedAt(session.targetSnapshot.capturedAtIso))} · ${escapeHtml(targetTrust)}</span>
      </div>
    </div>
  </section>`;
}

function renderEnvironmentPanel(model: ComparisonViewModel): string {
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

function renderSnapshotTrustBanner(model: ComparisonViewModel): string {
  const overallTrust = getOverallSnapshotTrustStatus(model);
  if (!overallTrust || overallTrust === "Verified" || overallTrust === "Legacy / Unverified") {
    return "";
  }

  const trust = describeSnapshotTrustState(overallTrust);
  const message = overallTrust === "Modified"
    ? "One or more snapshots appear to have changed after capture. DVQR keeps the comparison inspectable, but treat drift evidence as trust-limited until the snapshot is reviewed."
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

function renderValues(difference: ComparisonDifference): string {
  if (!difference.sourceValue && !difference.targetValue) {
    return "";
  }

  return `<div class="dvqr-values">
    ${difference.sourceValue ? `<div class="dvqr-value-box"><span class="dvqr-value-label">Source</span>${escapeHtml(difference.sourceValue)}</div>` : ""}
    ${difference.targetValue ? `<div class="dvqr-value-box"><span class="dvqr-value-label">Target</span>${escapeHtml(difference.targetValue)}</div>` : ""}
  </div>`;
}

function getDifferenceIcon(difference: ComparisonDifference): string {
  switch (difference.kind) {
    case "Added":
    case "OnlyInTarget":
      return "→";
    case "Removed":
    case "OnlyInSource":
      return "←";
    case "DensityChanged":
      return "▦";
    case "Changed":
      return "⇄";
    default:
      return "•";
  }
}

function simplifyGroupSummary(group: ComparisonDriftGroup): string {
  if (group.id === "operational-profile-drift") {
    const match = group.summary.match(/for ([^.]+)\./);
    return match?.[1] ? `${match[1]} operational profile differs between snapshots.` : "Operational profile differs between snapshots.";
  }

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Plugin step registrations differ between snapshots.";
  }

  if (group.id === "solution-participation-drift") {
    return "Solution package participation differs between snapshots.";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Workflow and automation participation differs between snapshots.";
  }

  return group.summary;
}

function extractScoreBand(difference: ComparisonDifference, label: "Source score" | "Target score"): string | undefined {
  const evidence = difference.evidence.find((item) => item.label === label)?.value;
  const match = evidence?.match(/\(([^)]+)\)/);
  return match?.[1];
}

function describeDirection(source: string | undefined, target: string | undefined): string {
  if (!source || !target) {
    return "changed";
  }

  const sourceLower = source.toLowerCase();
  const targetLower = target.toLowerCase();
  if (sourceLower.includes("no evidence") && !targetLower.includes("no evidence")) {
    return "appeared";
  }

  if (!sourceLower.includes("no evidence") && targetLower.includes("no evidence")) {
    return "was no longer observed";
  }

  return "changed";
}


function describeBandMovement(sourceValue: string | undefined, targetValue: string | undefined): string {
  const rank = (value: string | undefined): number | undefined => {
    const normalized = (value ?? "").toLowerCase();
    if (normalized.includes("none") || normalized.includes("no evidence")) return 0;
    if (normalized.includes("low")) return 1;
    if (normalized.includes("moderate")) return 2;
    if (normalized.includes("high")) return 3;
    return undefined;
  };

  const source = rank(sourceValue);
  const target = rank(targetValue);
  if (source === undefined || target === undefined || source === target) {
    return "changed";
  }

  return target > source ? "increased" : "decreased";
}

function extractOnlyInName(title: string): string {
  const parts = title.split(":");
  return (parts.length > 1 ? parts.slice(1).join(":") : title)
    .replace(/\s+present only in (source|target)$/i, "")
    .replace(/\s+changed from .+$/i, "")
    .trim();
}

function isEnvironmentScopedPresenceTitle(title: string, targetLabel: string): boolean {
  const normalized = title.toLowerCase();
  const target = targetLabel.toLowerCase();
  return normalized.endsWith(` added in ${target}`) || normalized.endsWith(` removed in ${target}`);
}

function getDensitySubjectTitle(subject: string, sourceValue: string | undefined, targetValue: string | undefined): string {
  const direction = describeDirection(sourceValue, targetValue);

  if (subject === "DVQR Score density") {
    return "DVQR Score changed";
  }

  if (subject === "Automation (Plugin Steps)") {
    if (direction === "appeared") {
      return "Plugin Steps participation appeared";
    }

    if (direction === "was no longer observed") {
      return "Plugin Steps participation removed";
    }

    return sourceValue && targetValue
      ? `Plugin Steps count ${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})`
      : "Plugin Steps count changed";
  }

  if (subject === "Real-time Workflows") {
    if (direction === "appeared") {
      return "Real-time workflow participation appeared";
    }

    if (direction === "was no longer observed") {
      return "Real-time workflow participation removed";
    }

    return sourceValue && targetValue
      ? `Real-time workflow participation ${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})`
      : "Real-time workflow participation changed";
  }

  if (subject === "Relationships") {
    return direction === "appeared" ? "Relationship evidence appeared" : direction === "was no longer observed" ? "Relationship evidence removed" : `Relationship count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  if (subject === "Columns") {
    return direction === "appeared" ? "Column evidence appeared" : direction === "was no longer observed" ? "Column evidence removed" : `Column count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  return `${subject} ${direction}`;
}

function simplifyPluginDifferenceTitle(title: string, targetLabel: string): string | undefined {
  const modernState = title.match(/^(.+) plugin state changed \((.+)\)$/i);
  if (modernState?.[1] && modernState[2]) {
    return `${modernState[1].trim()} plugin state changed (${modernState[2].trim()})`;
  }

  const removed = title.match(/^(.+) removed from target$/i);
  if (removed?.[1]) {
    return `${removed[1].trim()} removed in ${targetLabel}`;
  }

  const added = title.match(/^(.+) added in target$/i);
  if (added?.[1]) {
    return `${added[1].trim()} added in ${targetLabel}`;
  }

  const patterns: readonly [RegExp, string][] = [
    [/^Plugin step state changed:\s*(.+)$/i, "$1 plugin state changed"],
    [/^Plugin step execution pipeline changed:\s*(.+)$/i, "$1 execution pipeline changed"],
    [/^Plugin step configuration changed:\s*(.+)$/i, "$1 configuration changed"],
    [/^Plugin step changed:\s*(.+)$/i, "$1 changed"],
    [/^Plugin step removed from target:\s*(.+)$/i, `$1 removed in ${targetLabel}`],
    [/^Plugin step added in target:\s*(.+)$/i, `$1 added in ${targetLabel}`]
  ];

  for (const [pattern, replacement] of patterns) {
    const match = title.match(pattern);
    if (match?.[1]) {
      return replacement.replace("$1", match[1].trim());
    }
  }

  return undefined;
}

function simplifyDifferenceTitle(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string
): string {
  const pluginTitle = simplifyPluginDifferenceTitle(difference.title, targetLabel);
  if (pluginTitle) {
    return pluginTitle;
  }

  if (difference.title.startsWith("DVQR Score density changed")) {
    const source = difference.sourceValue ?? "source";
    const target = difference.targetValue ?? "target";
    return `DVQR Score changed: ${source} → ${target}`;
  }

  if (difference.kind === "DensityChanged") {
    const subject = difference.title.split(" changed:")[0] || "Operational density";
    return getDensitySubjectTitle(subject, difference.sourceValue, difference.targetValue);
  }

  if (difference.kind === "OnlyInSource") {
    if (isEnvironmentScopedPresenceTitle(difference.title, targetLabel)) {
      return difference.title;
    }

    return `${extractOnlyInName(difference.title)} present only in ${sourceLabel}`;
  }

  if (difference.kind === "OnlyInTarget") {
    if (isEnvironmentScopedPresenceTitle(difference.title, targetLabel)) {
      return difference.title;
    }

    return `${extractOnlyInName(difference.title)} present only in ${targetLabel}`;
  }

  if (difference.kind === "Changed") {
    if (/ changed from .+ → .+$/i.test(difference.title)) {
      return difference.title;
    }

    const name = extractOnlyInName(difference.title);
    const managedState = difference.evidence.find((item) => item.label.toLowerCase().includes("managed state"));
    if (managedState?.value) {
      return `${name} changed from ${managedState.value}`;
    }

    const version = difference.evidence.find((item) => item.label.toLowerCase().includes("version"));
    if (version?.value) {
      if (difference.title.toLowerCase().includes("version changed")) {
        return /\([^)]*→[^)]*\)\s*$/u.test(difference.title) ? difference.title : `${difference.title} (${version.value})`;
      }

      return `${name} version changed (${version.value})`;
    }

    return `${name} changed`;
  }

  return difference.title;
}


function simplifyDifferenceSummary(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string
): string {
  if (difference.title.startsWith("DVQR Score density changed")) {
    const sourceBand = extractScoreBand(difference, "Source score");
    const targetBand = extractScoreBand(difference, "Target score");
    if (sourceBand && targetBand) {
      return `DVQR Score increased from ${sourceBand} to ${targetBand} density.`;
    }

    return `${difference.title}.`;
  }

  if (difference.kind === "DensityChanged") {
    const subject = difference.title.split(" changed:")[0] || "Operational density";
    return `${subject} ${describeDirection(difference.sourceValue, difference.targetValue)} between ${sourceLabel} and ${targetLabel}.`;
  }

  if (difference.kind === "OnlyInSource") {
    return `Only observed in ${sourceLabel}.`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `Only observed in ${targetLabel}.`;
  }

  if (difference.kind === "Changed") {
    if (difference.title.toLowerCase().includes("managed state")) {
      return `Managed state differs between ${sourceLabel} and ${targetLabel}.`;
    }

    if (difference.title.toLowerCase().includes("version")) {
      return `Version differs between ${sourceLabel} and ${targetLabel}.`;
    }

    return `Participation details differ between ${sourceLabel} and ${targetLabel}.`;
  }

  return difference.summary;
}

function getEvidenceStrengthLabel(difference: ComparisonDifference): string {
  if (difference.evidence.length >= 2) {
    return "Evidence-backed";
  }

  if (difference.evidence.length === 1) {
    return "Single evidence signal";
  }

  return "Summary signal";
}

function shouldExpandDifferenceByDefault(
  difference: ComparisonDifference,
  groupDifferences: readonly ComparisonDifference[],
  differenceIndex: number
): boolean {
  if (difference.significance !== "High") {
    return false;
  }

  if (groupDifferences.length >= 6) {
    const earlierHighCount = groupDifferences
      .slice(0, differenceIndex)
      .filter((item) => item.significance === "High")
      .length;
    return earlierHighCount < 2;
  }

  return true;
}

function getEvidenceContinuationLabel(item: ComparisonDifference["evidence"][number]): string {
  const label = item.label.toLowerCase();

  if (label.includes("solution")) {
    return "Query solution";
  }

  if (label.includes("automation") || label.includes("workflow") || label.includes("plugin")) {
    return "Query automation";
  }

  if (label.includes("role")) {
    return "Query role";
  }

  if (label.includes("team")) {
    return "Query team";
  }

  if (label.includes("identity") || label.includes("user")) {
    return "Query identity";
  }

  if (label.includes("score") || label.includes("signal") || label.includes("delta")) {
    return "Query evidence";
  }

  return "Query evidence";
}

function getEvidenceContinuationTooltip(item: ComparisonDifference["evidence"][number]): string {
  const label = item.label.toLowerCase();

  if (label.includes("plugin") || label.includes("automation") || label.includes("workflow")) {
    return "Available in DVQR Pro — view raw Dataverse automation evidence.";
  }

  if (label.includes("solution")) {
    return "Available in DVQR Pro — view raw Dataverse solution evidence.";
  }

  if (label.includes("identity") || label.includes("role") || label.includes("team")) {
    return "Available in DVQR Pro — view raw Dataverse identity participation evidence.";
  }

  return "Available in DVQR Pro — view raw Dataverse evidence.";
}

function renderEvidenceItem(item: ComparisonDifference["evidence"][number]): string {
  const value = item.value ? ` — ${escapeHtml(item.value)}` : "";
  const continuationLabel = getEvidenceContinuationLabel(item);
  const continuationTooltip = getEvidenceContinuationTooltip(item);

  return `<li>
    <span><strong>${escapeHtml(item.label)}</strong>${value}</span>
    <span class="dvqr-evidence-continuation-pill" title="${escapeHtml(continuationTooltip)}">
      ${escapeHtml(continuationLabel)} ›
    </span>
  </li>`;
}

function renderDifference(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string,
  groupDifferences: readonly ComparisonDifference[],
  differenceIndex: number
): string {
  const evidence = difference.evidence.length > 0
    ? `<details class="dvqr-evidence-details"><summary>Show full evidence <span>${difference.evidence.length}</span></summary><ul class="dvqr-evidence">${difference.evidence.map((item) => renderEvidenceItem(item)).join("")}</ul></details>`
    : "";

  const openAttribute = shouldExpandDifferenceByDefault(difference, groupDifferences, differenceIndex) ? " open" : "";

  return `<details class="dvqr-difference-card" data-difference-kind="${escapeHtml(difference.kind)}" data-significance="${escapeHtml(difference.significance)}"${openAttribute}>
    <summary class="dvqr-difference-heading">
      <span class="dvqr-difference-icon" aria-hidden="true">${escapeHtml(getDifferenceIcon(difference))}</span>
      <span class="dvqr-difference-title-block">
        <span class="dvqr-difference-title">${escapeHtml(simplifyDifferenceTitle(difference, sourceLabel, targetLabel))}</span>
        <span class="dvqr-difference-description">${escapeHtml(simplifyDifferenceSummary(difference, sourceLabel, targetLabel))}</span>
      </span>
      <span class="dvqr-difference-toggle" aria-hidden="true"></span>
    </summary>
    <div class="dvqr-difference-body">
      ${renderValues(difference)}
      <div class="dvqr-meta">
        <span class="dvqr-chip">${escapeHtml(difference.kind)}</span>
        <span class="dvqr-chip">${escapeHtml(difference.significance)} significance</span>
        <span class="dvqr-chip dvqr-chip-muted">${escapeHtml(getEvidenceStrengthLabel(difference))}</span>
      </div>
      ${evidence}
    </div>
  </details>`;
}

function getProviderInsight(group: ComparisonDriftGroup): string {
  const highCount = group.differences.filter((difference) => difference.significance === "High").length;
  const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
  const lowCount = group.differences.filter((difference) => difference.significance === "Low").length;
  const parts = [
    highCount > 0 ? `${highCount} high` : undefined,
    mediumCount > 0 ? `${mediumCount} medium` : undefined,
    lowCount > 0 ? `${lowCount} low` : undefined
  ].filter((part): part is string => Boolean(part));

  if (group.id === "operational-profile-drift") {
    return `${group.differences.length} operational density change${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  if (group.id === "solution-participation-drift") {
    return `${group.differences.length} solution package drift${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `${group.differences.length} orchestration participation drift${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
  }

  return `${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}${parts.length > 0 ? ` · ${parts.join(", ")}` : ""}`;
}

function getGroupNarrative(group: ComparisonDriftGroup, sourceLabel: string, targetLabel: string): string {
  const high = group.differences.filter((difference) => difference.significance === "High");
  const strongest = high.length > 0 ? high : group.differences.slice(0, 3);
  const highlights = strongest
    .slice(0, 3)
    .map((difference) => simplifyDifferenceTitle(difference, sourceLabel, targetLabel));

  if (group.id === "operational-profile-drift") {
    return buildNarrativeBlock(
      `Operational profile density shifted between ${sourceLabel} and ${targetLabel}. Review the strongest contributor changes before treating the environments as operationally equivalent.`,
      highlights
    );
  }

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return buildNarrativeBlock(
      `Plugin runtime behaviour differs between ${sourceLabel} and ${targetLabel}. Review changed step state, pipeline placement, and environment-specific registrations before comparing runtime outcomes.`,
      highlights
    );
  }

  if (group.id === "solution-participation-drift") {
    return buildNarrativeBlock(
      `Solution layering differs between ${sourceLabel} and ${targetLabel}. Review package presence, version, and managed-state drift as operational context, not deployment validation.`,
      highlights
    );
  }

  if (group.id === "identity-participation-drift") {
    return buildNarrativeBlock(
      `Identity participation differs between ${sourceLabel} and ${targetLabel}. Matching is confidence-based and should be treated as participation orientation, not authority certainty.`,
      highlights
    );
  }

  if (group.id === "workflow-automation-participation-drift") {
    return buildNarrativeBlock(
      `Workflow and flow participation differs between ${sourceLabel} and ${targetLabel}. Review added, removed, or changed orchestration before comparing environment behaviour.`,
      highlights
    );
  }

  return buildNarrativeBlock(`${group.title} contains ${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}.`, highlights);
}

function buildNarrativeBlock(summary: string, highlights: readonly string[]): string {
  if (!highlights.length) {
    return `<div class="dvqr-group-narrative"><p>${escapeHtml(summary)}</p></div>`;
  }

  return `<div class="dvqr-group-narrative"><p>${escapeHtml(summary)}</p><ul>${highlights.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul></div>`;
}

interface TopOperationalSignal {
  readonly groupTitle: string;
  readonly groupId: string;
  readonly title: string;
  readonly significance: ComparisonOperationalSignificance;
  readonly kind: string;
  readonly impact: string;
}

function getOperationalImpactSummary(difference: ComparisonDifference, sourceLabel: string, targetLabel: string): string {
  const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
  const normalizedTitle = title.toLowerCase();
  const normalizedKind = difference.kind.toLowerCase();

  if (normalizedTitle.includes("dvqr score")) {
    return "Operational density changed between snapshots.";
  }

  if (normalizedTitle.includes("plugin") && normalizedTitle.includes("state changed")) {
    return "Plugin execution availability differs between environments.";
  }

  if (normalizedTitle.includes("execution pipeline")) {
    return "Request-time plugin sequencing or stage placement differs.";
  }

  if (normalizedTitle.includes("added in") || normalizedKind.includes("added") || difference.kind === "OnlyInTarget") {
    return `Additional operational participation is visible in ${targetLabel}.`;
  }

  if (normalizedTitle.includes("removed in") || normalizedKind.includes("removed") || difference.kind === "OnlyInSource") {
    return `Operational participation is only visible in ${sourceLabel}.`;
  }

  if (normalizedTitle.includes("state changed")) {
    return "Activation or runtime participation state differs.";
  }

  if (normalizedTitle.includes("owner changed")) {
    return "Ownership metadata differs; treat this as context, not execution causality.";
  }

  if (normalizedTitle.includes("managed") || normalizedTitle.includes("version")) {
    return "Solution packaging evidence differs between snapshots.";
  }

  return "Review the underlying evidence before comparing runtime behaviour.";
}

function getTopOperationalSignals(model: ComparisonViewModel): readonly TopOperationalSignal[] {
  return model.groups
    .flatMap((group) => group.differences.map((difference) => ({
      groupTitle: shortGroupTitle(group.title),
      groupId: group.id,
      title: simplifyDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel),
      significance: difference.significance,
      kind: difference.kind,
      impact: getOperationalImpactSummary(difference, model.summary.sourceLabel, model.summary.targetLabel)
    })))
    .sort((left, right) => {
      const rank = significanceRank(right.significance) - significanceRank(left.significance);
      if (rank !== 0) {
        return rank;
      }

      return left.title.localeCompare(right.title);
    })
    .slice(0, 5);
}

function renderTopOperationalSignals(model: ComparisonViewModel): string {
  const signals = getTopOperationalSignals(model);
  if (signals.length === 0) {
    return "";
  }

  const items = signals.map((signal) => `<li data-significance="${escapeHtml(signal.significance)}">
    <a href="#${escapeHtml(slug(signal.groupId))}">
      <span class="dvqr-top-signal-title">${escapeHtml(signal.title)}</span>
      <span class="dvqr-top-signal-impact">${escapeHtml(signal.impact)}</span>
      <span class="dvqr-top-signal-meta">${escapeHtml(signal.groupTitle)} · ${escapeHtml(signal.significance)} · ${escapeHtml(signal.kind)}</span>
    </a>
  </li>`);

  const highSignals = model.groups.reduce((count, group) => count + group.differences.filter((difference) => difference.significance === "High").length, 0);
  const curationNote = highSignals > signals.length
    ? `<p class="dvqr-top-signal-note">Showing ${signals.length} of ${highSignals} high-significance drift signals.</p>`
    : "";

  return `<section class="dvqr-card dvqr-top-signals" aria-label="Top operational drift signals">
    <div class="dvqr-section-heading-row">
      <div>
        <h2>Top Operational Drift Signals</h2>
        <p class="dvqr-muted">Fast orientation across the strongest evidence-backed drift signals. These are investigation cues, not remediation instructions.</p>
        ${curationNote}
      </div>
    </div>
    <ol>${items.join("")}</ol>
  </section>`;
}

function renderGroupNavigation(model: ComparisonViewModel): string {
  if (model.groups.length <= 1) {
    return "";
  }

  const links = model.groups.map((group) => {
    const highCount = group.differences.filter((difference) => difference.significance === "High").length;
    const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
    const significanceLabel = highCount > 0
      ? `${highCount} high`
      : mediumCount > 0
        ? `${mediumCount} medium`
        : `${group.differences.length} low`;
    return `<a class="dvqr-group-nav-link" href="#${escapeHtml(slug(group.id))}">
      <span>${escapeHtml(shortGroupTitle(group.title))} <em>(${escapeHtml(significanceLabel)})</em></span>
      <strong>${group.differences.length}</strong>
    </a>`;
  });

  return `<nav class="dvqr-group-nav" aria-label="Provider group navigation">
    <span class="dvqr-group-nav-label">Jump to</span>
    ${links.join("")}
  </nav>`;
}

function renderGroup(
  group: ComparisonDriftGroup,
  sourceLabel: string,
  targetLabel: string
): string {
  return `<article class="dvqr-card dvqr-group-card" id="${escapeHtml(slug(group.id))}" data-group-id="${escapeHtml(group.id)}" data-significance="${escapeHtml(group.significance)}">
    <div class="dvqr-group-header">
      <div>
        <h2>${escapeHtml(group.title)}</h2>
        <p>${escapeHtml(simplifyGroupSummary(group))}</p>
      </div>
      <div class="dvqr-meta dvqr-group-meta">
        <span class="dvqr-chip">${escapeHtml(group.significance)} significance</span>
        <span class="dvqr-chip">${group.differences.length} difference${group.differences.length === 1 ? "" : "s"}</span>
        <span class="dvqr-chip dvqr-chip-muted">${escapeHtml(getProviderInsight(group))}</span>
      </div>
    </div>
    ${getGroupNarrative(group, sourceLabel, targetLabel)}
    <div class="dvqr-difference-list">${group.differences.map((difference, index) => renderDifference(difference, sourceLabel, targetLabel, group.differences, index)).join("")}</div>
    <a class="dvqr-back-top" href="#dvqr-comparison-top">Back to top ↑</a>
  </article>`;
}

function shortGroupTitle(title: string): string {
  return title
    .replace("Operational Profile Drift", "Operational Profile")
    .replace("Plugin Step Runtime Behaviour Drift", "Plugin Runtime")
    .replace("Solution Participation Drift", "Solution Participation")
    .replace("Workflow / Automation Participation Drift", "Workflow / Automation")
    .replace("Identity Participation Drift", "Identity Participation");
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

  return `<main id="dvqr-comparison-top" class="dvqr-comparison">
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
      ${renderSnapshotTrustBanner(model)}
      ${renderComparisonSessionMetadata(model)}
      <div class="dvqr-hero-detail-grid">
        <div>
          <p><strong>Source:</strong> ${escapeHtml(model.summary.sourceLabel)} · <strong>Target:</strong> ${escapeHtml(model.summary.targetLabel)}</p>
          ${renderSummary(model)}
        </div>
        ${renderEnvironmentPanel(model)}
      </div>
    </section>

    ${renderTopOperationalSignals(model)}

    <section>
      <h2>Operational Drift</h2>
      <p class="dvqr-section-note">Grouped, evidence-backed differences from comparison providers. These are investigation signals, not remediation instructions.</p>
      ${renderGroupNavigation(model)}
      ${renderGroupTabs(model)}
      <div class="dvqr-group-list">${model.groups.map((group) => renderGroup(group, model.summary.sourceLabel, model.summary.targetLabel)).join("")}</div>
      ${empty}
    </section>
    ${renderCommunityFooter()}
  </main>`;
}

function renderCommunityFooter(): string {
  return `<footer class="dvqr-community-footer">
    <span>Have feedback on drift providers or snapshot workflows?</span>
    <a href="https://github.com/yongjinsim-sudo/dv-quick-run/discussions">Join DVQR Discussions</a>
  </footer>`;
}
