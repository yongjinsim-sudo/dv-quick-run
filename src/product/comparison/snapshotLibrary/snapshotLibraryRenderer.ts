import * as vscode from "vscode";
import type { ComparisonSnapshotRegistryEntry, SnapshotWorkspaceResolution } from "../index.js";
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

function isWorkspaceSnapshot(entry: ComparisonSnapshotRegistryEntry, workspaceResolution: SnapshotWorkspaceResolution | undefined): boolean {
  if (!workspaceResolution?.snapshotsRoot || entry.fileUri.startsWith("dvqr-mock://")) {
    return false;
  }

  const root = workspaceResolution.snapshotsRoot.fsPath.replace(/\\/g, "/").toLowerCase();
  const filePath = vscode.Uri.parse(entry.fileUri).fsPath.replace(/\\/g, "/").toLowerCase();
  return filePath === root || filePath.startsWith(`${root}/`);
}

function formatCountLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
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
.dvqr-filter-summary {
  align-items: center;
  color: var(--vscode-descriptionForeground);
  display: flex;
  flex-wrap: wrap;
  font-size: 12px;
  gap: 6px;
}

.dvqr-filter-chip {
  border: 1px solid var(--vscode-button-border, var(--vscode-panel-border));
  border-radius: 999px;
  color: var(--vscode-foreground);
  display: inline-flex;
  gap: 6px;
  padding: 2px 8px;
}

.dvqr-link-button {
  background: transparent;
  border: 0;
  color: var(--vscode-textLink-foreground, var(--vscode-button-background));
  cursor: pointer;
  font: inherit;
  padding: 0;
}

.dvqr-snapshot-row.is-hidden {
  display: none;
}

.dvqr-timeline-ready-chip {
  border-color: color-mix(in srgb, var(--vscode-button-background) 75%, var(--vscode-panel-border));
}

.dvqr-workspace-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin: 6px 0;
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

.dvqr-view-toggle {
  align-items: center;
  display: inline-flex;
  gap: 4px;
}

.dvqr-view-toggle .dvqr-button {
  font-size: 12px;
  padding: 3px 8px;
}

.dvqr-view-toggle .dvqr-button.is-active {
  background: var(--vscode-button-background);
  color: var(--vscode-button-foreground);
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
  border-left: 4px solid var(--vscode-panel-border);
  border-radius: 10px;
  display: grid;
  gap: 6px;
  grid-template-columns: auto minmax(180px, 1fr) minmax(210px, 1.2fr) auto;
  padding: 3px 5px;
}

.dvqr-snapshot-row.is-selected {
  border-left-color: var(--vscode-button-background);
  background: color-mix(in srgb, var(--vscode-button-background) 8%, var(--vscode-editorWidget-background));
}

.dvqr-snapshot-row.is-source {
  border-left-color: #4fc1ff;
}

.dvqr-snapshot-row.is-target {
  border-left-color: #cca700;
}

.dvqr-snapshot-row.is-source .dvqr-selection-role::after {
  content: "Source";
}

.dvqr-snapshot-row.is-target .dvqr-selection-role::after {
  content: "Target";
}

.dvqr-selection-role::after {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 999px;
  color: var(--vscode-descriptionForeground);
  display: inline-block;
  font-size: 10px;
  margin-left: 4px;
  padding: 0 5px;
}

.dvqr-snapshot-library.is-compact-view .dvqr-snapshot-row {
  border-left-width: 6px;
  cursor: pointer;
  grid-template-columns: auto minmax(220px, 1fr) auto;
  padding: 3px 5px;
}

.dvqr-snapshot-library.is-compact-view .dvqr-snapshot-row:not(.is-selected) {
  border-left-color: color-mix(in srgb, var(--vscode-button-background) 22%, var(--vscode-panel-border));
}

.dvqr-snapshot-library.is-compact-view .dvqr-snapshot-row.is-selected {
  border-left-color: var(--vscode-button-background);
  box-shadow: inset 3px 0 0 color-mix(in srgb, var(--vscode-button-background) 70%, transparent);
}

.dvqr-snapshot-library.is-compact-view .dvqr-snapshot-row:hover {
  background: color-mix(in srgb, var(--vscode-button-background) 6%, var(--vscode-editorWidget-background));
}

.dvqr-snapshot-library.is-compact-view .dvqr-snapshot-metadata,
.dvqr-snapshot-library.is-compact-view .dvqr-card-detail,
.dvqr-snapshot-library.is-compact-view .dvqr-card-actions .dvqr-button:not(.dvqr-star-button) {
  display: none;
}

.dvqr-snapshot-library.is-compact-view .dvqr-card-actions {
  gap: 3px;
}

.dvqr-snapshot-library.is-compact-view .dvqr-card-title {
  font-size: 13px;
}

.dvqr-snapshot-library.is-compact-view .dvqr-row-meta {
  font-size: 11px;
}

.dvqr-snapshot-select {
  align-items: center;
  display: inline-flex;
  gap: 5px;
  white-space: nowrap;
}

.dvqr-snapshot-select input {
  margin: 0;
}

.dvqr-selected-list {
  display: grid;
  gap: 4px;
  margin: 6px 0;
  max-height: 176px;
  overflow-y: auto;
  padding-right: 4px;
}

.dvqr-selected-item {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  padding: 5px 7px;
}

.dvqr-timeline-placeholder {
  border: 1px dashed var(--vscode-panel-border);
  border-radius: 8px;
  color: var(--vscode-descriptionForeground);
  padding: 6px 8px;
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
  max-height: 780px;
  overflow-y: auto;
  padding-right: 4px;
}

.dvqr-snapshot-library.is-compact-view .dvqr-older-snapshot-list {
  max-height: 430px;
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

.dvqr-no-results {
  margin-top: 6px;
}

.dvqr-preview-note {
  border: 1px solid var(--vscode-panel-border);
  border-radius: 8px;
  color: var(--vscode-descriptionForeground);
  margin: 6px 0 0;
  padding: 6px 8px;
}

.dvqr-workspace-card {
  border-left: 4px solid color-mix(in srgb, var(--vscode-button-background) 55%, var(--vscode-panel-border));
  margin-bottom: 5px;
}

.dvqr-workspace-grid {
  align-items: start;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(180px, 1fr) auto;
}

.dvqr-workspace-actions {
  align-content: start;
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, max-content));
  justify-content: end;
}

.dvqr-workspace-actions .dvqr-button {
  min-height: 0;
  padding: 5px 9px;
  white-space: nowrap;
}

.dvqr-workspace-path {
  word-break: break-all;
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
  extensionVersion = "unknown",
  workspaceResolution?: SnapshotWorkspaceResolution
): string {
  const cspSource = webview.cspSource;
  const nonce = String(Date.now());
  const environments = groupSnapshotEntriesByEnvironment(entries);
  const entityCount = new Set(entries.map((entry) => entry.entityLogicalName ?? entry.entityDisplayName ?? entry.label)).size;
  const latest = entries[0]?.capturedAtIso;
  const favouriteCount = entries.filter((entry) => entry.isFavourite).length;
  const workspacePanel = renderSnapshotWorkspacePanel(workspaceResolution, isProPreview, entries, recentComparisons);

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
    <h2>No evidence snapshots yet</h2>
    <p class="dvqr-muted">Use Capture Snapshot to save evidence directly into this workspace, or import existing snapshot JSON files. Export Snapshot remains available from Operational Profiles for portable Save As workflows.</p>
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
          <p class="dvqr-muted">Capture, organise, select, and compare local Dataverse evidence snapshots. Evidence workspaces are local investigation artifacts, not deployment authority.</p>
          ${isProPreview ? `<p class="dvqr-preview-note">🔒 Pro Preview: explore mock snapshots and sample drift. Real imports, saved-snapshot comparison, and JSON-file comparison unlock with DVQR Pro.</p>` : ""}
        </div>
        <div class="dvqr-toolbar">
          <button type="button" class="dvqr-button" data-action="refresh">Refresh</button>
          <button type="button" class="dvqr-button" data-action="${isProPreview ? "lockedAction" : "captureSnapshot"}" data-locked-surface="Capture Snapshot">Capture Snapshot${isProPreview ? " 🔒" : ""}</button>
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

    ${workspacePanel}

    ${renderRecentComparisons(getVisibleRecentComparisons(recentComparisons, entries, isProPreview), isProPreview)}

    <section class="dvqr-card dvqr-selection-card">
      <h2>Evidence selection</h2>
      <p class="dvqr-selection-summary">Select snapshots from the library. Two selected snapshots can be compared now. Three or more selected snapshots prepare the future v0.13.x timeline reconstruction workflow.</p>
      <div class="dvqr-selection-grid">
        <div class="dvqr-selection-box">
          <span class="dvqr-summary-label">Selection</span>
          <div id="selectionCounter">0 selected</div>
        </div>
        <div class="dvqr-selection-box">
          <span class="dvqr-summary-label">Next action</span>
          <div id="selectionMode">Select two snapshots to compare.</div>
        </div>
      </div>
      <div id="selectedSnapshotList" class="dvqr-selected-list"></div>
      <div id="timelinePlaceholder" class="dvqr-timeline-placeholder" hidden>Timeline reconstruction is coming in v0.13.x. Keep selecting snapshots now; DVQR will use this same evidence selection model later.</div>
      <div class="dvqr-toolbar" style="justify-content:flex-start">
        <button type="button" class="dvqr-button dvqr-primary-button" data-action="compareSelected" disabled>Compare selected snapshots</button>
        <button type="button" class="dvqr-button" data-action="clearSelection">Clear selection</button>
      </div>
    </section>

    ${entries.length ? `<div class="dvqr-library-controls">
      <input class="dvqr-search-input" type="search" data-action="searchSnapshots" placeholder="Search snapshots by label, entity, environment, provider, capture date, favourite, or path" aria-label="Search snapshots" />
      <div class="dvqr-filter-summary">
        <span id="searchResultSummary">Showing all ${entries.length} snapshots</span>
        <span id="activeSearchChip" class="dvqr-filter-chip" hidden>Search: <span data-role="active-search-term"></span> <button type="button" class="dvqr-link-button" data-action="clearSearch" title="Clear search">×</button></span>
      </div>
      <div class="dvqr-view-toggle" aria-label="Snapshot list view mode">
        <button type="button" class="dvqr-button is-active" data-action="setSnapshotView" data-view-mode="detailed">Detailed</button>
        <button type="button" class="dvqr-button" data-action="setSnapshotView" data-view-mode="compact">Compact select</button>
      </div>
    </div>` : ""}
    ${environmentTabs}
    <div class="dvqr-group-list">
      ${entries.length ? cards : emptyState}
    </div>
    ${entries.length ? `<div id="noSnapshotResults" class="dvqr-empty-state dvqr-no-results" hidden><h2>No matching snapshots</h2><p class="dvqr-muted">Adjust the search text or environment filter. Selected snapshots remain in Evidence selection even when hidden by filters.</p></div>` : ""}
    ${renderSnapshotLibraryCommunityFooter(extensionVersion)}
  </main>
  <script nonce="${nonce}">${getSnapshotLibraryScript()}</script>
</body>
</html>`;
}

function renderSnapshotWorkspacePanel(
  workspaceResolution: SnapshotWorkspaceResolution | undefined,
  isProPreview: boolean,
  entries: readonly ComparisonSnapshotRegistryEntry[],
  recentComparisons: readonly RecentComparisonEntry[]
): string {
  const available = workspaceResolution?.available === true && Boolean(workspaceResolution.snapshotsRoot);
  const pathLabel = available
    ? workspaceResolution.snapshotsRoot?.fsPath ?? "Snapshot workspace"
    : workspaceResolution?.reason ?? "Workspace unavailable. Open a VS Code workspace folder to enable .dvqr evidence storage.";
  const workspaceSnapshotCount = entries.filter((entry) => isWorkspaceSnapshot(entry, workspaceResolution)).length;
  const externalSnapshotCount = entries.length - workspaceSnapshotCount;

  const actions = isProPreview
    ? `<button type="button" class="dvqr-button" data-action="lockedAction" data-locked-surface="Snapshot Workspace">Open Snapshot Folder 🔒</button>`
    : available
      ? `<button type="button" class="dvqr-button" data-action="openSnapshotWorkspace" title="Open the workspace snapshots folder">Open Snapshot Folder</button>
         <button type="button" class="dvqr-button" data-action="openComparisonWorkspace" title="Open the workspace comparisons folder">Open Comparisons Folder</button>
         <button type="button" class="dvqr-button" data-action="openReportWorkspace" title="Open the workspace reports folder">Open Reports Folder</button>
         <button type="button" class="dvqr-button" data-action="copySnapshotWorkspacePath" title="Copy the workspace snapshots folder path">Copy Workspace Path</button>`
      : `<button type="button" class="dvqr-button dvqr-primary-button" data-action="createEvidenceWorkspace" title="Create a Git-friendly DVQR evidence workspace">Create Evidence Workspace</button>`;

  return `<section class="dvqr-card dvqr-workspace-card">
    <div class="dvqr-workspace-grid">
      <div>
        <h2>Evidence workspace</h2>
        <p class="dvqr-muted">${available ? "Workspace-backed snapshots use a Git-friendly local evidence tree. DVQR organises evidence; it does not create remediation authority." : "Create an Evidence Workspace to capture snapshots into a Git-friendly local investigation folder."}</p>
        <div class="dvqr-workspace-stats">
          <span class="dvqr-chip">${formatCountLabel(workspaceSnapshotCount, "workspace snapshot")}</span>
          <span class="dvqr-chip">${formatCountLabel(externalSnapshotCount, "external snapshot")}</span>
          <span class="dvqr-chip">${formatCountLabel(recentComparisons.length, "recent comparison")}</span>
          <span class="dvqr-chip" title="The workspace reports folder is available for generated investigation artifacts.">Reports folder ready</span>
        </div>
        <div class="dvqr-card-detail dvqr-workspace-path">${escapeHtml(pathLabel)}</div>
      </div>
      <div class="dvqr-workspace-actions">${actions}</div>
    </div>
  </section>`;
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
        ${group.totalCount >= 3 ? `<span class="dvqr-chip dvqr-timeline-ready-chip" title="This subject has 3+ snapshots and is ready for the future v0.13.x timeline reconstruction workflow.">Timeline Ready</span>` : ""}
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
  const selectionLabel = `${entry.environmentLabel} · ${displayLabel ?? subject} · ${formatSnapshotPickerTime(entry.capturedAtIso)}`;
  const isMock = entry.fileUri.startsWith("dvqr-mock://");
  const displayPath = isMock ? "Built-in Pro Preview snapshot" : vscode.Uri.parse(entry.fileUri).fsPath;
  const searchIndex = [
    entry.snapshotId,
    entry.label,
    subject,
    entry.entityLogicalName,
    entry.entityDisplayName,
    entry.environmentLabel,
    entry.sourceFeature,
    entry.capturedAtIso,
    formatSnapshotPickerTime(entry.capturedAtIso),
    entry.isFavourite ? "favourite favorite starred" : "",
    displayPath,
    ...entry.evidenceTypes
  ].filter(Boolean).join(" ");
  const lockedAction = (label: string, surface: string): string => `<button type="button" class="dvqr-button" data-action="lockedAction" data-locked-surface="${escapeHtml(surface)}">${label} 🔒</button>`;
  return `<div class="dvqr-snapshot-row ${isLatest ? "is-latest" : ""} ${entry.isFavourite ? "is-favourite" : ""}" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-selection-label="${escapeHtml(selectionLabel)}" data-environment-label="${escapeHtml(entry.environmentLabel)}" data-subject-label="${escapeHtml(subject)}" data-file-path="${escapeHtml(displayPath)}" data-captured-at="${escapeHtml(formatSnapshotPickerTime(entry.capturedAtIso))}" data-search-index="${escapeHtml(searchIndex)}">
    <label class="dvqr-snapshot-select" title="Select snapshot for comparison or future timeline reconstruction">
      <input type="checkbox" data-action="toggleSnapshotSelection" data-snapshot-id="${escapeHtml(entry.snapshotId)}" data-label="${escapeHtml(selectionLabel)}" />
      <span>Select</span><span class="dvqr-selection-role" aria-hidden="true"></span>
    </label>
    <div>
      <div class="dvqr-card-title"><span data-role="snapshot-label">${escapeHtml(displayLabel ?? subject)}</span>${isLatest ? " · Latest" : ""}</div>
      <div class="dvqr-row-meta"><span data-role="snapshot-subject-prefix">${displayLabel ? escapeHtml(subject) + " · " : ""}</span>${escapeHtml(formatSnapshotPickerTime(entry.capturedAtIso))}</div>
    </div>
    <div class="dvqr-snapshot-metadata">
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
      ${isMock ? lockedAction("Open JSON", "Opening real snapshot JSON") : `<button type="button" class="dvqr-button" data-action="revealFile" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Open JSON</button>`}
      ${isMock ? lockedAction("Reveal", "Opening real snapshot JSON") : `<button type="button" class="dvqr-button" data-action="revealSnapshotInExplorer" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Reveal</button>`}
      ${isMock ? lockedAction("Copy Path", "Opening real snapshot JSON") : `<button type="button" class="dvqr-button" data-action="copySnapshotPath" data-snapshot-id="${escapeHtml(entry.snapshotId)}">Copy Path</button>`}
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
  let selectedSnapshots = [];
  let isComparing = false;
  let activeEnvironmentFilter = 'all';
  let searchQuery = '';
  let snapshotViewMode = 'detailed';

  function uniqueSelectedSnapshots() {
    const seen = new Set();
    selectedSnapshots = selectedSnapshots.filter((item) => {
      if (!item || !item.id || seen.has(item.id)) {
        return false;
      }
      seen.add(item.id);
      return true;
    });
  }

  function getRow(snapshotId) {
    return document.querySelector('.dvqr-snapshot-row[data-snapshot-id="' + snapshotId + '"]');
  }

  function getSelectionModeText(count) {
    if (count === 0) {
      return 'Select two snapshots to compare.';
    }
    if (count === 1) {
      return 'One snapshot selected. Select one more snapshot to compare.';
    }
    if (count === 2) {
      const first = getRow(selectedSnapshots[0].id);
      const second = getRow(selectedSnapshots[1].id);
      const firstEnv = first && first.getAttribute('data-environment-label');
      const secondEnv = second && second.getAttribute('data-environment-label');
      return firstEnv && secondEnv && firstEnv === secondEnv
        ? 'Two snapshots selected. Compare Selected will open Timeline Diff.'
        : 'Two snapshots selected. Compare Selected will open Cross-Environment Diff.';
    }
    return count + ' snapshots selected. Timeline reconstruction is coming in v0.13.x.';
  }

  function updateSelection() {
    uniqueSelectedSnapshots();
    const count = selectedSnapshots.length;
    const counter = document.getElementById('selectionCounter');
    const mode = document.getElementById('selectionMode');
    const list = document.getElementById('selectedSnapshotList');
    const timelinePlaceholder = document.getElementById('timelinePlaceholder');

    if (counter) {
      counter.textContent = count + ' selected';
    }
    if (mode) {
      mode.textContent = getSelectionModeText(count);
    }
    if (timelinePlaceholder) {
      timelinePlaceholder.hidden = count < 3;
    }
    if (list) {
      list.innerHTML = selectedSnapshots.length
        ? selectedSnapshots.map((item, index) => '<div class="dvqr-selected-item"><strong>' + (index + 1) + '.</strong> ' + escapeHtml(item.label || item.id) + '</div>').join('')
        : '<div class="dvqr-row-meta">No snapshots selected.</div>';
    }

    document.querySelectorAll('.dvqr-snapshot-row[data-snapshot-id]').forEach((element) => {
      const snapshotId = element.getAttribute('data-snapshot-id');
      const selectedIndex = selectedSnapshots.findIndex((item) => item.id === snapshotId);
      element.classList.toggle('is-selected', selectedIndex >= 0);
      element.classList.toggle('is-source', selectedIndex === 0);
      element.classList.toggle('is-target', selectedIndex === 1);
    });

    document.querySelectorAll('[data-action="toggleSnapshotSelection"]').forEach((element) => {
      const checkbox = element;
      if (checkbox instanceof HTMLInputElement) {
        checkbox.checked = selectedSnapshots.some((item) => item.id === checkbox.getAttribute('data-snapshot-id'));
      }
    });

    const button = document.querySelector('[data-action="compareSelected"]');
    if (button) {
      button.disabled = isComparing || count !== 2;
      button.textContent = isComparing ? 'Comparing snapshots...' : (count > 2 ? 'Timeline reconstruction coming in v0.13.x' : 'Compare selected snapshots');
    }
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function rowMatchesSearch(row) {
    if (!searchQuery) {
      return true;
    }

    const index = (row.getAttribute('data-search-index') || row.textContent || '').toLowerCase();
    return index.includes(searchQuery);
  }

  function updateSearchSummary() {
    const rows = Array.from(document.querySelectorAll('.dvqr-snapshot-row[data-snapshot-id]'));
    const visibleRows = rows.filter((row) => !row.classList.contains('is-hidden'));
    const summary = document.getElementById('searchResultSummary');
    const chip = document.getElementById('activeSearchChip');
    const term = chip && chip.querySelector('[data-role="active-search-term"]');

    if (summary) {
      summary.textContent = searchQuery
        ? 'Showing ' + visibleRows.length + ' of ' + rows.length + ' snapshots'
        : 'Showing all ' + rows.length + ' snapshots';
    }
    if (chip) {
      chip.hidden = !searchQuery;
    }
    if (term) {
      term.textContent = searchQuery;
    }
  }

  function applyLibraryFilters() {
    const filter = activeEnvironmentFilter;
    document.querySelectorAll('[data-env-filter]').forEach((tab) => {
      tab.classList.toggle('is-active', tab.getAttribute('data-env-filter') === filter);
    });

    document.querySelectorAll('.dvqr-snapshot-row[data-snapshot-id]').forEach((row) => {
      const rowEnv = row.getAttribute('data-environment-label');
      const rowFavourite = row.classList.contains('is-favourite');
      const visibleByEnvironment = filter === 'all' || rowEnv === filter || (filter === 'favourites' && rowFavourite);
      row.classList.toggle('is-hidden', !(visibleByEnvironment && rowMatchesSearch(row)));
    });

    document.querySelectorAll('[data-subject-key]').forEach((row) => {
      const hasVisibleSnapshot = Boolean(row.querySelector('.dvqr-snapshot-row[data-snapshot-id]:not(.is-hidden)'));
      row.classList.toggle('is-hidden', !hasVisibleSnapshot);
    });

    document.querySelectorAll('[data-environment]').forEach((panel) => {
      const hasVisibleSubject = Boolean(panel.querySelector('[data-subject-key]:not(.is-hidden)'));
      panel.classList.toggle('is-hidden', !hasVisibleSubject);
    });

    const noResults = document.getElementById('noSnapshotResults');
    if (noResults) {
      const anyVisibleSnapshot = Boolean(document.querySelector('.dvqr-snapshot-row[data-snapshot-id]:not(.is-hidden)'));
      noResults.hidden = anyVisibleSnapshot;
    }

    updateSearchSummary();
  }

  function setSnapshotViewMode(mode) {
    snapshotViewMode = mode === 'compact' ? 'compact' : 'detailed';
    const root = document.querySelector('.dvqr-snapshot-library');
    if (root) {
      root.classList.toggle('is-compact-view', snapshotViewMode === 'compact');
    }
    document.querySelectorAll('[data-action="setSnapshotView"]').forEach((button) => {
      button.classList.toggle('is-active', button.getAttribute('data-view-mode') === snapshotViewMode);
    });
  }

  function activateEnvironment(filter) {
    activeEnvironmentFilter = filter;
    applyLibraryFilters();
  }

  function toggleSnapshotSelection(snapshotId, label, checked) {
    if (checked) {
      selectedSnapshots.push({ id: snapshotId, label: label || snapshotId });
    } else {
      selectedSnapshots = selectedSnapshots.filter((item) => item.id !== snapshotId);
    }
    updateSelection();
  }

  document.addEventListener('input', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) {
      return;
    }

    if (target.getAttribute('data-action') === 'searchSnapshots') {
      searchQuery = target.value.trim().toLowerCase();
      applyLibraryFilters();
      return;
    }

    if (target.getAttribute('data-action') === 'toggleSnapshotSelection') {
      const snapshotId = target.getAttribute('data-snapshot-id');
      const label = target.getAttribute('data-label') || snapshotId;
      if (snapshotId) {
        toggleSnapshotSelection(snapshotId, label, target.checked);
      }
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

    const compactSelectableRow = target.closest('.dvqr-snapshot-row[data-snapshot-id]');
    if (snapshotViewMode === 'compact' && compactSelectableRow && !target.closest('button,input,a,label,summary')) {
      const snapshotId = compactSelectableRow.getAttribute('data-snapshot-id');
      const label = compactSelectableRow.getAttribute('data-selection-label') || snapshotId;
      const isSelected = selectedSnapshots.some((item) => item.id === snapshotId);
      if (snapshotId) {
        toggleSnapshotSelection(snapshotId, label, !isSelected);
      }
      return;
    }

    const action = target.getAttribute('data-action');
    if (!action) {
      return;
    }

    if (action === 'toggleSnapshotSelection') {
      return;
    }

    if (action === 'setSnapshotView') {
      setSnapshotViewMode(target.getAttribute('data-view-mode'));
      return;
    }

    event.preventDefault();
    event.stopPropagation();

    if (action === 'replayComparison') {
      const sourceSnapshotId = target.getAttribute('data-source-snapshot-id');
      const targetSnapshotId = target.getAttribute('data-target-snapshot-id');
      if (sourceSnapshotId && targetSnapshotId && !isComparing) {
        selectedSnapshots = [
          { id: sourceSnapshotId, label: 'Source snapshot' },
          { id: targetSnapshotId, label: 'Target snapshot' }
        ];
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
        const previousRow = getRow(sourceSnapshotId);
        const latestRow = getRow(targetSnapshotId);
        selectedSnapshots = [
          { id: sourceSnapshotId, label: previousRow ? previousRow.getAttribute('data-selection-label') || 'Previous snapshot' : 'Previous snapshot' },
          { id: targetSnapshotId, label: latestRow ? latestRow.getAttribute('data-selection-label') || 'Latest snapshot' : 'Latest snapshot' }
        ];
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

    if (action === 'refresh' || action === 'openFileCompare' || action === 'captureSnapshot' || action === 'importSnapshots' || action === 'openSnapshotWorkspace' || action === 'openComparisonWorkspace' || action === 'openReportWorkspace' || action === 'copySnapshotWorkspacePath' || action === 'createEvidenceWorkspace') {
      vscode && vscode.postMessage({ type: action });
      return;
    }

    if (action === 'clearSelection') {
      selectedSnapshots = [];
      updateSelection();
      return;
    }

    if (action === 'clearSearch') {
      searchQuery = '';
      const input = document.querySelector('[data-action="searchSnapshots"]');
      if (input instanceof HTMLInputElement) {
        input.value = '';
      }
      applyLibraryFilters();
      return;
    }

    if (action === 'compareSelected') {
      if (selectedSnapshots.length === 2 && !isComparing) {
        const sourceSnapshotId = selectedSnapshots[0].id;
        const targetSnapshotId = selectedSnapshots[1].id;
        isComparing = true;
        updateSelection();
        vscode && vscode.postMessage({ type: 'compareSnapshots', sourceSnapshotId, targetSnapshotId });
      }
      return;
    }

    const snapshotId = target.getAttribute('data-snapshot-id');
    if (!snapshotId) {
      return;
    }

    if (action === 'revealFile') {
      vscode && vscode.postMessage({ type: 'revealFile', snapshotId });
      return;
    }

    if (action === 'revealSnapshotInExplorer') {
      vscode && vscode.postMessage({ type: 'revealSnapshotInExplorer', snapshotId });
      return;
    }

    if (action === 'copySnapshotPath') {
      vscode && vscode.postMessage({ type: 'copySnapshotPath', snapshotId });
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

  function updateActionLabels(snapshotId, nextLabel) {
    const row = getRow(snapshotId);
    if (row) {
      const environment = row.getAttribute('data-environment-label');
      const nextSelectionLabel = environment ? environment + ' · ' + nextLabel : nextLabel;
      row.setAttribute('data-selection-label', nextSelectionLabel);
      const checkbox = row.querySelector('[data-action="toggleSnapshotSelection"]');
      if (checkbox) {
        checkbox.setAttribute('data-label', nextSelectionLabel);
      }
      selectedSnapshots = selectedSnapshots.map((item) => item.id === snapshotId ? { id: item.id, label: nextSelectionLabel } : item);
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
        const existingIndex = row.getAttribute('data-search-index') || '';
        row.setAttribute('data-search-index', existingIndex + ' ' + message.label);
        updateSelection();
        applyLibraryFilters();
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
        const existingIndex = row.getAttribute('data-search-index') || '';
        if (isFavourite && !existingIndex.toLowerCase().includes('favourite')) {
          row.setAttribute('data-search-index', existingIndex + ' favourite favorite starred');
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
        selectedSnapshots = selectedSnapshots.filter((item) => item.id !== message.snapshotId);
        const olderList = row.closest('.dvqr-older-snapshot-list');
        const subjectRow = row.closest('.dvqr-subject-row');
        row.remove();
        pruneEmptyContainers(olderList, subjectRow);
        updateSelection();
      }
    }
  });

  updateSelection();
  applyLibraryFilters();
})();`;
}
