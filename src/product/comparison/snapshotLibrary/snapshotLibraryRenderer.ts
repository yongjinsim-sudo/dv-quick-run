import * as vscode from "vscode";
import type { ComparisonSnapshotRegistryEntry } from "../index.js";
import { getVisibleRecentComparisons, MAX_RECENT_COMPARISONS } from "./recentComparisonService.js";
import type { RecentComparisonEntry } from "./recentComparisonService.js";

function formatSnapshotPickerTime(value: string | undefined): string {
  if (!value) {
    return "unknown capture time";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

interface SnapshotSubjectGroup {
  readonly groupKey: string;
  readonly subjectLabel: string;
  readonly latest: ComparisonSnapshotRegistryEntry;
  readonly older: readonly ComparisonSnapshotRegistryEntry[];
  readonly totalCount: number;
  readonly hasFavourite: boolean;
}

function buildSnapshotSubjectKey(entry: ComparisonSnapshotRegistryEntry): string {
  return [
    entry.environmentLabel || "Unknown environment",
    entry.entityLogicalName ?? entry.entityDisplayName ?? entry.label
  ].join("::").toLowerCase();
}

function compareSnapshotEntriesForLibrary(left: ComparisonSnapshotRegistryEntry, right: ComparisonSnapshotRegistryEntry): number {
  if (left.isFavourite !== right.isFavourite) {
    return left.isFavourite ? -1 : 1;
  }

  return right.capturedAtIso.localeCompare(left.capturedAtIso);
}

function groupSnapshotEntriesByEnvironment(entries: readonly ComparisonSnapshotRegistryEntry[]): readonly {
  readonly environmentLabel: string;
  readonly groups: readonly SnapshotSubjectGroup[];
  readonly snapshotCount: number;
}[] {
  const environmentGroups = new Map<string, ComparisonSnapshotRegistryEntry[]>();

  for (const entry of entries) {
    const key = entry.environmentLabel || "Unknown environment";
    environmentGroups.set(key, [...(environmentGroups.get(key) ?? []), entry]);
  }

  return [...environmentGroups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([environmentLabel, groupEntries]) => {
      const subjectGroups = new Map<string, ComparisonSnapshotRegistryEntry[]>();
      for (const entry of groupEntries) {
        const key = buildSnapshotSubjectKey(entry);
        subjectGroups.set(key, [...(subjectGroups.get(key) ?? []), entry]);
      }

      const groups = [...subjectGroups.entries()].map(([groupKey, subjectEntries]) => {
        const ordered = subjectEntries.sort(compareSnapshotEntriesForLibrary);
        const latest = ordered[0];
        const subjectLabel = latest.entityDisplayName ?? latest.entityLogicalName ?? latest.label ?? "Operational snapshot";
        return {
          groupKey,
          subjectLabel,
          latest,
          older: ordered.slice(1),
          totalCount: ordered.length,
          hasFavourite: ordered.some((entry) => entry.isFavourite)
        };
      }).sort((left, right) => {
        if (left.hasFavourite !== right.hasFavourite) {
          return left.hasFavourite ? -1 : 1;
        }

        return right.latest.capturedAtIso.localeCompare(left.latest.capturedAtIso);
      });

      return {
        environmentLabel,
        groups,
        snapshotCount: groupEntries.length
      };
    });
}

function getSnapshotLibraryStyles(): string {
  return `
:root {
  color-scheme: light dark;
  --vscode-editor-background: #111315;
  --vscode-foreground: #d4d4d4;
  --vscode-font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  --vscode-font-size: 13px;
  --vscode-editorWidget-background: #1e1e1e;
  --vscode-panel-border: #2d2d2d;
  --vscode-descriptionForeground: #a8a8a8;
  --vscode-button-background: #0e639c;
  --vscode-button-foreground: #ffffff;
  --vscode-button-hoverBackground: #1177bb;
  --vscode-button-secondaryBackground: #3a3d41;
  --vscode-button-secondaryForeground: #ffffff;
  --vscode-button-secondaryHoverBackground: #45494e;
  --vscode-button-border: #555;
}

body {
  background: var(--vscode-editor-background);
  color: var(--vscode-foreground);
  font-family: var(--vscode-font-family);
  font-size: var(--vscode-font-size);
  margin: 0;
}

.dvqr-snapshot-library {
  margin: 0 auto;
  max-width: 1180px;
  padding: 4px;
}

.dvqr-hero,
.dvqr-card {
  background: var(--vscode-editorWidget-background);
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  padding: 8px;
}

.dvqr-hero {
  margin-bottom: 4px;
}

.dvqr-hero-topline {
  align-items: flex-start;
  display: flex;
  gap: 4px;
  justify-content: space-between;
}

.dvqr-eyebrow {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
  letter-spacing: 0.08em;
  margin-bottom: 4px;
  text-transform: uppercase;
}

h1,
h2,
h3,
p {
  margin-top: 0;
}

h1 {
  font-size: 24px;
  line-height: 1.18;
  margin-bottom: 4px;
}

h2 {
  font-size: 18px;
}

.dvqr-muted {
  color: var(--vscode-descriptionForeground);
}

.dvqr-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  justify-content: flex-end;
}

.dvqr-button {
  background: var(--vscode-button-secondaryBackground, var(--vscode-button-background));
  border: 1px solid var(--vscode-button-border, transparent);
  border-radius: 6px;
  color: var(--vscode-button-secondaryForeground, var(--vscode-button-foreground));
  cursor: pointer;
  font: inherit;
  padding: 4px 8px;
}

.dvqr-button:hover {
  background: var(--vscode-button-secondaryHoverBackground, var(--vscode-button-hoverBackground));
}

.dvqr-env-tabs {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 12px;
}

.dvqr-env-tab {
  background: transparent;
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  cursor: pointer;
  font: inherit;
  font-size: 12px;
  padding: 4px 8px;
}

.dvqr-env-tab.is-active,
.dvqr-env-tab:hover {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-env-panel.is-hidden,
.dvqr-subject-row.is-hidden {
  display: none;
}

.dvqr-primary-button {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
}

.dvqr-primary-button:hover {
  background: var(--vscode-button-hoverBackground);
}

.dvqr-button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.dvqr-summary-grid {
  display: grid;
  gap: 4px;
  grid-template-columns: repeat(auto-fit, minmax(125px, 1fr));
  margin-top: 6px;
}

.dvqr-summary-item {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 75%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 5px;
}

.dvqr-summary-value {
  display: block;
  font-size: 19px;
  font-weight: 700;
  line-height: 1.2;
  margin-bottom: 4px;
}

.dvqr-summary-label,
.dvqr-card-meta,
.dvqr-card-detail,
.dvqr-row-meta,
.dvqr-selection-summary {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}


.dvqr-recent-comparisons {
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 70%, var(--vscode-panel-border));
  margin-bottom: 5px;
}

.dvqr-recent-comparisons h2 {
  margin-bottom: 4px;
}

.dvqr-recent-list {
  display: grid;
  gap: 6px;
  margin-top: 8px;
  max-height: 250px;
  overflow-y: auto;
  padding-right: 4px;
}

.dvqr-recent-scope-group {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  overflow: hidden;
}

.dvqr-recent-scope-group summary {
  align-items: center;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(180px, 1fr) auto auto;
  list-style: none;
  padding: 8px 10px;
}

.dvqr-recent-scope-group summary::-webkit-details-marker {
  display: none;
}

.dvqr-recent-scope-toggle {
  color: var(--vscode-descriptionForeground);
  font-size: 11px;
}

.dvqr-recent-scope-group[open] .dvqr-recent-scope-toggle::before {
  content: "▾";
}

.dvqr-recent-scope-group:not([open]) .dvqr-recent-scope-toggle::before {
  content: "▸";
}

.dvqr-recent-scope-count {
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-recent-scope-body {
  display: grid;
  gap: 4px;
  padding: 0 6px 6px;
}

.dvqr-recent-comparison-row {
  align-items: center;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(220px, 1fr) auto;
  padding: 6px 8px;
}

.dvqr-recent-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.dvqr-remove-recent-button {
  color: var(--vscode-descriptionForeground);
}

.dvqr-remove-recent-button:hover {
  color: var(--vscode-errorForeground);
}

.dvqr-selection-card {
  border-left: 4px solid var(--vscode-button-background);
  margin-bottom: 5px;
}

.dvqr-selection-grid {
  display: grid;
  gap: 5px;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  margin: 6px 0;
}

.dvqr-selection-box {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 5px;
}

.dvqr-group-list {
  display: grid;
  gap: 4px;
}

.dvqr-environment-heading {
  align-items: center;
  display: flex;
  gap: 4px;
  justify-content: space-between;
  margin-bottom: 4px;
}

.dvqr-subject-list {
  display: grid;
  gap: 4px;
}

.dvqr-library-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 0 0 6px;
}

.dvqr-search-input {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  color: var(--vscode-foreground);
  font: inherit;
  min-width: min(420px, 100%);
  padding: 5px 8px;
}

.dvqr-subject-row {
  border-left: 4px solid var(--vscode-panel-border);
  display: block;
  overflow: hidden;
}

.dvqr-subject-row summary {
  align-items: center;
  cursor: pointer;
  display: grid;
  gap: 6px;
  grid-template-columns: minmax(180px, 1fr) auto;
  list-style: none;
  padding: 3px 5px;
}

.dvqr-subject-row summary::-webkit-details-marker {
  display: none;
}

.dvqr-subject-row[open] summary {
  border-bottom: 1px solid var(--vscode-panel-border);
}

.dvqr-subject-body {
  display: grid;
  gap: 4px;
  padding: 4px 6px 6px;
}

.dvqr-snapshot-row {
  align-items: center;
  border: 1px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 6px;
  grid-template-columns: minmax(180px, 1fr) minmax(210px, 1.2fr) auto;
  padding: 3px 5px;
}

.dvqr-snapshot-row.is-latest {
  background: color-mix(in srgb, var(--vscode-editorWidget-background) 72%, var(--vscode-editor-background));
}

.dvqr-snapshot-row.is-favourite {
  border-color: color-mix(in srgb, var(--vscode-testing-iconQueued) 80%, var(--vscode-panel-border));
}

.dvqr-older-snapshots {
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 8px;
  padding: 4px 6px;
}

.dvqr-older-snapshots summary {
  cursor: pointer;
  color: var(--vscode-descriptionForeground);
  font-size: 12px;
}

.dvqr-older-snapshot-list {
  display: grid;
  gap: 3px;
  margin-top: 3px;
}

.dvqr-snapshot-card {
  border-left: 4px solid var(--vscode-panel-border);
  display: grid;
  gap: 4px;
}

.dvqr-snapshot-card.is-source {
  border-left-color: #4fc1ff;
}

.dvqr-snapshot-card.is-target {
  border-left-color: #cca700;
}

.dvqr-card-title {
  font-size: 15px;
  font-weight: 700;
}

.dvqr-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.dvqr-chip {
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  display: inline-flex;
  font-size: 11px;
  padding: 1px 6px;
}

.dvqr-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  justify-content: flex-end;
}

.dvqr-star-button {
  min-width: 34px;
}

.dvqr-delete-button {
  color: var(--vscode-errorForeground, #f48771);
}

.dvqr-favourite-chip {
  color: var(--vscode-testing-iconQueued);
}

.dvqr-environment-chip {
  opacity: 0.78;
  font-size: 10px;
  padding: 1px 5px;
}

.dvqr-quick-compare-button {
  font-size: 11px;
  padding: 2px 7px;
}

.dvqr-empty-state {
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 14px;
  padding: 18px;
  text-align: center;
}

.dvqr-preview-note {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  color: var(--vscode-descriptionForeground);
  margin: 6px 0 0;
  padding: 6px 8px;
}

.dvqr-button[data-action="lockedAction"] {
  opacity: 0.82;
}

@media (max-width: 720px) {
  .dvqr-snapshot-library {
    padding: 18px;
  }

  .dvqr-hero-topline,
  .dvqr-environment-heading {
    display: block;
  }

  .dvqr-toolbar {
    justify-content: flex-start;
    margin-top: 8px;
  }

  .dvqr-subject-row summary,
  .dvqr-snapshot-row {
    grid-template-columns: 1fr;
  }

  .dvqr-card-actions {
    justify-content: flex-start;
  }
}
`;
}

export function renderSnapshotLibraryHtml(
  webview: vscode.Webview,
  entries: readonly ComparisonSnapshotRegistryEntry[],
  recentComparisons: readonly RecentComparisonEntry[],
  isProPreview: boolean,
  extensionVersion = "unknown"
): string {
  const cspSource = webview.cspSource;
  const nonce = String(Date.now());
  const environments = groupSnapshotEntriesByEnvironment(entries);
  const entityCount = new Set(entries.map((entry) => entry.entityLogicalName ?? entry.entityDisplayName ?? entry.label)).size;
  const latest = entries[0]?.capturedAtIso;
  const favouriteCount = entries.filter((entry) => entry.isFavourite).length;

  const environmentTabs = entries.length
    ? `<div class="dvqr-env-tabs" role="tablist" aria-label="Snapshot environment filters">
        <button type="button" class="dvqr-env-tab is-active" data-env-filter="all">All (${entries.length})</button>
        <button type="button" class="dvqr-env-tab" data-env-filter="favourites">★ Favourites (${favouriteCount})</button>
        ${environments.map((group) => `<button type="button" class="dvqr-env-tab" data-env-filter="${escapeHtml(group.environmentLabel)}">${escapeHtml(group.environmentLabel)} (${group.snapshotCount})</button>`).join("")}
      </div>`
    : "";

  const cards = environments.map((group) => `
    <section class="dvqr-card dvqr-env-panel" data-environment="${escapeHtml(group.environmentLabel)}" data-has-favourite="${group.groups.some((subject) => subject.hasFavourite) ? "true" : "false"}">
      <div class="dvqr-environment-heading">
        <div>
          <h2>${escapeHtml(group.environmentLabel)}</h2>
          <p class="dvqr-muted">${group.snapshotCount} saved snapshot${group.snapshotCount === 1 ? "" : "s"} across ${group.groups.length} subject${group.groups.length === 1 ? "" : "s"}</p>
        </div>
      </div>
      <div class="dvqr-subject-list">
        ${group.groups.map((subjectGroup) => renderSnapshotSubjectGroup(subjectGroup)).join("")}
      </div>
    </section>
  `).join("");

  const emptyState = `<div class="dvqr-empty-state">
    <h2>No saved comparison snapshots yet</h2>
    <p class="dvqr-muted">Open an Operational Profile, choose Export Snapshot, then return here to compare saved snapshots.</p>
  </div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>DV Quick Run Snapshot Library</title>
  <style>${getSnapshotLibraryStyles()}</style>
</head>
<body>
  <main class="dvqr-snapshot-library">
    <section class="dvqr-hero">
      <div class="dvqr-hero-topline">
        <div>
          <div class="dvqr-eyebrow">${isProPreview ? "Pro Preview" : "Pro"} · Snapshot Library</div>
          <h1>Operational Snapshot Library</h1>
          <p class="dvqr-muted">Saved operational snapshots for Cross-Environment Diff. Snapshots are local investigation artifacts, not deployment authority.</p>
          ${isProPreview ? `<p class="dvqr-preview-note">🔒 Pro Preview: explore mock snapshots and sample drift. Real imports, saved-snapshot comparison, and JSON-file comparison unlock with DVQR Pro.</p>` : ""}
        </div>
        <div class="dvqr-toolbar">
          <button type="button" class="dvqr-button" data-action="refresh">Refresh</button>
          <button type="button" class="dvqr-button" data-action="${isProPreview ? "lockedAction" : "importSnapshots"}" data-locked-surface="Import Snapshots">Import Snapshots${isProPreview ? " 🔒" : ""}</button>
        </div>
      </div>
      <div class="dvqr-summary-grid">
        <div class="dvqr-summary-item"><span class="dvqr-summary-value">${entries.length}</span><span class="dvqr-summary-label">Saved snapshots</span></div>
        <div class="dvqr-summary-item"><span class="dvqr-summary-value">${environments.length}</span><span class="dvqr-summary-label">Environments</span></div>
        <div class="dvqr-summary-item"><span class="dvqr-summary-value">${entityCount}</span><span class="dvqr-summary-label">Subjects</span></div>
        <div class="dvqr-summary-item"><span class="dvqr-summary-value">${escapeHtml(formatSnapshotPickerTime(latest))}</span><span class="dvqr-summary-label">Latest capture</span></div>
      </div>
    </section>

    ${renderRecentComparisons(getVisibleRecentComparisons(recentComparisons, entries, isProPreview), isProPreview)}

    <section class="dvqr-card dvqr-selection-card">
      <h2>Build comparison</h2>
      <p class="dvqr-selection-summary">Select one source snapshot and one target snapshot. Then compare them in the operational diff surface. Different environments open as Cross-Environment Diff; same-environment snapshots open as Timeline Diff.</p>
      <div class="dvqr-selection-grid">
        <div class="dvqr-selection-box">
          <span class="dvqr-summary-label">Source</span>
          <div id="sourceSelection">No source selected</div>
        </div>
        <div class="dvqr-selection-box">
          <span class="dvqr-summary-label">Target</span>
          <div id="targetSelection">No target selected</div>
        </div>
      </div>
      <div class="dvqr-toolbar" style="justify-content:flex-start">
        <button type="button" class="dvqr-button dvqr-primary-button" data-action="compareSelected" disabled>Compare selected snapshots</button>
        <button type="button" class="dvqr-button" data-action="clearSelection">Clear selection</button>
      </div>
    </section>

    ${entries.length ? `<div class="dvqr-library-controls"><input class="dvqr-search-input" type="search" data-action="searchSnapshots" placeholder="Search snapshots by label, entity, environment, provider, or file path" aria-label="Search snapshots" /></div>` : ""}
    ${environmentTabs}
    <div class="dvqr-group-list">
      ${entries.length ? cards : emptyState}
    </div>
    ${renderSnapshotLibraryCommunityFooter(extensionVersion)}
  </main>
  <script nonce="${nonce}">${getSnapshotLibraryScript()}</script>
</body>
</html>`;
}

function renderRecentComparisons(recentComparisons: readonly RecentComparisonEntry[], isProPreview: boolean): string {
  if (!recentComparisons.length) {
    return "";
  }

  const groups = groupRecentComparisonsBySubject(recentComparisons);
  const heading = isProPreview ? "Recent sample comparisons" : "Recent comparisons";
  const description = isProPreview
    ? "Replay sample operational drift investigations from mock snapshot history. These are preview continuations, not deployment records."
    : "Replay recent operational drift investigations from local snapshot history. These are investigation continuations, not deployment records.";

  const markup = groups.map((group, index) => {
    const rows = group.entries.map((entry) => {
      const significance = [
        entry.highCount > 0 ? `${entry.highCount} high` : undefined,
        entry.mediumCount > 0 ? `${entry.mediumCount} medium` : undefined,
        entry.lowCount > 0 ? `${entry.lowCount} low` : undefined
      ].filter(Boolean).join(" · ");

      return `<div class="dvqr-recent-comparison-row" data-recent-comparison-id="${escapeHtml(entry.comparisonId)}">
      <div>
        <div class="dvqr-card-title">${escapeHtml(entry.sourceEnvironmentLabel)} → ${escapeHtml(entry.targetEnvironmentLabel)}</div>
        <div class="dvqr-row-meta">${escapeHtml(formatSnapshotPickerTime(entry.generatedAtIso))} · ${entry.differenceCount} difference${entry.differenceCount === 1 ? "" : "s"}${significance ? ` · ${escapeHtml(significance)}` : ""}${entry.unalignedSubjects ? " · Unaligned scope" : ""}</div>
      </div>
      <div class="dvqr-recent-actions">
        <button type="button" class="dvqr-button" data-action="replayComparison" data-source-snapshot-id="${escapeHtml(entry.sourceSnapshotId)}" data-target-snapshot-id="${escapeHtml(entry.targetSnapshotId)}">Replay comparison</button>
        <button type="button" class="dvqr-button dvqr-remove-recent-button" data-action="removeRecentComparison" data-comparison-id="${escapeHtml(entry.comparisonId)}">Remove</button>
      </div>
    </div>`;
    }).join("");

    const countLabel = `${group.entries.length} ${isProPreview ? "sample " : ""}comparison${group.entries.length === 1 ? "" : "s"}`;
    return `<details class="dvqr-recent-scope-group" ${index === 0 ? "open" : ""}>
      <summary>
        <strong>${escapeHtml(group.subjectLabel)}</strong>
        <span class="dvqr-recent-scope-count">${escapeHtml(countLabel)}</span>
        <span class="dvqr-recent-scope-toggle" aria-hidden="true"></span>
      </summary>
      <div class="dvqr-recent-scope-body">${rows}</div>
    </details>`;
  }).join("");

  return `<section class="dvqr-card dvqr-recent-comparisons">
    <div class="dvqr-recent-header">
      <div>
        <h2>${escapeHtml(heading)}</h2>
        <p class="dvqr-muted">${escapeHtml(description)}</p>
      </div>
    </div>
    <div class="dvqr-recent-list">${markup}</div>
  </section>`;
}

function groupRecentComparisonsBySubject(recentComparisons: readonly RecentComparisonEntry[]): readonly { readonly subjectLabel: string; readonly entries: readonly RecentComparisonEntry[] }[] {
  const groups = new Map<string, RecentComparisonEntry[]>();
  for (const entry of recentComparisons.slice(0, MAX_RECENT_COMPARISONS)) {
    const subjectLabel = entry.subjectLabel || "Operational comparison";
    const key = subjectLabel.trim().toLowerCase();
    const existing = groups.get(key) ?? [];
    existing.push(entry);
    groups.set(key, existing);
  }

  return Array.from(groups.values()).map((entries) => ({
    subjectLabel: entries[0]?.subjectLabel || "Operational comparison",
    entries
  }));
}

function renderSnapshotSubjectGroup(group: SnapshotSubjectGroup): string {
  const olderMarkup = group.older.length
    ? `<details class="dvqr-older-snapshots">
        <summary>${group.older.length} older snapshot${group.older.length === 1 ? "" : "s"}</summary>
        <div class="dvqr-older-snapshot-list">
          ${group.older.map((entry) => renderSnapshotLibraryRow(entry, false)).join("")}
        </div>
      </details>`
    : "";

  return `<details class="dvqr-card dvqr-subject-row" data-subject-key="${escapeHtml(group.groupKey)}" data-has-favourite="${group.hasFavourite ? "true" : "false"}" ${group.hasFavourite ? "open" : ""}>
    <summary>
      <div>
        <div class="dvqr-card-title">${escapeHtml(group.subjectLabel)}</div>
        <div class="dvqr-card-meta">Latest: ${escapeHtml(formatSnapshotPickerTime(group.latest.capturedAtIso))}</div>
      </div>
      <div class="dvqr-chip-row">
        ${group.hasFavourite ? `<span class="dvqr-chip dvqr-favourite-chip">★ Favourite</span>` : ""}
        <span class="dvqr-chip">${group.totalCount} snapshot${group.totalCount === 1 ? "" : "s"}</span>
        <span class="dvqr-chip">Latest shown</span>
        ${group.older.length ? `<button type="button" class="dvqr-button dvqr-quick-compare-button" data-action="compareLatestPrevious" data-latest-snapshot-id="${escapeHtml(group.latest.snapshotId)}" data-previous-snapshot-id="${escapeHtml(group.older[0].snapshotId)}">Compare latest ↔ previous</button>` : ""}
      </div>
    </summary>
    <div class="dvqr-subject-body">
      ${renderSnapshotLibraryRow(group.latest, true)}
      ${olderMarkup}
    </div>
  </details>`;
}

function renderSnapshotLibraryRow(entry: ComparisonSnapshotRegistryEntry, isLatest: boolean): string {
  const subject = entry.entityDisplayName ?? entry.entityLogicalName ?? "Operational snapshot";
  const displayLabel = entry.label && entry.label !== `${subject} · ${entry.environmentLabel}` ? entry.label : undefined;
  const selectionLabel = `${entry.environmentLabel} · ${displayLabel ?? subject}`;
  const isMock = entry.fileUri.startsWith("dvqr-mock://");
  const displayPath = isMock ? "Built-in Pro Preview snapshot" : vscode.Uri.parse(entry.fileUri).fsPath;
  const lockedAction = (label: string, surface: string): string => `<button type="button" class="dvqr-button" data-action="lockedAction" data-locked-surface="${escapeHtml(surface)}">${label} 🔒</button>`;
  return `<div class="dvqr-snapshot-row ${isLatest ? "is-latest" : ""} ${entry.isFavourite ? "is-favourite" : ""}" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-environment-label="${escapeHtml(entry.environmentLabel)}" data-subject-label="${escapeHtml(subject)}" data-file-path="${escapeHtml(displayPath)}" data-captured-at="${escapeHtml(formatSnapshotPickerTime(entry.capturedAtIso))}">
    <div>
      <div class="dvqr-card-title"><span data-role="snapshot-label">${escapeHtml(displayLabel ?? subject)}</span>${isLatest ? " · Latest" : ""}</div>
      <div class="dvqr-row-meta"><span data-role="snapshot-subject-prefix">${displayLabel ? escapeHtml(subject) + " · " : ""}</span>${escapeHtml(formatSnapshotPickerTime(entry.capturedAtIso))}</div>
    </div>
    <div>
      <div class="dvqr-chip-row">
        <span class="dvqr-chip dvqr-environment-chip">${escapeHtml(entry.environmentLabel)}</span>
        <span class="dvqr-chip">${escapeHtml(entry.sourceFeature)}</span>
        ${entry.evidenceTypes.map((type) => `<span class="dvqr-chip">${escapeHtml(type)}</span>`).join("")}
        <span class="dvqr-chip dvqr-favourite-chip" data-role="favourite-chip" ${entry.isFavourite ? "" : "hidden"}>★</span>
      </div>
      <div class="dvqr-card-detail">${escapeHtml(vscode.Uri.parse(entry.fileUri).fsPath)}</div>
    </div>
    <div class="dvqr-card-actions">
      ${isMock ? lockedAction("☆", "Favourites") : `<button type="button" class="dvqr-button dvqr-star-button" data-action="toggleFavourite" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-is-favourite="${entry.isFavourite ? "true" : "false"}" title="${entry.isFavourite ? "Remove favourite" : "Mark as favourite"}">${entry.isFavourite ? "★" : "☆"}</button>`}
      ${isMock ? lockedAction("Label", "Snapshot labels") : `<button type="button" class="dvqr-button" data-action="editLabel" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Label</button>`}
      <button type="button" class="dvqr-button" data-action="selectSource" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-label="${escapeHtml(selectionLabel)}">Source</button>
      <button type="button" class="dvqr-button" data-action="selectTarget" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-label="${escapeHtml(selectionLabel)}">Target</button>
      ${isMock ? lockedAction("Open JSON", "Opening real snapshot JSON") : `<button type="button" class="dvqr-button" data-action="revealFile" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Open JSON</button>`}
      ${isMock ? lockedAction("Delete", "Snapshot Library management") : `<button type="button" class="dvqr-button dvqr-delete-button" data-action="deleteSnapshot" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Delete</button>`}
    </div>
  </div>`;
}

function renderSnapshotLibraryCommunityFooter(extensionVersion: string): string {
  const feedbackUrl = `https://www.dvquickrun.com/feedback?version=${encodeURIComponent(extensionVersion)}`;
  return `<footer class="dvqr-community-footer">
    <span>Have feedback on Snapshot Library, Timeline Diff, or Cross-Environment Diff?</span>
    <a href="${escapeHtml(feedbackUrl)}">Share Feedback</a>
  </footer>`;
}

function getSnapshotLibraryScript(): string {
  return `
(function () {
  const vscode = typeof acquireVsCodeApi === 'function' ? acquireVsCodeApi() : undefined;
  let sourceId;
  let targetId;
  let sourceLabel;
  let targetLabel;
  let isComparing = false;
  let activeEnvironmentFilter = 'all';
  let searchQuery = '';

  function updateSelection() {
    document.getElementById('sourceSelection').textContent = sourceLabel || 'No source selected';
    document.getElementById('targetSelection').textContent = targetLabel || 'No target selected';

    document.querySelectorAll('[data-snapshot-id]').forEach((element) => {
      element.classList.toggle('is-source', element.getAttribute('data-snapshot-id') === sourceId);
      element.classList.toggle('is-target', element.getAttribute('data-snapshot-id') === targetId);
    });

    const button = document.querySelector('[data-action="compareSelected"]');
    button.disabled = isComparing || !(sourceId && targetId && sourceId !== targetId);
    button.textContent = isComparing ? 'Comparing snapshots...' : 'Compare selected snapshots';
  }

  function rowMatchesSearch(row) {
    if (!searchQuery) {
      return true;
    }

    return row.textContent.toLowerCase().includes(searchQuery);
  }

  function applyLibraryFilters() {
    const filter = activeEnvironmentFilter;
    document.querySelectorAll('[data-env-filter]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-env-filter') === filter);
    });

    document.querySelectorAll('[data-subject-key]').forEach((row) => {
      const rowHasFavourite = row.getAttribute('data-has-favourite') === 'true';
      const visibleByFavourite = filter !== 'favourites' || rowHasFavourite;
      row.classList.toggle('is-hidden', !(visibleByFavourite && rowMatchesSearch(row)));
    });

    document.querySelectorAll('[data-environment]').forEach((panel) => {
      const environment = panel.getAttribute('data-environment');
      const hasFavourite = panel.getAttribute('data-has-favourite') === 'true';
      const visibleByEnvironment = filter === 'all' || environment === filter || (filter === 'favourites' && hasFavourite);
      const hasVisibleSubject = Boolean(panel.querySelector('[data-subject-key]:not(.is-hidden)'));
      panel.classList.toggle('is-hidden', !(visibleByEnvironment && hasVisibleSubject));
    });
  }

  function activateEnvironment(filter) {
    activeEnvironmentFilter = filter;
    applyLibraryFilters();
  }

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.getAttribute('data-action') === 'searchSnapshots') {
      searchQuery = target.value.trim().toLowerCase();
      applyLibraryFilters();
    }
  });

  document.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) {
      return;
    }

    const envFilter = target.getAttribute('data-env-filter');
    if (envFilter) {
      activateEnvironment(envFilter);
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action) {
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action === 'replayComparison') {
      const sourceSnapshotId = target.getAttribute('data-source-snapshot-id');
      const targetSnapshotId = target.getAttribute('data-target-snapshot-id');
      if (sourceSnapshotId && targetSnapshotId && !isComparing) {
        sourceId = sourceSnapshotId;
        targetId = targetSnapshotId;
        const sourceRow = getRow(sourceSnapshotId);
        const targetRow = getRow(targetSnapshotId);
        sourceLabel = sourceRow ? (sourceRow.getAttribute('data-environment-label') || 'Source') + ' · ' + (sourceRow.getAttribute('data-subject-label') || 'Snapshot') : 'Source snapshot';
        targetLabel = targetRow ? (targetRow.getAttribute('data-environment-label') || 'Target') + ' · ' + (targetRow.getAttribute('data-subject-label') || 'Snapshot') : 'Target snapshot';
        isComparing = true;
        updateSelection();
        vscode && vscode.postMessage({ type: 'replayComparison', sourceSnapshotId, targetSnapshotId });
      }
      return;
    }

    if (action === 'compareLatestPrevious') {
      const sourceSnapshotId = target.getAttribute('data-previous-snapshot-id');
      const targetSnapshotId = target.getAttribute('data-latest-snapshot-id');
      if (sourceSnapshotId && targetSnapshotId && !isComparing) {
        sourceId = sourceSnapshotId;
        targetId = targetSnapshotId;
        const previousRow = getRow(sourceSnapshotId);
        const latestRow = getRow(targetSnapshotId);
        sourceLabel = previousRow ? (previousRow.getAttribute('data-environment-label') || 'Source') + ' · ' + (previousRow.getAttribute('data-subject-label') || 'Previous') + ' previous' : 'Previous snapshot';
        targetLabel = latestRow ? (latestRow.getAttribute('data-environment-label') || 'Target') + ' · ' + (latestRow.getAttribute('data-subject-label') || 'Latest') + ' latest' : 'Latest snapshot';
        isComparing = true;
        updateSelection();
        vscode && vscode.postMessage({ type: 'compareSnapshots', sourceSnapshotId, targetSnapshotId });
      }
      return;
    }

    if (action === 'lockedAction') {
      vscode && vscode.postMessage({ type: 'lockedAction', surface: target.getAttribute('data-locked-surface') || 'Cross-Environment Diff' });
      return;
    }

    if (action === 'removeRecentComparison') {
      const comparisonId = target.getAttribute('data-comparison-id');
      if (comparisonId) {
        vscode && vscode.postMessage({ type: 'removeRecentComparison', comparisonId });
      }
      return;
    }

    if (action === 'refresh' || action === 'openFileCompare' || action === 'importSnapshots') {
      vscode && vscode.postMessage({ type: action });
      return;
    }

    if (action === 'clearSelection') {
      sourceId = undefined;
      targetId = undefined;
      sourceLabel = undefined;
      targetLabel = undefined;
      updateSelection();
      return;
    }

    if (action === 'compareSelected') {
      if (sourceId && targetId && sourceId !== targetId && !isComparing) {
        isComparing = true;
        updateSelection();
        vscode && vscode.postMessage({ type: 'compareSnapshots', sourceSnapshotId: sourceId, targetSnapshotId: targetId });
      }
      return;
    }

    const snapshotId = target.getAttribute('data-snapshot-id');
    const label = target.getAttribute('data-label') || snapshotId;
    if (!snapshotId) {
      return;
    }

    if (action === 'selectSource') {
      sourceId = snapshotId;
      sourceLabel = label || snapshotId;
      if (targetId === sourceId) {
        targetId = undefined;
        targetLabel = undefined;
      }
      updateSelection();
      return;
    }

    if (action === 'selectTarget') {
      targetId = snapshotId;
      targetLabel = label || snapshotId;
      if (sourceId === targetId) {
        sourceId = undefined;
        sourceLabel = undefined;
      }
      updateSelection();
      return;
    }

    if (action === 'revealFile') {
      vscode && vscode.postMessage({ type: 'revealFile', snapshotId });
      return;
    }

    if (action === 'editLabel') {
      vscode && vscode.postMessage({ type: 'editLabel', snapshotId });
      return;
    }

    if (action === 'toggleFavourite') {
      vscode && vscode.postMessage({
        type: 'toggleFavourite',
        snapshotId,
        isFavourite: target.getAttribute('data-is-favourite') !== 'true'
      });
      return;
    }

    if (action === 'deleteSnapshot') {
      vscode && vscode.postMessage({ type: 'deleteSnapshot', snapshotId });
      return;
    }
  });

  function getRow(snapshotId) {
    return document.querySelector('.dvqr-snapshot-row[data-snapshot-id="' + snapshotId + '"]');
  }

  function updateActionLabels(snapshotId, nextLabel) {
    document.querySelectorAll('[data-snapshot-id="' + snapshotId + '"][data-label]').forEach((button) => {
      const row = getRow(snapshotId);
      const environment = row && row.getAttribute('data-environment-label');
      button.setAttribute('data-label', environment ? environment + ' · ' + nextLabel : nextLabel);
    });

    if (sourceId === snapshotId) {
      const row = getRow(snapshotId);
      const environment = row && row.getAttribute('data-environment-label');
      sourceLabel = environment ? environment + ' · ' + nextLabel : nextLabel;
    }

    if (targetId === snapshotId) {
      const row = getRow(snapshotId);
      const environment = row && row.getAttribute('data-environment-label');
      targetLabel = environment ? environment + ' · ' + nextLabel : nextLabel;
    }
  }

  function pruneEmptyContainers(olderList, subjectRow) {
    if (olderList && !olderList.querySelector('.dvqr-snapshot-row')) {
      olderList.closest('.dvqr-older-snapshots')?.remove();
    }

    if (subjectRow && !subjectRow.querySelector('.dvqr-snapshot-row')) {
      subjectRow.remove();
    }

    document.querySelectorAll('.dvqr-env-panel').forEach((panel) => {
      if (!panel.querySelector('.dvqr-subject-row')) {
        panel.remove();
      }
    });
  }

  function updateFavouriteContainers(row) {
    const subjectRow = row.closest('.dvqr-subject-row');
    if (subjectRow) {
      const hasFavourite = Boolean(subjectRow.querySelector('.dvqr-snapshot-row.is-favourite'));
      subjectRow.setAttribute('data-has-favourite', hasFavourite ? 'true' : 'false');
    }

    const panel = row.closest('.dvqr-env-panel');
    if (panel) {
      const hasFavourite = Boolean(panel.querySelector('.dvqr-snapshot-row.is-favourite'));
      panel.setAttribute('data-has-favourite', hasFavourite ? 'true' : 'false');
    }

    applyLibraryFilters();
  }

  window.addEventListener('message', (event) => {
    const message = event.data || {};
    if (message.type === 'compareComplete' || message.type === 'compareFailed') {
      isComparing = false;
      updateSelection();
    }

    if (message.type === 'labelUpdated' && message.snapshotId && message.label) {
      const row = getRow(message.snapshotId);
      if (row) {
        const label = row.querySelector('[data-role="snapshot-label"]');
        const subjectPrefix = row.querySelector('[data-role="snapshot-subject-prefix"]');
        if (label) {
          label.textContent = message.label;
        }
        if (subjectPrefix) {
          const subject = row.getAttribute('data-subject-label') || '';
          subjectPrefix.textContent = subject ? subject + ' · ' : '';
        }
        updateActionLabels(message.snapshotId, message.label);
        updateSelection();
      }
    }

    if (message.type === 'favouriteUpdated' && message.snapshotId) {
      const row = getRow(message.snapshotId);
      if (row) {
        const isFavourite = message.isFavourite === true;
        row.classList.toggle('is-favourite', isFavourite);
        const button = row.querySelector('[data-action="toggleFavourite"]');
        if (button) {
          button.textContent = isFavourite ? '★' : '☆';
          button.setAttribute('data-is-favourite', isFavourite ? 'true' : 'false');
          button.setAttribute('title', isFavourite ? 'Remove favourite' : 'Mark as favourite');
        }
        const chip = row.querySelector('[data-role="favourite-chip"]');
        if (chip) {
          chip.toggleAttribute('hidden', !isFavourite);
        }
        updateFavouriteContainers(row);
      }
    }

    if (message.type === 'recentComparisonRemoved' && message.comparisonId) {
      document.querySelector('[data-recent-comparison-id="' + message.comparisonId + '"]')?.remove();
      document.querySelectorAll('.dvqr-recent-scope-group').forEach((group) => {
        if (!group.querySelector('.dvqr-recent-comparison-row')) {
          group.remove();
        }
      });
      const recentSection = document.querySelector('.dvqr-recent-comparisons');
      if (recentSection && !recentSection.querySelector('.dvqr-recent-comparison-row')) {
        recentSection.remove();
      }
    }

    if (message.type === 'snapshotDeleted' && message.snapshotId) {
      const row = getRow(message.snapshotId);
      if (row) {
        if (sourceId === message.snapshotId) {
          sourceId = undefined;
          sourceLabel = undefined;
        }
        if (targetId === message.snapshotId) {
          targetId = undefined;
          targetLabel = undefined;
        }
        const olderList = row.closest('.dvqr-older-snapshot-list');
        const subjectRow = row.closest('.dvqr-subject-row');
        row.remove();
        pruneEmptyContainers(olderList, subjectRow);
        updateSelection();
      }
    }
  });

  updateSelection();
})();`;
}

