import * as vscode from "vscode";
import { createCrossEnvironmentComparisonEngine } from "../../core/comparison/index.js";
import {
  buildSnapshotRegistryEntry,
  deleteComparisonSnapshot,
  getRegisteredComparisonSnapshots,
  registerComparisonSnapshot,
  setComparisonSnapshotFavourite,
  setComparisonSnapshotLabel,
  validateComparisonSnapshotDocument
} from "../../product/comparison/index.js";
import type { ComparisonSnapshotRegistryEntry, OperationalComparisonSnapshotDocument } from "../../product/comparison/index.js";
import type { ComparisonEnvironmentRef, ComparisonProvider, ComparisonViewModel } from "../../core/comparison/index.js";
import { renderComparisonSurfaceHtml, renderStandaloneComparisonSurfaceHtml } from "../../webview/comparisonSurface/renderComparisonSurfaceHtml.js";
import type { CommandContext } from "../context/commandContext.js";
import { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } from "../../product/capabilities/capabilityResolver.js";
import { registerCommand } from "../registerCommandHelpers.js";

interface ComparisonSnapshotFile {
  readonly environment?: ComparisonEnvironmentRef;
  readonly evidenceType?: string;
  readonly metadata?: {
    readonly capturedAtIso?: string;
  };
  readonly evidence?: unknown;
}

let comparisonPanel: vscode.WebviewPanel | undefined;
let comparisonPanelMessageDisposable: vscode.Disposable | undefined;
let snapshotLibraryPanel: vscode.WebviewPanel | undefined;
let snapshotLibraryMessageDisposable: vscode.Disposable | undefined;

const sampleSnapshots: readonly ComparisonSnapshotFile[] = [
  {
    environment: {
      label: "DEV",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "IdentityParticipation",
    evidence: {
      identities: [
        {
          displayName: "service_account_dev",
          isApplicationUser: true,
          roles: ["Integration Role", "Read Account"],
          teams: ["Integration Team"]
        },
        {
          displayName: "human.operator.dev@example.com",
          isApplicationUser: false,
          roles: ["System Customizer"]
        }
      ]
    }
  },
  {
    environment: {
      label: "SIT",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "IdentityParticipation",
    evidence: {
      identities: [
        {
          displayName: "service_account_sit",
          isApplicationUser: true,
          roles: ["Integration Role", "Read Account"],
          teams: ["Integration Team"]
        },
        {
          displayName: "service_perf_msi",
          isApplicationUser: true,
          roles: ["Automation Role"]
        }
      ]
    }
  },
  {
    environment: {
      label: "DEV",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "OperationalProfile",
    evidence: {
      entityLogicalName: "account",
      entityDisplayName: "Account",
      headlineBand: "moderate",
      headlineLabel: "Moderate complexity",
      dvqrScore: {
        displayScore: 42,
        band: "Moderate",
        summary: "Moderate operational density."
      },
      dimensions: [
        {
          id: "automation",
          label: "Automation (Plugin Steps)",
          band: "moderate",
          valueLabel: "12 synchronous plugin steps",
          evidenceStateLabel: "Moderate"
        },
        {
          id: "relationships",
          label: "Relationships",
          band: "moderate",
          valueLabel: "55 relationships",
          evidenceStateLabel: "Moderate"
        }
      ],
      workflows: [
        { name: "Legacy Account Workflow", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Legacy" }
      ],
      operationalContext: {
        sections: [
          {
            id: "SolutionContext",
            label: "Solution Context",
            evidence: [
              {
                evidenceType: "SolutionParticipation",
                raw: {
                  solutions: [
                    { uniqueName: "Default", friendlyName: "Default Solution", version: "1.0", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCore", friendlyName: "Power Pages Runtime Core", version: "1.0.2509.1", isManaged: true },
                    { uniqueName: "PowerPages_RuntimeCoreDependencies", friendlyName: "Power Pages Runtime Core Dependencies", version: "1.0.2305.1", isManaged: true }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  },
  {
    environment: {
      label: "SIT",
      capturedAtIso: "2026-05-24T00:00:00.000Z"
    },
    evidenceType: "OperationalProfile",
    evidence: {
      entityLogicalName: "account",
      entityDisplayName: "Account",
      headlineBand: "high",
      headlineLabel: "High complexity",
      dvqrScore: {
        displayScore: 67,
        band: "High",
        summary: "High operational density."
      },
      dimensions: [
        {
          id: "automation",
          label: "Automation (Plugin Steps)",
          band: "high",
          valueLabel: "28 synchronous plugin steps",
          evidenceStateLabel: "High"
        },
        {
          id: "relationships",
          label: "Relationships",
          band: "moderate",
          valueLabel: "58 relationships",
          evidenceStateLabel: "Moderate"
        },
        {
          id: "realtimeWorkflows",
          label: "Real-time Workflows",
          band: "moderate",
          valueLabel: "3 real-time workflows",
          evidenceStateLabel: "Moderate"
        }
      ],
      workflows: [
        { name: "Account Sync Realtime", category: "workflow", mode: "realtime", state: "Activated", isManaged: true, owner: "System" },
        { name: "Account Notify Flow", category: "flow", mode: "cloudFlow", state: "Activated", isManaged: false, owner: "Integration" },
        { name: "Account Enrichment Background", category: "workflow", mode: "background", state: "Activated", isManaged: false, owner: "Integration" }
      ],
      operationalContext: {
        sections: [
          {
            id: "SolutionContext",
            label: "Solution Context",
            evidence: [
              {
                evidenceType: "SolutionParticipation",
                raw: {
                  solutions: [
                    { uniqueName: "dvqr_MockOperationalAutomation", friendlyName: "DVQR Mock Operational Automation", version: "2.4.0.0", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCore", friendlyName: "Power Pages Runtime Core", version: "1.0.2509.1", isManaged: false },
                    { uniqueName: "PowerPages_RuntimeCoreDependencies", friendlyName: "Power Pages Runtime Core Dependencies", version: "1.0.9999.1", isManaged: true }
                  ]
                }
              }
            ]
          }
        ]
      }
    }
  }
];

const mockSnapshotRegistryEntries: readonly ComparisonSnapshotRegistryEntry[] = [
  {
    snapshotId: "dvqr-mock-dev-account-baseline",
    fileUri: "dvqr-mock://dev-account-baseline",
    label: "Account · DEV-MOCK baseline",
    environmentLabel: "DEV-MOCK",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-05-25T00:05:25.000Z",
    sourceFeature: "Mock Operational Profile",
    evidenceTypes: ["OperationalProfile", "IdentityParticipation"]
  },
  {
    snapshotId: "dvqr-mock-sit-account-drifted",
    fileUri: "dvqr-mock://sit-account-drifted",
    label: "Account · SIT-MOCK drifted",
    environmentLabel: "SIT-MOCK",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    capturedAtIso: "2026-05-25T01:30:00.000Z",
    sourceFeature: "Mock Operational Profile",
    evidenceTypes: ["OperationalProfile", "IdentityParticipation"]
  }
];

function isCrossEnvironmentDiffPreviewMode(): boolean {
  return !canRunCrossEnvironmentDiff() && shouldShowComparisonTeaser();
}

function canOpenSnapshotLibrarySurface(): boolean {
  return canRunCrossEnvironmentDiff() || shouldShowComparisonTeaser();
}

function getSnapshotLibraryEntries(context: vscode.ExtensionContext): readonly ComparisonSnapshotRegistryEntry[] {
  return isCrossEnvironmentDiffPreviewMode() ? mockSnapshotRegistryEntries : getRegisteredComparisonSnapshots(context);
}


async function loadProComparisonProviders(): Promise<readonly ComparisonProvider[]> {
  const pro = await import("../../pro/comparison/index.js");
  return pro.createDefaultProComparisonProviders();
}

interface ComparisonSnapshotSelection {
  readonly snapshots: readonly ComparisonSnapshotFile[];
  readonly sourceLabel?: string;
  readonly targetLabel?: string;
}

function asOperationalComparisonSnapshotDocument(input: unknown): OperationalComparisonSnapshotDocument | undefined {
  const candidate = input as Partial<OperationalComparisonSnapshotDocument>;
  if (candidate?.kind === "dvqr-operational-comparison-snapshot"
    && candidate.snapshotVersion === "comparison-snapshot-v1"
    && candidate.environment?.label
    && candidate.capturedAtIso
    && candidate.sourceFeature
    && Array.isArray(candidate.evidenceSnapshots)) {
    return candidate as OperationalComparisonSnapshotDocument;
  }

  const validation = validateComparisonSnapshotDocument(input);
  if (!validation.valid || validation.snapshots.length === 0) {
    return undefined;
  }

  const first = validation.snapshots[0];
  return {
    kind: "dvqr-operational-comparison-snapshot",
    schemaVersion: "1.0",
    snapshotVersion: "comparison-snapshot-v1",
    environment: first.environment,
    capturedAtIso: first.metadata.capturedAtIso,
    sourceFeature: first.metadata.sourceFeature,
    evidenceSnapshots: validation.snapshots
  };
}

async function readSnapshotFile(kind: "source" | "target"): Promise<readonly ComparisonSnapshotFile[] | undefined> {
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: {
      "DVQR comparison snapshots": ["json"]
    },
    title: kind === "source" ? "Step 1 of 2: Select source DVQR snapshot" : "Step 2 of 2: Select target DVQR snapshot",
    openLabel: kind === "source" ? "Use as Source Snapshot" : "Use as Target Snapshot"
  });

  const file = files?.[0];
  if (!file) {
    return undefined;
  }

  try {
    const bytes = await vscode.workspace.fs.readFile(file);
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const validation = validateComparisonSnapshotDocument(parsed);

    if (!validation.valid) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${validation.reason ?? "Selected file is not a supported comparison snapshot."}`);
      return undefined;
    }

    return validation.snapshots.map((snapshot) => snapshot as ComparisonSnapshotFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(`DV Quick Run: Could not read comparison snapshot ${file.fsPath}: ${message}`);
    return undefined;
  }
}

function getSingleEnvironmentLabel(
  kind: "source" | "target",
  snapshots: readonly ComparisonSnapshotFile[]
): string | undefined {
  const labels = uniqueEnvironmentLabels(snapshots);
  if (labels.length === 1) {
    return labels[0];
  }

  void vscode.window.showWarningMessage(
    `DV Quick Run: The selected ${kind} snapshot must contain evidence for exactly one environment.`
  );
  return undefined;
}

async function readSnapshotFiles(): Promise<ComparisonSnapshotSelection | undefined> {
  const sourceSnapshots = await readSnapshotFile("source");
  if (!sourceSnapshots) {
    return undefined;
  }

  const sourceLabel = getSingleEnvironmentLabel("source", sourceSnapshots);
  if (!sourceLabel) {
    return undefined;
  }

  const targetSnapshots = await readSnapshotFile("target");
  if (!targetSnapshots) {
    return undefined;
  }

  const targetLabel = getSingleEnvironmentLabel("target", targetSnapshots);
  if (!targetLabel) {
    return undefined;
  }

  if (sourceLabel === targetLabel) {
    void vscode.window.showWarningMessage(
      `DV Quick Run: Source and target snapshots are both labelled ${sourceLabel}. Rename one environment label before comparing so source/target evidence remains unambiguous.`
    );
    return undefined;
  }

  return {
    snapshots: [...sourceSnapshots, ...targetSnapshots],
    sourceLabel,
    targetLabel
  };
}

async function readSnapshotUri(file: vscode.Uri): Promise<readonly ComparisonSnapshotFile[] | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(file);
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const validation = validateComparisonSnapshotDocument(parsed);

    if (!validation.valid) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${validation.reason ?? "Selected file is not a supported comparison snapshot."}`);
      return undefined;
    }

    return validation.snapshots.map((snapshot) => snapshot as ComparisonSnapshotFile);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    void vscode.window.showWarningMessage(`DV Quick Run: Could not read comparison snapshot ${file.fsPath}: ${message}`);
    return undefined;
  }
}

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

function renderSnapshotLibraryHtml(
  webview: vscode.Webview,
  entries: readonly ComparisonSnapshotRegistryEntry[],
  isProPreview: boolean
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
    ${renderSnapshotLibraryCommunityFooter()}
  </main>
  <script nonce="${nonce}">${getSnapshotLibraryScript()}</script>
</body>
</html>`;
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

function renderSnapshotLibraryCommunityFooter(): string {
  return `<footer class="dvqr-community-footer">
    <span>Have feedback on Snapshot Library, Timeline Diff, or Cross-Environment Diff?</span>
    <a href="https://github.com/yongjinsim-sudo/dv-quick-run/discussions">Join DVQR Discussions</a>
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

function cloneSnapshotsForComparison(
  snapshots: readonly ComparisonSnapshotFile[],
  label: string
): readonly ComparisonSnapshotFile[] {
  return snapshots.map((snapshot) => ({
    ...snapshot,
    environment: {
      ...snapshot.environment,
      label
    }
  }));
}

function buildComparisonSurfaceTitle(source: ComparisonSnapshotRegistryEntry, target: ComparisonSnapshotRegistryEntry): string {
  const sameEnvironment = source.environmentLabel === target.environmentLabel;
  const sourceSubject = source.entityDisplayName ?? source.entityLogicalName ?? source.label;
  const targetSubject = target.entityDisplayName ?? target.entityLogicalName ?? target.label;

  if (sameEnvironment) {
    const sameSubject = (source.entityLogicalName ?? source.entityDisplayName ?? source.label).toLowerCase()
      === (target.entityLogicalName ?? target.entityDisplayName ?? target.label).toLowerCase();
    return sameSubject
      ? `Timeline Diff: ${source.environmentLabel} · ${sourceSubject}`
      : `Timeline Diff: ${source.environmentLabel} · ${sourceSubject} → ${targetSubject}`;
  }

  return `Cross-Environment Diff: ${source.environmentLabel} → ${target.environmentLabel}`;
}

function retitleComparisonViewModel(model: ComparisonViewModel, title: string): ComparisonViewModel {
  return {
    ...model,
    title
  };
}

async function compareRegisteredSnapshotEntries(
  ctx: CommandContext,
  sourceSnapshotId: string,
  targetSnapshotId: string
): Promise<void> {
  await vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "DV Quick Run: Comparing operational snapshots...",
    cancellable: false
  }, async (progress) => {
    progress.report({ message: "Loading source and target snapshots" });

    const entries = getSnapshotLibraryEntries(ctx.ext);
    const source = entries.find((entry) => entry.snapshotId === sourceSnapshotId);
    const target = entries.find((entry) => entry.snapshotId === targetSnapshotId);

    if (!source || !target) {
      void vscode.window.showWarningMessage("DV Quick Run: One or both selected snapshots are no longer available in the snapshot registry.");
      return;
    }

    if (source.fileUri === target.fileUri) {
      void vscode.window.showWarningMessage("DV Quick Run: Source and target snapshots must be different saved snapshots.");
      return;
    }

    const sourceSnapshots = source.fileUri.startsWith("dvqr-mock://")
      ? cloneSnapshotsForComparison(sampleSnapshots.filter((snapshot) => snapshot.environment?.label === "DEV"), source.environmentLabel)
      : await readSnapshotUri(vscode.Uri.parse(source.fileUri));
    const targetSnapshots = target.fileUri.startsWith("dvqr-mock://")
      ? cloneSnapshotsForComparison(sampleSnapshots.filter((snapshot) => snapshot.environment?.label === "SIT"), target.environmentLabel)
      : await readSnapshotUri(vscode.Uri.parse(target.fileUri));
    if (!sourceSnapshots || !targetSnapshots) {
      return;
    }

    const sourceSubject = source.entityDisplayName ?? source.entityLogicalName ?? source.label;
    const targetSubject = target.entityDisplayName ?? target.entityLogicalName ?? target.label;
    const sameEnvironment = source.environmentLabel === target.environmentLabel;
    const sourceLabel = sameEnvironment ? `${source.environmentLabel} · ${sourceSubject} source` : source.environmentLabel;
    const targetLabel = sameEnvironment ? `${target.environmentLabel} · ${targetSubject} target` : target.environmentLabel;

    progress.report({ message: "Running comparison providers" });

    const model = await buildComparisonViewModelFromSnapshots({
      snapshots: [
        ...cloneSnapshotsForComparison(sourceSnapshots, sourceLabel),
        ...cloneSnapshotsForComparison(targetSnapshots, targetLabel)
      ],
      sourceLabel,
      targetLabel
    });

    progress.report({ message: sameEnvironment ? "Rendering Timeline Diff" : "Rendering Cross-Environment Diff" });

    if (model) {
      revealComparisonSurface(ctx, retitleComparisonViewModel(model, buildComparisonSurfaceTitle(source, target)));
    }
  });
}

async function revealRegisteredSnapshotFile(
  ctx: CommandContext,
  snapshotId: string
): Promise<void> {
  const entry = getRegisteredComparisonSnapshots(ctx.ext).find((candidate) => candidate.snapshotId === snapshotId);
  if (!entry) {
    void vscode.window.showWarningMessage("DV Quick Run: The selected snapshot is no longer available in the snapshot registry.");
    return;
  }

  const document = await vscode.workspace.openTextDocument(vscode.Uri.parse(entry.fileUri));
  await vscode.window.showTextDocument(document, vscode.ViewColumn.Beside);
}

function describeSnapshotForPrompt(entry: ComparisonSnapshotRegistryEntry): string {
  const subject = entry.entityDisplayName ?? entry.entityLogicalName ?? "Operational snapshot";
  const label = entry.label && entry.label !== `${subject} · ${entry.environmentLabel}` ? `${entry.label} · ` : "";
  return `${entry.environmentLabel} · ${label}${subject} · ${formatSnapshotPickerTime(entry.capturedAtIso)}`;
}

async function deleteRegisteredSnapshot(
  ctx: CommandContext,
  snapshotId: string
): Promise<void> {
  const entry = getRegisteredComparisonSnapshots(ctx.ext).find((candidate) => candidate.snapshotId === snapshotId);
  if (!entry) {
    void vscode.window.showWarningMessage("DV Quick Run: The selected snapshot is no longer available in the snapshot registry.");
    return;
  }

  const choice = await vscode.window.showWarningMessage(
    `Delete snapshot from library?\n\n${describeSnapshotForPrompt(entry)}\n\nThis removes the snapshot from the local Snapshot Library. The exported JSON file on disk will not be deleted.`,
    { modal: true },
    "Delete Snapshot"
  );

  if (choice !== "Delete Snapshot") {
    return;
  }

  await deleteComparisonSnapshot(ctx.ext, snapshotId);
  void snapshotLibraryPanel?.webview.postMessage({ type: "snapshotDeleted", snapshotId });
}

async function editRegisteredSnapshotLabel(
  ctx: CommandContext,
  snapshotId: string
): Promise<void> {
  const entry = getRegisteredComparisonSnapshots(ctx.ext).find((candidate) => candidate.snapshotId === snapshotId);
  if (!entry) {
    void vscode.window.showWarningMessage("DV Quick Run: The selected snapshot is no longer available in the snapshot registry.");
    return;
  }

  const nextLabel = await vscode.window.showInputBox({
    title: "Label operational snapshot",
    prompt: "Add a human-readable label such as Pre-release baseline, PROD issue capture, or Known good.",
    value: entry.label,
    ignoreFocusOut: true
  });

  if (nextLabel === undefined) {
    return;
  }

  const trimmedLabel = nextLabel.trim() || entry.label;
  await setComparisonSnapshotLabel(ctx.ext, snapshotId, trimmedLabel);
  void snapshotLibraryPanel?.webview.postMessage({ type: "labelUpdated", snapshotId, label: trimmedLabel });
}


async function importComparisonSnapshotsIntoLibrary(ctx: CommandContext): Promise<void> {
  const files = await vscode.window.showOpenDialog({
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: true,
    filters: {
      "DVQR snapshot JSON": ["json"]
    },
    openLabel: "Import Snapshots",
    title: "Import DVQR snapshots"
  });

  if (!files?.length) {
    return;
  }

  const existing = new Set(getRegisteredComparisonSnapshots(ctx.ext).map((entry) => entry.fileUri));
  const imported: string[] = [];
  const skippedDuplicates: string[] = [];
  const invalid: string[] = [];

  for (const file of files) {
    const fileKey = file.toString();
    if (existing.has(fileKey)) {
      skippedDuplicates.push(file.fsPath);
      continue;
    }

    try {
      const bytes = await vscode.workspace.fs.readFile(file);
      const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
      const validation = validateComparisonSnapshotDocument(parsed);
      if (!validation.valid) {
        invalid.push(`${file.fsPath} — ${validation.reason ?? "Not a supported DVQR snapshot."}`);
        continue;
      }

      const document = asOperationalComparisonSnapshotDocument(parsed);
      if (!document) {
        invalid.push(`${file.fsPath} — Could not build snapshot metadata.`);
        continue;
      }

      await registerComparisonSnapshot(ctx.ext, buildSnapshotRegistryEntry({ document, fileUri: file }));
      existing.add(fileKey);
      imported.push(file.fsPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      invalid.push(`${file.fsPath} — ${message}`);
    }
  }

  const summary = [
    imported.length ? `${imported.length} imported` : undefined,
    skippedDuplicates.length ? `${skippedDuplicates.length} duplicate${skippedDuplicates.length === 1 ? "" : "s"} skipped` : undefined,
    invalid.length ? `${invalid.length} invalid` : undefined
  ].filter(Boolean).join(" · ");

  const details = invalid.length
    ? `\n\nInvalid snapshots:\n${invalid.slice(0, 5).join("\n")}${invalid.length > 5 ? "\n…" : ""}`
    : "";

  revealSnapshotLibrarySurface(ctx);

  if (invalid.length) {
    await vscode.window.showWarningMessage(`DV Quick Run: Snapshot import completed — ${summary}.${details}`);
  } else {
    await vscode.window.showInformationMessage(`DV Quick Run: Snapshot import completed — ${summary || "nothing imported"}.`);
  }
}

function revealSnapshotLibrarySurface(ctx: CommandContext): void {
  const entries = getSnapshotLibraryEntries(ctx.ext);

  if (snapshotLibraryPanel) {
    snapshotLibraryPanel.reveal(vscode.ViewColumn.One);
  } else {
    snapshotLibraryPanel = vscode.window.createWebviewPanel(
      "dvQuickRunSnapshotLibrary",
      "DV Quick Run: Snapshot Library",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    snapshotLibraryPanel.onDidDispose(() => {
      snapshotLibraryMessageDisposable?.dispose();
      snapshotLibraryMessageDisposable = undefined;
      snapshotLibraryPanel = undefined;
    }, null, ctx.ext.subscriptions);
  }

  snapshotLibraryMessageDisposable?.dispose();
  snapshotLibraryMessageDisposable = snapshotLibraryPanel.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as {
      readonly type?: string;
      readonly sourceSnapshotId?: string;
      readonly targetSnapshotId?: string;
      readonly snapshotId?: string;
      readonly isFavourite?: boolean;
      readonly surface?: string;
    };

    if (request.type === "refresh") {
      revealSnapshotLibrarySurface(ctx);
      return;
    }

    if (request.type === "lockedAction") {
      void promptForCrossEnvironmentDiffProAccess(request.surface ?? "Cross-Environment Diff");
      return;
    }

    if (request.type === "openFileCompare") {
      if (!canRunCrossEnvironmentDiff()) {
        void promptForCrossEnvironmentDiffProAccess("Compare JSON Files");
        return;
      }

      void openCrossEnvironmentDiff(ctx);
      return;
    }

    if (request.type === "importSnapshots") {
      if (!canRunCrossEnvironmentDiff()) {
        void promptForCrossEnvironmentDiffProAccess("Import Snapshots");
        return;
      }

      void importComparisonSnapshotsIntoLibrary(ctx);
      return;
    }

    if (request.type === "revealFile" && request.snapshotId) {
      void revealRegisteredSnapshotFile(ctx, request.snapshotId);
      return;
    }

    if (request.type === "editLabel" && request.snapshotId) {
      void editRegisteredSnapshotLabel(ctx, request.snapshotId);
      return;
    }

    if (request.type === "toggleFavourite" && request.snapshotId) {
      void setComparisonSnapshotFavourite(ctx.ext, request.snapshotId, request.isFavourite === true)
        .then(() => snapshotLibraryPanel?.webview.postMessage({
          type: "favouriteUpdated",
          snapshotId: request.snapshotId,
          isFavourite: request.isFavourite === true
        }));
      return;
    }

    if (request.type === "deleteSnapshot" && request.snapshotId) {
      void deleteRegisteredSnapshot(ctx, request.snapshotId);
      return;
    }

    if (request.type === "compareSnapshots" && request.sourceSnapshotId && request.targetSnapshotId) {
      void compareRegisteredSnapshotEntries(ctx, request.sourceSnapshotId, request.targetSnapshotId)
        .then(() => snapshotLibraryPanel?.webview.postMessage({ type: "compareComplete" }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showWarningMessage(`DV Quick Run: Snapshot comparison failed: ${message}`);
          void snapshotLibraryPanel?.webview.postMessage({ type: "compareFailed" });
        });
    }
  }, null, ctx.ext.subscriptions);

  snapshotLibraryPanel.webview.html = renderSnapshotLibraryHtml(snapshotLibraryPanel.webview, entries, isCrossEnvironmentDiffPreviewMode());
}

export async function openSnapshotLibrary(ctx: CommandContext): Promise<void> {
  if (!canOpenSnapshotLibrarySurface()) {
    await promptForCrossEnvironmentDiffProAccess("Snapshot Library");
    return;
  }

  revealSnapshotLibrarySurface(ctx);
}


async function pickRegisteredSnapshot(context: vscode.ExtensionContext, kind: "source" | "target", excludedSnapshotId?: string): Promise<{ readonly file: vscode.Uri; readonly label: string } | undefined> {
  const registered = getRegisteredComparisonSnapshots(context).filter((entry) => entry.snapshotId !== excludedSnapshotId);
  if (!registered.length) {
    void vscode.window.showInformationMessage("DV Quick Run: No saved comparison snapshots found yet. Export an Operational Profile Snapshot first, or compare snapshot JSON files directly.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(registered.map((entry) => ({
    label: `${entry.environmentLabel} · ${entry.entityDisplayName ?? entry.entityLogicalName ?? "Snapshot"}`,
    description: formatSnapshotPickerTime(entry.capturedAtIso),
    detail: `${entry.sourceFeature} · ${entry.evidenceTypes.join(", ")} · ${vscode.Uri.parse(entry.fileUri).fsPath}`,
    entry
  })), {
    title: kind === "source" ? "Step 1 of 2: Select source saved snapshot" : "Step 2 of 2: Select target saved snapshot",
    placeHolder: kind === "source" ? "Choose the source snapshot" : "Choose the target snapshot",
    matchOnDescription: true,
    matchOnDetail: true
  });

  if (!picked) {
    return undefined;
  }

  return {
    file: vscode.Uri.parse(picked.entry.fileUri),
    label: picked.entry.environmentLabel
  };
}

async function readRegisteredSnapshotFiles(context: vscode.ExtensionContext): Promise<ComparisonSnapshotSelection | undefined> {
  const source = await pickRegisteredSnapshot(context, "source");
  if (!source) {
    return undefined;
  }

  const target = await pickRegisteredSnapshot(context, "target");
  if (!target) {
    return undefined;
  }

  if (source.file.toString() === target.file.toString()) {
    void vscode.window.showWarningMessage("DV Quick Run: Source and target snapshots must be different saved snapshots.");
    return undefined;
  }

  const sourceSnapshots = await readSnapshotUri(source.file);
  const targetSnapshots = await readSnapshotUri(target.file);
  if (!sourceSnapshots || !targetSnapshots) {
    return undefined;
  }

  const sourceLabel = getSingleEnvironmentLabel("source", sourceSnapshots) ?? source.label;
  const targetLabel = getSingleEnvironmentLabel("target", targetSnapshots) ?? target.label;

  if (sourceLabel === targetLabel) {
    const action = await vscode.window.showWarningMessage(
      `DV Quick Run: Both saved snapshots are labelled ${sourceLabel}. Continue only if this is an intentional point-in-time comparison.`,
      "Compare Anyway"
    );

    if (action !== "Compare Anyway") {
      return undefined;
    }
  }

  return {
    snapshots: [...sourceSnapshots, ...targetSnapshots],
    sourceLabel,
    targetLabel
  };
}

function uniqueEnvironmentLabels(snapshots: readonly ComparisonSnapshotFile[]): readonly string[] {
  return [...new Set(snapshots
    .map((snapshot) => snapshot.environment?.label)
    .filter((label): label is string => Boolean(label && label.trim().length > 0)))]
    .sort((left, right) => left.localeCompare(right));
}

async function pickEnvironment(label: string, labels: readonly string[]): Promise<string | undefined> {
  return vscode.window.showQuickPick(labels, {
    title: `Select ${label} environment`,
    placeHolder: `${label} environment`
  });
}

function buildEnvironmentRef(snapshots: readonly ComparisonSnapshotFile[], label: string): ComparisonEnvironmentRef {
  const match = snapshots.find((snapshot) => snapshot.environment?.label === label)?.environment;

  const snapshot = snapshots.find((item) => item.environment?.label === label);

  return {
    label,
    environmentId: match?.environmentId,
    environmentUrl: match?.environmentUrl,
    capturedAtIso: match?.capturedAtIso ?? snapshot?.metadata?.capturedAtIso
  };
}

async function buildComparisonViewModelFromSnapshots(
  selection: ComparisonSnapshotSelection
): Promise<ComparisonViewModel | undefined> {
  const environmentLabels = uniqueEnvironmentLabels(selection.snapshots);

  const sourceLabel = selection.sourceLabel ?? await pickEnvironment("source", environmentLabels);
  if (!sourceLabel) {
    return undefined;
  }

  const targetCandidates = environmentLabels.filter((label) => label !== sourceLabel);
  const targetLabel = selection.targetLabel ?? await pickEnvironment("target", targetCandidates);
  if (!targetLabel) {
    return undefined;
  }

  if (sourceLabel === targetLabel) {
    void vscode.window.showWarningMessage(
      `DV Quick Run: Source and target snapshots are both labelled ${sourceLabel}. Rename one environment label before comparing so source/target evidence remains unambiguous.`
    );
    return undefined;
  }

  if (!selection.sourceLabel && !selection.targetLabel && environmentLabels.length < 2) {
    void vscode.window.showWarningMessage(
      "Cross-Environment Diff needs a source snapshot and a target snapshot. Choose one file for Source, then one file for Target."
    );
    return undefined;
  }

  const providers = await loadProComparisonProviders();
  const engine = createCrossEnvironmentComparisonEngine(providers);

  return engine.compare({
    source: buildEnvironmentRef(selection.snapshots, sourceLabel),
    target: buildEnvironmentRef(selection.snapshots, targetLabel),
    snapshots: selection.snapshots
  });
}


function slugFilePart(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "comparison";
}

function buildDefaultExportUri(model: ComparisonViewModel, extension: "json" | "md" | "html"): vscode.Uri | undefined {
  const prefix = model.title.startsWith("Timeline Diff") ? "dvqr-timeline-diff" : "dvqr-cross-environment-diff";
  const fileName = `${prefix}-${slugFilePart(model.summary.sourceLabel)}-to-${slugFilePart(model.summary.targetLabel)}-${Date.now()}.${extension}`;
  const folders = vscode.workspace.workspaceFolders;
  if (folders && folders.length > 0) {
    return vscode.Uri.joinPath(folders[0].uri, fileName);
  }

  return vscode.Uri.file(fileName);
}


function extractScoreBandFromEvidence(value: string | undefined): string | undefined {
  const match = value?.match(/\(([^)]+)\)/);
  return match?.[1];
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

function extractMarkdownOnlyInName(title: string): string {
  const parts = title.split(":");
  return (parts.length > 1 ? parts.slice(1).join(":") : title).trim();
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

function getMarkdownDensitySubjectTitle(subject: string, sourceValue: string | undefined, targetValue: string | undefined): string {
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

function getMarkdownDifferenceTitle(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
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
    return getMarkdownDensitySubjectTitle(subject, difference.sourceValue, difference.targetValue);
  }

  if (difference.kind === "OnlyInSource") {
    return `${extractMarkdownOnlyInName(difference.title)} present only in ${sourceLabel}`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `${extractMarkdownOnlyInName(difference.title)} present only in ${targetLabel}`;
  }

  if (difference.kind === "Changed") {
    const name = extractMarkdownOnlyInName(difference.title);
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

function getMarkdownDifferenceSummary(
  difference: ComparisonViewModel["groups"][number]["differences"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  if (difference.title.startsWith("DVQR Score density changed")) {
    const sourceBand = extractScoreBandFromEvidence(difference.evidence.find((item) => item.label === "Source score")?.value);
    const targetBand = extractScoreBandFromEvidence(difference.evidence.find((item) => item.label === "Target score")?.value);
    if (sourceBand && targetBand) {
      return `DVQR Score increased from ${sourceBand} to ${targetBand} density.`;
    }

    return `${difference.title}.`;
  }

  if (difference.kind === "OnlyInSource") {
    return `Present only in ${sourceLabel}.`;
  }

  if (difference.kind === "OnlyInTarget") {
    return `Present only in ${targetLabel}.`;
  }

  if (difference.kind === "DensityChanged") {
    const subject = difference.title.split(" changed:")[0] || "Operational density";
    return `${subject} changed between ${sourceLabel} and ${targetLabel}.`;
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

function getMarkdownGroupSummary(group: ComparisonViewModel["groups"][number]): string {
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

function getMarkdownGroupHighlights(
  group: ComparisonViewModel["groups"][number],
  sourceLabel: string,
  targetLabel: string
): readonly string[] {
  const high = group.differences.filter((difference) => difference.significance === "High");
  const strongest = high.length > 0 ? high : group.differences.slice(0, 3);
  return strongest
    .slice(0, 3)
    .map((difference) => getMarkdownDifferenceTitle(difference, sourceLabel, targetLabel));
}

function getMarkdownGroupNarrative(
  group: ComparisonViewModel["groups"][number],
  sourceLabel: string,
  targetLabel: string
): string {
  if (group.id === "operational-profile-drift") {
    return `Operational profile changes are concentrated in ${targetLabel}.`;
  }

  if (group.id === "solution-participation-drift") {
    return `Solution layering differs between ${sourceLabel} and ${targetLabel}.`;
  }

  if (group.id === "workflow-automation-participation-drift") {
    return `Automation participation differs between ${sourceLabel} and ${targetLabel}.`;
  }

  return `${group.title} contains ${group.differences.length} drift signal${group.differences.length === 1 ? "" : "s"}.`;
}

function renderComparisonMarkdown(model: ComparisonViewModel): string {
  const lines: string[] = [];
  lines.push(`# ${model.title}`);
  lines.push("");
  lines.push("DVQR observes operational drift. DVQR does not fix operational drift.");
  lines.push("");
  lines.push(`- Source: ${model.summary.sourceLabel}`);
  lines.push(`- Target: ${model.summary.targetLabel}`);
  lines.push(`- High significance: ${model.summary.highCount}`);
  lines.push(`- Medium significance: ${model.summary.mediumCount}`);
  lines.push(`- Low significance: ${model.summary.lowCount}`);
  lines.push(`- Differences: ${model.summary.differenceCount}`);
  lines.push(`- Providers: ${model.summary.providerCount}`);
  lines.push("");
  lines.push("## Operational Drift");
  lines.push("");

  if (model.groups.length === 0) {
    lines.push("No operational drift detected from the selected providers.");
    lines.push("");
    return lines.join("\n");
  }

  for (const group of model.groups) {
    lines.push(`### ${group.title}`);
    lines.push("");
    lines.push(getMarkdownGroupSummary(group));
    lines.push("");
    lines.push(`- Summary: ${getMarkdownGroupNarrative(group, model.summary.sourceLabel, model.summary.targetLabel)}`);
    const highlights = getMarkdownGroupHighlights(group, model.summary.sourceLabel, model.summary.targetLabel);
    if (highlights.length > 0) {
      lines.push("- Highlights:");
      for (const highlight of highlights) {
        lines.push(`  - ${highlight}`);
      }
    }
    lines.push(`- Significance: ${group.significance}`);
    lines.push(`- Differences: ${group.differences.length}`);
    lines.push("");

    for (const difference of group.differences) {
      lines.push(`#### ${getMarkdownDifferenceTitle(difference, model.summary.sourceLabel, model.summary.targetLabel)}`);
      lines.push("");
      lines.push(getMarkdownDifferenceSummary(difference, model.summary.sourceLabel, model.summary.targetLabel));
      lines.push("");
      lines.push(`- Kind: ${difference.kind}`);
      lines.push(`- Significance: ${difference.significance}`);
      if (difference.sourceValue) {
        lines.push(`- Source: ${difference.sourceValue}`);
      }
      if (difference.targetValue) {
        lines.push(`- Target: ${difference.targetValue}`);
      }
      if (difference.evidence.length > 0) {
        lines.push("- Evidence:");
        for (const evidence of difference.evidence) {
          lines.push(`  - ${evidence.label}${evidence.value ? ` — ${evidence.value}` : ""}`);
        }
      }
      lines.push("");
    }
  }

  return lines.join("\n");
}

async function saveComparisonExport(model: ComparisonViewModel, kind: "json" | "md" | "html"): Promise<void> {
  if (!canRunCrossEnvironmentDiff()) {
    await promptForCrossEnvironmentDiffProAccess("Comparison export");
    return;
  }

  const filters: Record<string, string[]> = kind === "json"
    ? { "JSON": ["json"] }
    : kind === "md"
      ? { "Markdown": ["md"] }
      : { "HTML": ["html"] };

  const uri = await vscode.window.showSaveDialog({
    defaultUri: buildDefaultExportUri(model, kind),
    filters,
    saveLabel: kind === "json" ? "Save JSON" : kind === "md" ? "Save MD" : "Save HTML",
    title: kind === "json" ? `Save ${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} JSON` : kind === "md" ? `Save ${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} Markdown` : `Save ${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} HTML`
  });

  if (!uri) {
    return;
  }

  const content = kind === "json"
    ? `${JSON.stringify(model, null, 2)}\n`
    : kind === "md"
      ? renderComparisonMarkdown(model)
      : renderStandaloneComparisonSurfaceHtml(model);

  await vscode.workspace.fs.writeFile(uri, Buffer.from(content, "utf8"));
  void vscode.window.showInformationMessage(`DV Quick Run: Saved ${model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"} ${kind.toUpperCase()} to ${uri.fsPath}.`);
}


async function promptForCrossEnvironmentDiffProAccess(surface: string): Promise<boolean> {
  if (canRunCrossEnvironmentDiff()) {
    return true;
  }

  const message = shouldShowComparisonTeaser()
    ? `${surface} is a DV Quick Run Pro workflow. Free keeps operational understanding available; Pro unlocks saved snapshot comparison, Snapshot Library, and cross-environment drift workflows.`
    : `${surface} is not available for the current DV Quick Run plan.`;

  await vscode.window.showInformationMessage(message, "OK");
  return false;
}
function revealComparisonSurface(ctx: CommandContext, model: ComparisonViewModel): void {
  if (comparisonPanel) {
    comparisonPanel.reveal(vscode.ViewColumn.One);
  } else {
    comparisonPanel = vscode.window.createWebviewPanel(
      "dvQuickRunCrossEnvironmentDiff",
      model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff",
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true
      }
    );

    comparisonPanel.onDidDispose(() => {
      comparisonPanelMessageDisposable?.dispose();
      comparisonPanelMessageDisposable = undefined;
      comparisonPanel = undefined;
    }, null, ctx.ext.subscriptions);
  }

  comparisonPanelMessageDisposable?.dispose();
  comparisonPanelMessageDisposable = comparisonPanel.webview.onDidReceiveMessage((message: unknown) => {
    const request = message as { readonly type?: string; readonly kind?: string };
    if (request.type !== "saveComparison") {
      return;
    }

    if (request.kind === "json" || request.kind === "md" || request.kind === "html") {
      void saveComparisonExport(model, request.kind);
    }
  }, null, ctx.ext.subscriptions);

  comparisonPanel.title = model.title.startsWith("Timeline Diff") ? "DV Quick Run: Timeline Diff" : "DV Quick Run: Cross-Environment Diff";
  comparisonPanel.webview.html = renderComparisonSurfaceHtml(comparisonPanel.webview, model, { canExport: canRunCrossEnvironmentDiff(), isProPreview: !canRunCrossEnvironmentDiff() });
}

export async function openCrossEnvironmentDiff(ctx: CommandContext): Promise<void> {
  if (!(await promptForCrossEnvironmentDiffProAccess("Cross-Environment Diff"))) {
    return;
  }

  const mode = await vscode.window.showQuickPick(
    [
      {
        label: "Compare saved snapshots",
        description: "Pick source and target snapshots from the local DVQR snapshot registry."
      },
      {
        label: "Compare snapshot JSON files",
        description: "Step 1 selects Source, then Step 2 selects Target. Do not multi-select both files together."
      },
      {
        label: "Open sample diff preview",
        description: "Use local sample evidence to verify the Pro comparison surface."
      }
    ],
    {
      title: "Cross-Environment Diff",
      placeHolder: "Choose how to open the comparison workflow"
    }
  );

  if (!mode) {
    return;
  }

  const selection = mode.label === "Open sample diff preview"
    ? { snapshots: sampleSnapshots }
    : mode.label === "Compare saved snapshots"
      ? await readRegisteredSnapshotFiles(ctx.ext)
      : await readSnapshotFiles();

  if (!selection) {
    return;
  }

  const model = await buildComparisonViewModelFromSnapshots(selection);
  if (!model) {
    return;
  }

  revealComparisonSurface(ctx, model);
}

export function registerOpenCrossEnvironmentDiffCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openSnapshotLibrary", openSnapshotLibrary, ctx);
}
