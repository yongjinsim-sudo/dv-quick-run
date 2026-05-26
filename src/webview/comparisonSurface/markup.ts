import type { ComparisonDifference, ComparisonDriftGroup, ComparisonOperationalSignificance, ComparisonViewModel } from "../../core/comparison/index.js";

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
    { label: "Primary domain", value: getPrimaryDriftDomain(model) },
    { label: "Comparison", value: getComparedSubject(model) }
  ];

  return `<div class="dvqr-summary-grid">${items.map((item) => {
    const textClass = item.label === "Primary domain" || item.label === "Comparison" ? " is-text" : "";
    return `<div class="dvqr-summary-item${textClass}"><span class="dvqr-summary-value">${escapeHtml(item.value)}</span><span class="dvqr-summary-label">${escapeHtml(item.label)}</span></div>`;
  }).join("")}</div>`;
}

function renderEnvironmentPanel(model: ComparisonViewModel): string {
  return `<aside class="dvqr-environment-card" aria-label="Comparison environments">
    <div class="dvqr-environment-title">Environments</div>
    <div class="dvqr-environment-grid">
      <div class="dvqr-environment-item">
        <span class="dvqr-value-label">Source</span>
        <strong>${escapeHtml(model.summary.sourceLabel)}</strong>
        <span>${escapeHtml(formatCapturedAt(model.summary.sourceCapturedAtIso))}</span>
      </div>
      <div class="dvqr-environment-item">
        <span class="dvqr-value-label">Target</span>
        <strong>${escapeHtml(model.summary.targetLabel)}</strong>
        <span>${escapeHtml(formatCapturedAt(model.summary.targetCapturedAtIso))}</span>
      </div>
    </div>
  </aside>`;
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
  return (parts.length > 1 ? parts.slice(1).join(":") : title).trim();
}

function getDensitySubjectTitle(subject: string, sourceValue: string | undefined, targetValue: string | undefined): string {
  const direction = describeDirection(sourceValue, targetValue);

  if (subject === "DVQR Score density") {
    return "DVQR Score changed";
  }

  if (subject === "Automation (Plugin Steps)") {
    return direction === "appeared" ? "Plugin Steps participation appeared" : direction === "was no longer observed" ? "Plugin Steps participation removed" : "Plugin Steps participation changed";
  }

  if (subject === "Real-time Workflows") {
    return direction === "appeared" ? "Real-time workflow participation appeared" : direction === "was no longer observed" ? "Real-time workflow participation removed" : "Real-time workflow participation changed";
  }

  if (subject === "Relationships") {
    return direction === "appeared" ? "Relationship evidence appeared" : direction === "was no longer observed" ? "Relationship evidence removed" : `Relationship count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  if (subject === "Columns") {
    return direction === "appeared" ? "Column evidence appeared" : direction === "was no longer observed" ? "Column evidence removed" : `Column count ${direction === "changed" && sourceValue && targetValue ? `${describeBandMovement(sourceValue, targetValue)} (${sourceValue} → ${targetValue})` : direction}`;
  }

  return `${subject} ${direction}`;
}

function simplifyDifferenceTitle(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string
): string {
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
    return `${extractOnlyInName(difference.title)} present only in ${sourceLabel}`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `${extractOnlyInName(difference.title)} present only in ${targetLabel}`;
  }

  if (difference.kind === "Changed") {
    const name = extractOnlyInName(difference.title);
    if (difference.title.toLowerCase().includes("managed state")) {
      return `${name} managed state changed`;
    }

    if (difference.title.toLowerCase().includes("version")) {
      return `${name} version drift`;
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
    return `Present only in ${sourceLabel}.`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `Present only in ${targetLabel}.`;
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

function renderEvidenceItem(item: ComparisonDifference["evidence"][number]): string {
  const value = item.value ? ` — ${escapeHtml(item.value)}` : "";
  const continuationLabel = getEvidenceContinuationLabel(item);

  return `<li>
    <span><strong>${escapeHtml(item.label)}</strong>${value}</span>
    <span class="dvqr-evidence-continuation-pill" title="Future Pro continuation: open the Dataverse evidence behind this drift signal.">
      ${escapeHtml(continuationLabel)} ›
    </span>
  </li>`;
}

function renderDifference(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string
): string {
  const evidence = difference.evidence.length > 0
    ? `<details class="dvqr-evidence-details"><summary>Show evidence <span>${difference.evidence.length}</span></summary><ul class="dvqr-evidence">${difference.evidence.map((item) => renderEvidenceItem(item)).join("")}</ul></details>`
    : "";

  const openAttribute = difference.significance === "High" ? " open" : "";

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
      `Operational profile changes are concentrated in ${targetLabel}.`,
      highlights
    );
  }

  if (group.id === "solution-participation-drift") {
    return buildNarrativeBlock(
      `Solution layering differs between ${sourceLabel} and ${targetLabel}.`,
      highlights
    );
  }

  if (group.id === "workflow-automation-participation-drift") {
    return buildNarrativeBlock(
      `Automation participation differs between ${sourceLabel} and ${targetLabel}.`,
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
    <div class="dvqr-difference-list">${group.differences.map((difference) => renderDifference(difference, sourceLabel, targetLabel)).join("")}</div>
  </article>`;
}

function shortGroupTitle(title: string): string {
  return title
    .replace("Operational Profile Drift", "Operational Profile")
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

  return `<main class="dvqr-comparison">
    <section class="dvqr-hero">
      <div class="dvqr-hero-topline">
        <div>
          <div class="dvqr-eyebrow">${escapeHtml(getComparisonSurfaceEyebrow(model, options))}</div>
          <h1>${escapeHtml(model.title)}</h1>
        </div>
        ${renderToolbar(options)}
      </div>
      <p class="dvqr-muted">DVQR observes operational drift. DVQR does not fix operational drift.</p>
      <div class="dvqr-hero-detail-grid">
        <div>
          <p><strong>Source:</strong> ${escapeHtml(model.summary.sourceLabel)} · <strong>Target:</strong> ${escapeHtml(model.summary.targetLabel)}</p>
          ${renderSummary(model)}
        </div>
        ${renderEnvironmentPanel(model)}
      </div>
    </section>

    <section>
      <h2>Operational Drift</h2>
      <p class="dvqr-section-note">Grouped, evidence-backed differences from comparison providers. These are investigation signals, not remediation instructions.</p>
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
