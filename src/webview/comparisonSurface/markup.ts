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

function renderComparisonPostureNote(model: ComparisonViewModel): string {
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

function renderComparisonSessionMetadata(model: ComparisonViewModel): string {
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
    if (normalized.includes("none") || normalized.includes("no evidence")) {
      return 0;
    }

    if (normalized.includes("low")) {
      return 1;
    }

    if (normalized.includes("moderate")) {
      return 2;
    }

    if (normalized.includes("high")) {
      return 3;
    }
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
  const withKnownPrefixRemoved = title.replace(
    /^(plugin step|workflow|flow|identity|team participation|user participation|business unit participation|solution participation|operational profile)\s*:\s*/i,
    ""
  );

  return withKnownPrefixRemoved
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

function renderNearbyOperationalDrift(group: ComparisonDriftGroup): string {
  const nearby = group.nearbyOperationalDrift ?? [];
  if (!nearby.length) {
    return "";
  }

  const items = nearby.map((item) => {
    const evidence = item.evidence.length > 0
      ? `<ul>${item.evidence.map((evidence) => `<li><strong>${escapeHtml(evidence.label)}</strong>${evidence.value ? ` — ${escapeHtml(evidence.value)}` : ""}</li>`).join("")}</ul>`
      : "";

    return `<li>
      <a href="#${escapeHtml(slug(item.relatedGroupId))}">${escapeHtml(item.title)}</a>
      <span>${escapeHtml(item.summary)}</span>
      <em>${escapeHtml(item.significance)} · ${item.differenceCount} drift signal${item.differenceCount === 1 ? "" : "s"}</em>
      ${evidence}
    </li>`;
  });

  return `<details class="dvqr-nearby-drift">
    <summary>Other observed drift surfaces <span>${nearby.length}</span></summary>
    <p>Additional drift surfaces observed in this bounded comparison only. This does not imply chronology, causality, remediation, or root-cause certainty.</p>
    <ol>${items.join("")}</ol>
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



function getIdentitySubjectFromDifference(difference: ComparisonDifference): string | undefined {
  const subjectEvidence = difference.evidence.find((item) => item.label === "Identity subject")?.value?.toLowerCase();
  if (subjectEvidence?.includes("applicationuser") || subjectEvidence?.includes("application user")) {
    return "Application users";
  }
  if (subjectEvidence?.includes("businessunit") || subjectEvidence?.includes("business unit")) {
    return "Business units";
  }
  if (subjectEvidence?.includes("team")) {
    return "Teams";
  }
  if (subjectEvidence?.includes("role")) {
    return "Roles";
  }
  if (subjectEvidence?.includes("user")) {
    return "Users";
  }

  const title = difference.title.toLowerCase();
  if (title.includes("application user")) {
    return "Application users";
  }
  if (title.includes("business unit")) {
    return "Business units";
  }
  if (title.includes("team participation")) {
    return "Teams";
  }
  if (title.includes("role participation")) {
    return "Roles";
  }
  if (title.includes("user participation")) {
    return "Users";
  }

  return undefined;
}

function renderCountBreakdown(counts: ReadonlyMap<string, number>): string {
  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
    .map(([label, count]) => `${label}: ${count}`)
    .join(" · ");
}

function getIdentityTypeBreakdown(group: ComparisonDriftGroup): string | undefined {
  if (group.id !== "identity-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : undefined;
}

function getParticipationDensityHighlights(group: ComparisonDriftGroup): readonly string[] {
  if (group.id !== "identity-participation-drift") {
    return [];
  }

  return group.differences
    .flatMap((difference) => difference.evidence
      .filter((item) => item.label === "Participation density")
      .map((item) => `${simplifyDifferenceTitle(difference, "source", "target")} — ${item.value}`))
    .slice(0, 3);
}

function getSolutionClassification(difference: ComparisonDifference): string {
  const classification = difference.evidence.find((item) => item.label === "Solution classification")?.value;
  if (classification) {
    return classification.includes("→") ? "Mixed solution classification" : classification;
  }

  const value = `${difference.title} ${difference.sourceValue ?? ""} ${difference.targetValue ?? ""}`.toLowerCase();
  if (/\b(bkp|backup|archived?|archive)\b/u.test(value)) {
    return "Backup / archived solution";
  }
  if (/\b(patch|cumulative|hotfix)\b/u.test(value)) {
    return "Platform patch layer";
  }
  if (value.includes("msdyn") || value.includes("microsoftdynamics") || value.includes("powerpages") || value.includes("power pages") || value.includes("dynamics 365") || value.includes("system solution") || value.includes("default solution")) {
    return "Microsoft platform solution";
  }
  if (value.includes("syncagent") || value.includes("sync admin")) {
    return "Infrastructure solution";
  }

  return "Custom solution";
}

function getSolutionClassificationBreakdown(group: ComparisonDriftGroup): string | undefined {
  if (group.id !== "solution-participation-drift") {
    return undefined;
  }

  const counts = new Map<string, number>();
  for (const difference of group.differences) {
    const classification = getSolutionClassification(difference);
    counts.set(classification, (counts.get(classification) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : undefined;
}

function renderGroupErgonomicsSummary(group: ComparisonDriftGroup): string {
  const identityBreakdown = getIdentityTypeBreakdown(group);
  const densityHighlights = getParticipationDensityHighlights(group);
  const solutionBreakdown = getSolutionClassificationBreakdown(group);

  if (!identityBreakdown && densityHighlights.length === 0 && !solutionBreakdown) {
    return "";
  }

  const items = [
    identityBreakdown ? `<li><strong>Identity drift by type</strong> — ${escapeHtml(identityBreakdown)}</li>` : undefined,
    ...densityHighlights.map((item) => `<li><strong>Participation density</strong> — ${escapeHtml(item)}</li>`),
    solutionBreakdown ? `<li><strong>Solution classification</strong> — ${escapeHtml(solutionBreakdown)}</li>` : undefined
  ].filter((item): item is string => Boolean(item));

  return `<div class="dvqr-ergonomics-summary"><p>Density-first orientation keeps evidence visible while reducing scan noise.</p><ul>${items.join("")}</ul></div>`;
}

function getGroupDensityLevel(group: ComparisonDriftGroup): "normal" | "dense" | "very-dense" {
  if (group.differences.length >= 30) {
    return "very-dense";
  }

  if (group.differences.length >= 12) {
    return "dense";
  }

  return "normal";
}

function renderGroupDensityNote(group: ComparisonDriftGroup): string {
  const level = getGroupDensityLevel(group);
  if (level === "normal") {
    return "";
  }

  const mediumCount = group.differences.filter((difference) => difference.significance === "Medium").length;
  const lowCount = group.differences.filter((difference) => difference.significance === "Low").length;
  const highCount = group.differences.filter((difference) => difference.significance === "High").length;
  const countParts = [
    highCount > 0 ? `${highCount} high` : undefined,
    mediumCount > 0 ? `${mediumCount} medium` : undefined,
    lowCount > 0 ? `${lowCount} low` : undefined
  ].filter((part): part is string => Boolean(part));
  const label = level === "very-dense" ? "Large drift surface" : "Dense drift surface";

  return `<div class="dvqr-density-note">
    <strong>${escapeHtml(label)}</strong>
    <span>${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}${countParts.length > 0 ? ` · ${escapeHtml(countParts.join(", "))}` : ""}. Summary-first rendering is intentional; expand individual evidence only where it helps the investigation.</span>
  </div>`;
}

function getGroupNarrative(group: ComparisonDriftGroup, sourceLabel: string, targetLabel: string): string {
  const strongest = [...group.differences].sort((left, right) => {
    const priority = getSignalPriority(right) - getSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }
    const significance = significanceRank(right.significance) - significanceRank(left.significance);
    if (significance !== 0) {
      return significance;
    }
    return left.title.localeCompare(right.title);
  });
  const highlights = strongest
    .slice(0, 3)
    .map((difference) => getParticipationDensitySignalTitle(difference, sourceLabel, targetLabel) ?? simplifyDifferenceTitle(difference, sourceLabel, targetLabel));

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
  readonly priority: number;
}

function parseParticipationDensity(value: string | undefined): { readonly source: number; readonly target: number } | undefined {
  const match = value?.match(/(\d+)\s*→\s*(\d+)/u);
  if (!match?.[1] || !match[2]) {
    return undefined;
  }

  return { source: Number.parseInt(match[1], 10), target: Number.parseInt(match[2], 10) };
}

function getParticipationDensitySignalTitle(difference: ComparisonDifference, sourceLabel: string, targetLabel: string): string | undefined {
  const density = difference.evidence.find((item) => item.label === "Participation density")?.value;
  const parsed = parseParticipationDensity(density);
  if (!parsed) {
    return undefined;
  }

  const title = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
  const direction = parsed.target > parsed.source ? "expanded" : parsed.target < parsed.source ? "reduced" : "changed";
  return `${title} participation footprint ${direction}: ${parsed.source} → ${parsed.target}`;
}

function getSignalPriority(difference: ComparisonDifference): number {
  const hasDensity = difference.evidence.some((item) => item.label === "Participation density");
  if (hasDensity) {
    return 100;
  }

  const classification = difference.evidence.find((item) => item.label === "Solution classification")?.value;
  if (classification === "Custom solution" || classification === "Infrastructure solution") {
    return 80;
  }

  if (difference.kind === "Assignment Drift" || difference.kind === "Inheritance Drift") {
    return 70;
  }

  if (classification === "Backup / archived solution") {
    return 45;
  }

  if (classification === "Platform patch layer" || classification === "Microsoft platform solution") {
    return 20;
  }

  return 50;
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

function normalizeSignalKey(value: string): string {
  return value
    .toLowerCase()
    .replace(/[0-9a-f]{8}-[0-9a-f-]{27,}/gu, "guid")
    .replace(/\b(dev|sit|uat|test|tst|perf|preprod|pre-prod|prod|production|sandbox|sbx)\b/gu, "env")
    .replace(/[^a-z0-9]+/gu, " ")
    .trim();
}

function getTopOperationalSignals(model: ComparisonViewModel): readonly TopOperationalSignal[] {
  const sorted = model.groups
    .flatMap((group) => group.differences.map((difference) => ({
      groupTitle: shortGroupTitle(group.title),
      groupId: group.id,
      title: getParticipationDensitySignalTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)
        ?? simplifyDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel),
      significance: difference.significance,
      kind: difference.kind,
      impact: getOperationalImpactSummary(difference, model.summary.sourceLabel, model.summary.targetLabel),
      priority: getSignalPriority(difference)
    })))
    .sort((left, right) => {
      const priority = right.priority - left.priority;
      if (priority !== 0) {
        return priority;
      }

      const rank = significanceRank(right.significance) - significanceRank(left.significance);
      if (rank !== 0) {
        return rank;
      }

      const groupRank = shortGroupTitle(left.groupTitle).localeCompare(shortGroupTitle(right.groupTitle));
      if (groupRank !== 0) {
        return groupRank;
      }

      return left.title.localeCompare(right.title);
    });

  const selected: TopOperationalSignal[] = [];
  const seen = new Set<string>();
  const perGroup = new Map<string, number>();

  for (const signal of sorted) {
    const key = `${signal.groupId}:${normalizeSignalKey(signal.title)}`;
    if (seen.has(key)) {
      continue;
    }

    const groupCount = perGroup.get(signal.groupId) ?? 0;
    if (groupCount >= 3 && selected.length < 4) {
      continue;
    }

    seen.add(key);
    perGroup.set(signal.groupId, groupCount + 1);
    selected.push(signal);

    if (selected.length >= 5) {
      break;
    }
  }

  return selected;
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

  const totalSignals = model.summary.differenceCount;
  const highSignals = model.groups.reduce((count, group) => count + group.differences.filter((difference) => difference.significance === "High").length, 0);
  const curationNote = highSignals > signals.length
    ? `<p class="dvqr-top-signal-note">Showing ${signals.length} of ${highSignals} high-significance drift signals. Additional signals remain available in provider sections.</p>`
    : totalSignals > signals.length
      ? `<p class="dvqr-top-signal-note">Showing the strongest ${signals.length} of ${totalSignals} drift signals. Provider sections keep the full evidence available.</p>`
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

function getVisibleDifferenceLimit(group: ComparisonDriftGroup): number {
  const level = getGroupDensityLevel(group);
  if (level === "very-dense") {
    return 12;
  }

  if (level === "dense") {
    return 16;
  }

  return group.differences.length;
}

function getOrderedGroupDifferences(group: ComparisonDriftGroup): readonly ComparisonDifference[] {
  return [...group.differences].sort((left, right) => {
    const priority = getSignalPriority(right) - getSignalPriority(left);
    if (priority !== 0) {
      return priority;
    }

    const significance = significanceRank(right.significance) - significanceRank(left.significance);
    if (significance !== 0) {
      return significance;
    }

    return left.title.localeCompare(right.title);
  });
}



function isMinorIdentityMatchingSignal(difference: ComparisonDifference): boolean {
  if (difference.kind !== "Changed") {
    return false;
  }

  if (difference.evidence.some((item) => item.label === "Participation density")) {
    return false;
  }

  const title = difference.title.toLowerCase();
  const confidenceBasedTitle = title.startsWith("likely corresponding identity:")
    || title.startsWith("possible corresponding identity:");
  if (!confidenceBasedTitle) {
    return false;
  }

  const subject = getIdentitySubjectFromDifference(difference);
  return subject === "Teams" || subject === "Roles" || subject === undefined;
}

function getMinorIdentityGroupedCardIntro(count: number): string {
  return `${count} lower-priority team/role matching signal${count === 1 ? "" : "s"} observed. These are grouped to reduce repetitive identity matching noise while preserving evidence continuity.`;
}

function getMinorIdentityGroupedDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const likely = differences.filter((difference) => difference.title.toLowerCase().startsWith("likely corresponding identity:")).length;
  const possible = differences.filter((difference) => difference.title.toLowerCase().startsWith("possible corresponding identity:")).length;
  const parts = [
    likely > 0 ? `${likely} likely match${likely === 1 ? "" : "es"}` : undefined,
    possible > 0 ? `${possible} possible match${possible === 1 ? "" : "es"}` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "Confidence-based team/role matching signals";
}

function renderGroupedIdentityEvidenceSummary(
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const counts = new Map<string, number>();
  for (const difference of groupedDifferences) {
    const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
    counts.set(subject, (counts.get(subject) ?? 0) + 1);
  }

  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} identity drift signals`],
    ["Classification rationale", "Grouped because these are lower-priority confidence-based team/role matching signals without participation-density evidence."],
    ["Match posture", getMinorIdentityGroupedDirectionSummary(groupedDifferences)],
    ["Identity subjects", renderCountBreakdown(counts)],
    ["Operational priority", "Lower-priority topology matching context by default; review when team or role equivalence is part of the investigation."],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

function renderGroupedIdentityDetails(
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string,
  totalDifferenceCount: number
): string {
  if (differences.length === 0) {
    return "";
  }

  const preview = differences
    .slice(0, 8)
    .map((difference) => `<li><span class="dvqr-classified-drift-main"><strong>${escapeHtml(simplifyDifferenceTitle(difference, sourceLabel, targetLabel))}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span><span class="dvqr-evidence-continuation-pill" title="Representative grouped identity evidence remains available in the full JSON/HTML export.">Query evidence ›</span></li>`)
    .join("");
  const overflow = differences.length > 8
    ? `<li class="dvqr-classified-drift-overflow"><em>${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
    : "";

  return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>Minor identity matching signals (${differences.length})</summary>
        <p>${escapeHtml(getMinorIdentityGroupedCardIntro(differences.length))}</p>
        ${renderGroupedIdentityEvidenceSummary(differences, totalDifferenceCount)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
}

function getProviderMinorGroupingLabel(group: ComparisonDriftGroup): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Minor plugin configuration signals";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Minor workflow metadata signals";
  }

  if (group.id === "operational-profile-drift") {
    return "Minor operational profile detail signals";
  }

  return "Additional provider detail signals";
}

function getProviderMinorGroupingIntro(group: ComparisonDriftGroup, count: number): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return `${count} lower-priority plugin configuration signal${count === 1 ? "" : "s"} observed. These are grouped to keep runtime-behaviour drift focused on execution-impacting changes while preserving evidence continuity.`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `${count} lower-priority workflow metadata signal${count === 1 ? "" : "s"} observed. These are grouped so activation, presence, and orchestration participation remain easier to scan.`;
  }

  if (group.id === "operational-profile-drift") {
    return `${count} lower-priority operational profile detail signal${count === 1 ? "" : "s"} observed. These are grouped so headline density shifts remain prominent.`;
  }

  return `${count} lower-priority provider signal${count === 1 ? "" : "s"} observed. These are grouped to preserve readability while keeping evidence inspectable.`;
}

function getProviderMinorGroupingRationale(group: ComparisonDriftGroup): string {
  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return "Grouped because these are plugin configuration or metadata changes rather than added/removed steps or state changes.";
  }

  if (group.id === "workflow-automation-participation-drift") {
    return "Grouped because these are lower-priority workflow metadata changes rather than activation or presence drift.";
  }

  if (group.id === "operational-profile-drift") {
    return "Grouped because these are profile dimension detail changes rather than the primary operational-density score shift.";
  }

  return "Grouped because these are lower-priority provider details in a dense comparison surface.";
}

function getProviderMinorDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const counts = new Map<string, number>();
  for (const difference of differences) {
    counts.set(difference.kind, (counts.get(difference.kind) ?? 0) + 1);
  }

  return counts.size > 0 ? renderCountBreakdown(counts) : "Grouped provider detail signals";
}

function isMinorProviderDetailSignal(group: ComparisonDriftGroup, difference: ComparisonDifference): boolean {
  if (group.id === "solution-participation-drift" || group.id === "identity-participation-drift") {
    return false;
  }

  if (group.differences.length <= 5 || difference.significance === "High" || getSignalPriority(difference) >= 70) {
    return false;
  }

  const text = `${difference.title} ${difference.summary} ${difference.evidence.map((item) => item.label).join(" ")}`.toLowerCase();

  if (group.id === "plugin-step-runtime-behaviour-drift") {
    return text.includes("configuration")
      || text.includes("filtering")
      || text.includes("secure")
      || text.includes("unsecure")
      || text.includes("managed");
  }

  if (group.id === "workflow-automation-participation-drift") {
    return text.includes("owner")
      || text.includes("managed")
      || text.includes("category")
      || text.includes("type");
  }

  if (group.id === "operational-profile-drift") {
    return difference.kind === "Changed" || difference.significance === "Low";
  }

  return difference.significance === "Low";
}

function renderGroupedProviderEvidenceSummary(
  group: ComparisonDriftGroup,
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} ${shortGroupTitle(group.title).toLowerCase()} drift signals`],
    ["Classification rationale", getProviderMinorGroupingRationale(group)],
    ["Direction summary", getProviderMinorDirectionSummary(groupedDifferences)],
    ["Operational priority", "Lower-priority provider detail by default; review when these details are part of the investigation path."],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

function renderGroupedProviderDetails(
  group: ComparisonDriftGroup,
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string
): string {
  if (differences.length === 0) {
    return "";
  }

  const preview = differences
    .slice(0, 8)
    .map((difference) => `<li><span class="dvqr-classified-drift-main"><strong>${escapeHtml(simplifyDifferenceTitle(difference, sourceLabel, targetLabel))}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span><span class="dvqr-evidence-continuation-pill" title="Representative grouped provider evidence remains available in the full JSON/HTML export.">Query evidence ›</span></li>`)
    .join("");
  const overflow = differences.length > 8
    ? `<li class="dvqr-classified-drift-overflow"><em>${differences.length - 8} additional signal${differences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
    : "";

  return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>${escapeHtml(getProviderMinorGroupingLabel(group))} (${differences.length})</summary>
        <p>${escapeHtml(getProviderMinorGroupingIntro(group, differences.length))}</p>
        ${renderGroupedProviderEvidenceSummary(group, differences, group.differences.length)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
}

function isGroupedSolutionClassification(classification: string): boolean {
  return classification === "Microsoft platform solution"
    || classification === "Platform patch layer"
    || classification === "Backup / archived solution";
}

function shouldRenderSolutionAsGroupedCard(difference: ComparisonDifference): boolean {
  return isGroupedSolutionClassification(getSolutionClassification(difference));
}

function getSolutionGroupedCardIntro(classification: string, count: number): string {
  if (classification === "Microsoft platform solution") {
    return `${count} Microsoft/platform solution drift signal${count === 1 ? "" : "s"} observed. These are grouped as low-priority platform-layering context; expand only if platform package alignment is relevant.`;
  }

  if (classification === "Platform patch layer") {
    return `${count} patch or cumulative-layer drift signal${count === 1 ? "" : "s"} observed. These are grouped as servicing-layer context rather than primary customisation drift.`;
  }

  if (classification === "Backup / archived solution") {
    return `${count} backup/archive-like solution drift signal${count === 1 ? "" : "s"} observed. This remains visible as evidence but is treated as lower-priority investigation context.`;
  }

  return `${count} grouped drift signal${count === 1 ? "" : "s"} observed.`;
}

function getSolutionGroupedEvidenceRationale(classification: string): string {
  if (classification === "Microsoft platform solution") {
    return "Grouped because the observed solutions match Microsoft/platform package naming or baseline platform-layer evidence.";
  }

  if (classification === "Platform patch layer") {
    return "Grouped because the observed solutions look like patch, cumulative, servicing, or hotfix layers.";
  }

  if (classification === "Backup / archived solution") {
    return "Grouped because the observed solution name suggests backup, archive, or preserved-copy context.";
  }

  return "Grouped to preserve readability while keeping the underlying drift signals inspectable.";
}

function getSolutionGroupedSignificancePosture(classification: string): string {
  if (classification === "Microsoft platform solution" || classification === "Platform patch layer") {
    return "Low operational priority by default; review when platform package alignment is part of the investigation.";
  }

  if (classification === "Backup / archived solution") {
    return "Lower-priority investigation context by default; review when archived or backup layers may explain local customisation history.";
  }

  return "Grouped evidence remains advisory; review representative signals before expanding the full evidence set.";
}

function getSolutionGroupedDirectionSummary(differences: readonly ComparisonDifference[]): string {
  const sourceOnly = differences.filter((difference) => difference.kind === "OnlyInSource").length;
  const targetOnly = differences.filter((difference) => difference.kind === "OnlyInTarget").length;
  const changed = differences.filter((difference) => difference.kind !== "OnlyInSource" && difference.kind !== "OnlyInTarget").length;
  const parts = [
    sourceOnly > 0 ? `${sourceOnly} source-only` : undefined,
    targetOnly > 0 ? `${targetOnly} target-only` : undefined,
    changed > 0 ? `${changed} changed` : undefined
  ].filter((part): part is string => Boolean(part));

  return parts.length > 0 ? parts.join(" · ") : "No direction summary available";
}

function renderGroupedSolutionEvidenceSummary(
  classification: string,
  groupedDifferences: readonly ComparisonDifference[],
  totalDifferenceCount: number
): string {
  const rows: readonly [string, string][] = [
    ["Grouped classification", `${groupedDifferences.length} of ${totalDifferenceCount} solution drift signals`],
    ["Classification rationale", getSolutionGroupedEvidenceRationale(classification)],
    ["Direction summary", getSolutionGroupedDirectionSummary(groupedDifferences)],
    ["Operational priority", getSolutionGroupedSignificancePosture(classification)],
    ["Evidence continuity", "Representative signals are listed below; full per-signal evidence remains available in JSON/HTML export."]
  ];

  return `<div class="dvqr-grouped-evidence-summary">${rows
    .map(([label, value]) => `<div><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value)}</span></div>`)
    .join("")}</div>`;
}

function groupSolutionDifferencesByClassification(differences: readonly ComparisonDifference[]): readonly [string, readonly ComparisonDifference[]][] {
  const grouped = new Map<string, ComparisonDifference[]>();
  for (const difference of differences) {
    const classification = getSolutionClassification(difference);
    const current = grouped.get(classification) ?? [];
    current.push(difference);
    grouped.set(classification, current);
  }

  return [...grouped.entries()].sort((left, right) => {
    const priority = getSolutionClassificationGroupPriority(left[0]) - getSolutionClassificationGroupPriority(right[0]);
    if (priority !== 0) {
      return priority;
    }

    return right[1].length - left[1].length || left[0].localeCompare(right[0]);
  });
}

function getSolutionClassificationGroupPriority(classification: string): number {
  if (classification === "Microsoft platform solution") {
    return 0;
  }

  if (classification === "Platform patch layer") {
    return 1;
  }

  if (classification === "Backup / archived solution") {
    return 2;
  }

  return 3;
}

function renderDifferenceList(
  group: ComparisonDriftGroup,
  sourceLabel: string,
  targetLabel: string
): string {
  const orderedDifferences = getOrderedGroupDifferences(group);
  const groupedSolutionCards = group.id === "solution-participation-drift"
    ? orderedDifferences.filter(shouldRenderSolutionAsGroupedCard)
    : [];
  const groupedIdentityCards = group.id === "identity-participation-drift"
    ? orderedDifferences.filter(isMinorIdentityMatchingSignal)
    : [];
  const groupedProviderCards = orderedDifferences.filter((difference) => isMinorProviderDetailSignal(group, difference));
  const primaryDifferences = group.id === "solution-participation-drift"
    ? orderedDifferences.filter((difference) => !shouldRenderSolutionAsGroupedCard(difference))
    : group.id === "identity-participation-drift"
      ? orderedDifferences.filter((difference) => !isMinorIdentityMatchingSignal(difference))
      : orderedDifferences.filter((difference) => !isMinorProviderDetailSignal(group, difference));
  const visibleLimit = getVisibleDifferenceLimit({ ...group, differences: primaryDifferences });
  const visible = primaryDifferences.slice(0, visibleLimit);
  const deferred = primaryDifferences.slice(visibleLimit);
  const renderedVisible = visible
    .map((difference, index) => renderDifference(difference, sourceLabel, targetLabel, group.differences, index))
    .join("");

  const groupedSolutionDetails = renderGroupedSolutionDetails(groupedSolutionCards, sourceLabel, targetLabel, group.differences.length);
  const groupedIdentityDetails = renderGroupedIdentityDetails(groupedIdentityCards, sourceLabel, targetLabel, group.differences.length);
  const groupedProviderDetails = renderGroupedProviderDetails(group, groupedProviderCards, sourceLabel, targetLabel);
  const groupedDetails = `${groupedSolutionDetails}${groupedIdentityDetails}${groupedProviderDetails}`;

  if (deferred.length === 0) {
    return `<div class="dvqr-difference-list">${renderedVisible}</div>${groupedDetails}`;
  }

  const renderedDeferred = deferred
    .map((difference, index) => renderDifference(difference, sourceLabel, targetLabel, group.differences, visibleLimit + index))
    .join("");
  const deferredSummary = renderDeferredSummary(group, deferred);

  return `<div class="dvqr-difference-list">${renderedVisible}</div>
    ${groupedDetails}
    <details class="dvqr-deferred-differences">
      <summary>Show ${deferred.length} additional drift signal${deferred.length === 1 ? "" : "s"}</summary>
      <p>Lower-ranked signals are grouped to keep dense comparisons readable. They remain available as evidence-backed investigation context.</p>
      ${deferredSummary}
      <div class="dvqr-difference-list">${renderedDeferred}</div>
    </details>`;
}

function renderGroupedSolutionDetails(
  differences: readonly ComparisonDifference[],
  sourceLabel: string,
  targetLabel: string,
  totalDifferenceCount: number
): string {
  if (differences.length === 0) {
    return "";
  }

  return groupSolutionDifferencesByClassification(differences)
    .map(([classification, groupedDifferences]) => {
      const preview = groupedDifferences
        .slice(0, 8)
        .map((difference) => `<li><span class="dvqr-classified-drift-main"><strong>${escapeHtml(simplifyDifferenceTitle(difference, sourceLabel, targetLabel))}</strong><span class="dvqr-classified-drift-meta">${escapeHtml(difference.significance)} · ${escapeHtml(difference.kind)}</span></span><span class="dvqr-evidence-continuation-pill" title="Representative grouped evidence remains available in the full JSON/HTML export.">Query evidence ›</span></li>`)
        .join("");
      const overflow = groupedDifferences.length > 8
        ? `<li class="dvqr-classified-drift-overflow"><em>${groupedDifferences.length - 8} additional signal${groupedDifferences.length - 8 === 1 ? "" : "s"} preserved in JSON/HTML export.</em></li>`
        : "";

      return `<details class="dvqr-deferred-differences dvqr-classified-drift-card">
        <summary>${escapeHtml(classification)} (${groupedDifferences.length})</summary>
        <p>${escapeHtml(getSolutionGroupedCardIntro(classification, groupedDifferences.length))}</p>
        ${renderGroupedSolutionEvidenceSummary(classification, groupedDifferences, totalDifferenceCount)}
        <ul class="dvqr-classified-drift-list">${preview}${overflow}</ul>
      </details>`;
    })
    .join("");
}

function renderDeferredSummary(group: ComparisonDriftGroup, deferred: readonly ComparisonDifference[]): string {
  if (!deferred.length) {
    return "";
  }

  if (group.id === "solution-participation-drift") {
    const counts = new Map<string, number>();
    for (const difference of deferred) {
      const classification = getSolutionClassification(difference);
      counts.set(classification, (counts.get(classification) ?? 0) + 1);
    }

    return `<div class="dvqr-deferred-summary"><strong>Grouped solution drift</strong><span>${escapeHtml(renderCountBreakdown(counts))}</span></div>`;
  }

  if (group.id === "identity-participation-drift") {
    const counts = new Map<string, number>();
    for (const difference of deferred) {
      const subject = getIdentitySubjectFromDifference(difference) ?? "Additional identity drift signals";
      counts.set(subject, (counts.get(subject) ?? 0) + 1);
    }

    return `<div class="dvqr-deferred-summary"><strong>Grouped identity drift</strong><span>${escapeHtml(renderCountBreakdown(counts))}</span></div>`;
  }

  return "";
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
    ${renderGroupErgonomicsSummary(group)}
    ${renderGroupDensityNote(group)}
    ${renderNearbyOperationalDrift(group)}
    ${renderDifferenceList(group, sourceLabel, targetLabel)}
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
          ${renderComparisonPostureNote(model)}
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
