import type { ComparisonDifference, ComparisonDriftGroup, ComparisonInvestigationContinuation } from "../../core/comparison/index.js";
import { escapeHtml, slug } from "./comparisonSurfacePrimitives.js";

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

export function simplifyGroupSummary(group: ComparisonDriftGroup): string {
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

export function simplifyDifferenceTitle(
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


export function simplifyDifferenceSummary(
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
    return "Investigate solution";
  }

  if (label.includes("automation") || label.includes("workflow") || label.includes("plugin")) {
    return "Investigate automation";
  }

  if (label.includes("role")) {
    return "Investigate role";
  }

  if (label.includes("team")) {
    return "Investigate team";
  }

  if (label.includes("identity") || label.includes("user") || label.includes("only in source") || label.includes("only in target") || label.includes("normalized name") || label.includes("normalised name")) {
    return "Investigate identity";
  }

  if (label.includes("score") || label.includes("signal") || label.includes("delta")) {
    return "Investigate evidence";
  }

  return "Investigate evidence";
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

  return "Available in DVQR Pro — investigate the raw evidence behind this drift signal.";
}


function isMetadataDifference(difference: ComparisonDifference): boolean {
  const haystack = [
    difference.title,
    difference.summary,
    difference.kind,
    ...difference.evidence.map((item) => `${item.label} ${item.value ?? ""}`)
  ].join(" ").toLowerCase();

  return haystack.includes("metadata")
    || haystack.includes("schema name")
    || haystack.includes("column logical name")
    || haystack.includes("choice set")
    || haystack.includes("option value")
    || haystack.includes("relationship schema")
    || haystack.includes("entity configuration");
}

function renderEvidenceItem(
  item: ComparisonDifference["evidence"][number],
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string
): string {
  const value = item.value ? ` — ${escapeHtml(item.value)}` : "";
  const continuationLabel = getEvidenceContinuationLabel(item);
  const continuationTooltip = getEvidenceContinuationTooltip(item);
  const evidenceId = slug(`${difference.id}-${difference.kind}-${item.label}-${item.value ?? ""}`);
  const evidenceKind = item.label.toLowerCase().includes("solution classification")
    ? "solution-classification"
    : getEvidenceContinuationLabel(item).replace(/^Investigate\s+/i, "").toLowerCase();
  const parentTitle = simplifyDifferenceTitle(difference, sourceLabel, targetLabel);
  const parentSummary = simplifyDifferenceSummary(difference, sourceLabel, targetLabel);
  const parentEvidence = difference.evidence
    .map((evidence) => `${evidence.label}: ${evidence.value ?? ""}`)
    .join(" · ");
  const metadataDifference = isMetadataDifference(difference);
  const auditTooltip = metadataDifference
    ? "Check interval-bounded audit evidence. Metadata-only changes often do not have Dataverse audit rows."
    : "Check audit evidence inside the snapshot-bounded interval.";
  const auditIntro = metadataDifference
    ? "Audit lookup is explicit and interval-bounded. Metadata-only changes may not have Dataverse audit rows; captured snapshot metadata remains the evidence source."
    : "Audit lookup is explicit and interval-bounded. Audit evidence enriches this finding; it does not establish root cause.";

  return `<li class="dvqr-evidence-item" data-evidence-label="${escapeHtml(item.label)}" data-evidence-value="${escapeHtml(item.value ?? "")}" data-evidence-kind="${escapeHtml(evidenceKind)}" data-parent-title="${escapeHtml(parentTitle)}" data-parent-summary="${escapeHtml(parentSummary)}" data-parent-kind="${escapeHtml(difference.kind)}" data-parent-provider="" data-parent-evidence="${escapeHtml(parentEvidence)}">
    <span><strong>${escapeHtml(item.label)}</strong>${value}</span>
    <div class="dvqr-evidence-actions">
      <button type="button" class="dvqr-evidence-continuation-pill" data-evidence-inspect="${escapeHtml(evidenceId)}" data-evidence-label-collapsed="${escapeHtml(continuationLabel)} ›" aria-expanded="false" title="${escapeHtml(continuationTooltip)}">
        ${escapeHtml(continuationLabel)} ›
      </button>
      <button type="button" class="dvqr-evidence-continuation-pill dvqr-audit-evidence-pill" data-audit-check="${escapeHtml(evidenceId)}" aria-expanded="false" title="${escapeHtml(auditTooltip)}">
        Check audit evidence ›
      </button>
    </div>
    <div class="dvqr-inline-evidence-context" data-evidence-context="${escapeHtml(evidenceId)}" hidden>
      <strong>Inline evidence context</strong>
      <span>This opens the rendered evidence payload already captured in this comparison. Use it to verify the drift signal before continuing investigation outside DVQR.</span>
      <dl>
        <dt>Evidence label</dt>
        <dd>${escapeHtml(item.label)}</dd>
        <dt>Observed value</dt>
        <dd>${escapeHtml(item.value ?? "No value captured")}</dd>
        <dt>Operational boundary</dt>
        <dd>Captured evidence opens in exported HTML. In the VS Code webview, DVQR can continue into bounded live investigation pivots without losing comparison context.</dd>
        <dt>Live evidence pivot</dt>
        <dd data-evidence-live-result="${escapeHtml(evidenceId)}">Not queried yet.</dd>
      </dl>
    </div>
    <div class="dvqr-inline-audit-context" data-audit-context="${escapeHtml(evidenceId)}" hidden>
      <strong>Audit evidence</strong>
      <span>${escapeHtml(auditIntro)}</span>
      <div data-audit-result="${escapeHtml(evidenceId)}">Not queried yet.</div>
    </div>
  </li>`;
}

function getContinuationKindLabel(kind: ComparisonInvestigationContinuation["kind"]): string {
  switch (kind) {
    case "IdentityParticipation":
      return "Identity participation";
    case "RuntimeBehaviour":
      return "Runtime behaviour";
    case "WorkflowAutomation":
      return "Workflow / automation";
    case "SolutionParticipation":
      return "Solution participation";
    case "OperationalProfile":
      return "Operational profile";
    case "RawEvidence":
      return "Raw evidence";
  }
}

function getContinuationStateLabel(state: ComparisonInvestigationContinuation["state"]): string {
  switch (state) {
    case "Available":
      return "Available inline";
    case "Deferred":
      return "Deferred";
    case "InspectOnly":
      return "Inspect only";
  }
}

function renderContinuationEvidence(evidence: readonly ComparisonDifference["evidence"][number][]): string {
  if (evidence.length === 0) {
    return "";
  }

  return `<ul class="dvqr-continuation-evidence">${evidence
    .map((item) => `<li><strong>${escapeHtml(item.label)}</strong>${item.value ? ` — ${escapeHtml(item.value)}` : ""}</li>`)
    .join("")}</ul>`;
}

function renderInvestigationContinuation(
  continuation: ComparisonInvestigationContinuation,
  depth: number
): string {
  const boundedDepth = Math.min(depth, 3);
  const childContinuations = continuation.children ?? [];
  const children = childContinuations.length > 0 && boundedDepth < 3
    ? `<div class="dvqr-continuation-children">${childContinuations.map((child) => renderInvestigationContinuation(child, boundedDepth + 1)).join("")}</div>`
    : childContinuations.length > 0
      ? `<div class="dvqr-continuation-depth-limit"><strong>Continuation depth limit reached</strong><span>Open a dedicated investigation surface before expanding ${childContinuations.length} additional continuation${childContinuations.length === 1 ? "" : "s"}.</span></div>`
      : "";

  return `<article class="dvqr-investigation-continuation" data-continuation-state="${escapeHtml(continuation.state)}" data-continuation-depth="${boundedDepth}">
    <div class="dvqr-continuation-heading">
      <div>
        <span class="dvqr-continuation-eyebrow">Continue investigation</span>
        <h4>${escapeHtml(continuation.title)}</h4>
      </div>
      <div class="dvqr-meta dvqr-continuation-meta">
        <span class="dvqr-chip">${escapeHtml(getContinuationKindLabel(continuation.kind))}</span>
        <span class="dvqr-chip dvqr-chip-muted">${escapeHtml(getContinuationStateLabel(continuation.state))}</span>
      </div>
    </div>
    <p>${escapeHtml(continuation.summary)}</p>
    ${renderContinuationEvidence(continuation.evidence)}
    ${children}
  </article>`;
}

export function renderInvestigationContinuations(
  continuations: readonly ComparisonInvestigationContinuation[] | undefined,
  label = "Investigation continuations"
): string {
  if (!continuations?.length) {
    return "";
  }

  return `<details class="dvqr-investigation-continuations" open>
    <summary>${escapeHtml(label)} <span>${continuations.length}</span></summary>
    <p>Replay-safe, provider-owned continuations preserve nearby operational context without implying causality, remediation, or authority certainty.</p>
    <div class="dvqr-continuation-list">${continuations.map((continuation) => renderInvestigationContinuation(continuation, 1)).join("")}</div>
  </details>`;
}

export function renderDifference(
  difference: ComparisonDifference,
  sourceLabel: string,
  targetLabel: string,
  groupDifferences: readonly ComparisonDifference[],
  differenceIndex: number
): string {
  const evidence = difference.evidence.length > 0
    ? `<details class="dvqr-evidence-details"><summary>Show full evidence <span>${difference.evidence.length}</span></summary><ul class="dvqr-evidence">${difference.evidence.map((item) => renderEvidenceItem(item, difference, sourceLabel, targetLabel)).join("")}</ul></details>`
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
      ${renderInvestigationContinuations(difference.continuations, "Inline investigation continuations")}
    </div>
  </details>`;
}

