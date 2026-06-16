import * as vscode from "vscode";
import { createCrossEnvironmentComparisonEngine } from "../../core/comparison/index.js";
import type { ComparisonEnvironmentRef, ComparisonProvider, ComparisonViewModel } from "../../core/comparison/index.js";
import { getRegisteredComparisonSnapshots, validateComparisonSnapshotDocument } from "../../product/comparison/index.js";
import type { ComparisonSnapshotTrustState } from "../../product/comparison/index.js";

export interface ComparisonSnapshotFile {
  readonly environment?: ComparisonEnvironmentRef;
  readonly evidenceType?: string;
  readonly metadata?: {
    readonly capturedAtIso?: string;
  };
  readonly evidence?: unknown;
}

export interface ComparisonSnapshotSelection {
  readonly snapshots: readonly ComparisonSnapshotFile[];
  readonly sourceLabel?: string;
  readonly targetLabel?: string;
  readonly subjectLabel?: string;
  readonly entityLogicalName?: string;
  readonly snapshotTrust?: {
    readonly sourceTrustState?: ComparisonSnapshotTrustState;
    readonly targetTrustState?: ComparisonSnapshotTrustState;
  };
}

export interface ReadComparisonSnapshotResult {
  readonly snapshots: readonly ComparisonSnapshotFile[];
  readonly trustState: ComparisonSnapshotTrustState;
}

async function loadProComparisonProviders(): Promise<readonly ComparisonProvider[]> {
  const pro = await import("../../pro/comparison/index.js");
  return pro.createDefaultProComparisonProviders();
}

async function readSnapshotFile(kind: "source" | "target"): Promise<ReadComparisonSnapshotResult | undefined> {
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

  return readSnapshotUri(file);
}

function normalizeSnapshotLogicalName(value: unknown): string | undefined {
  return typeof value === "string" && value.trim().length > 0
    ? value.trim().toLowerCase()
    : undefined;
}

function readSnapshotEvidenceRecord(snapshot: ComparisonSnapshotFile): Record<string, unknown> | undefined {
  return snapshot.evidence && typeof snapshot.evidence === "object"
    ? snapshot.evidence as Record<string, unknown>
    : undefined;
}

function getSnapshotEntityLogicalName(snapshot: ComparisonSnapshotFile): string | undefined {
  const evidence = readSnapshotEvidenceRecord(snapshot);

  if (snapshot.evidenceType === "OperationalProfile") {
    const operationalProfileEntity = normalizeSnapshotLogicalName(evidence?.entityLogicalName);
    if (operationalProfileEntity) {
      return operationalProfileEntity;
    }
  }

  if (snapshot.evidenceType === "EntityMetadata") {
    const entities = Array.isArray(evidence?.entities) ? evidence.entities : [];
    const entityLogicalNames = [...new Set(entities
      .map((entity) => entity && typeof entity === "object"
        ? normalizeSnapshotLogicalName((entity as Record<string, unknown>).logicalName)
        : undefined)
      .filter((logicalName): logicalName is string => Boolean(logicalName)))];

    if (entityLogicalNames.length === 1) {
      return entityLogicalNames[0];
    }
  }

  return normalizeSnapshotLogicalName(evidence?.entityLogicalName);
}

export function getComparisonEntityLogicalName(snapshots: readonly ComparisonSnapshotFile[]): string | undefined {
  const logicalNames = [...new Set(snapshots
    .map(getSnapshotEntityLogicalName)
    .filter((logicalName): logicalName is string => Boolean(logicalName)))];

  return logicalNames.length === 1 ? logicalNames[0] : undefined;
}

function uniqueEnvironmentLabels(snapshots: readonly ComparisonSnapshotFile[]): readonly string[] {
  return [...new Set(snapshots
    .map((snapshot) => snapshot.environment?.label)
    .filter((label): label is string => Boolean(label && label.trim().length > 0)))]
    .sort((left, right) => left.localeCompare(right));
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

export async function readSnapshotFiles(): Promise<ComparisonSnapshotSelection | undefined> {
  const sourceSnapshots = await readSnapshotFile("source");
  if (!sourceSnapshots) {
    return undefined;
  }

  const sourceLabel = getSingleEnvironmentLabel("source", sourceSnapshots.snapshots);
  if (!sourceLabel) {
    return undefined;
  }

  const targetSnapshots = await readSnapshotFile("target");
  if (!targetSnapshots) {
    return undefined;
  }

  const targetLabel = getSingleEnvironmentLabel("target", targetSnapshots.snapshots);
  if (!targetLabel) {
    return undefined;
  }

  if (sourceLabel === targetLabel) {
    void vscode.window.showWarningMessage(
      `DV Quick Run: Source and target snapshots are both labelled ${sourceLabel}. Rename one environment label before comparing so source/target evidence remains unambiguous.`
    );
    return undefined;
  }

  const snapshots = [...sourceSnapshots.snapshots, ...targetSnapshots.snapshots];

  return {
    snapshots,
    sourceLabel,
    targetLabel,
    entityLogicalName: getComparisonEntityLogicalName(snapshots),
    snapshotTrust: {
      sourceTrustState: sourceSnapshots.trustState,
      targetTrustState: targetSnapshots.trustState
    }
  };
}

export async function readSnapshotUri(file: vscode.Uri): Promise<ReadComparisonSnapshotResult | undefined> {
  try {
    const bytes = await vscode.workspace.fs.readFile(file);
    const parsed = JSON.parse(Buffer.from(bytes).toString("utf8")) as unknown;
    const validation = validateComparisonSnapshotDocument(parsed);

    if (!validation.valid) {
      void vscode.window.showWarningMessage(`DV Quick Run: ${validation.reason ?? "Selected file is not a supported comparison snapshot."}`);
      return undefined;
    }

    return {
      snapshots: validation.snapshots.map((snapshot) => snapshot as ComparisonSnapshotFile),
      trustState: validation.trustState
    };
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

async function pickRegisteredSnapshot(
  context: vscode.ExtensionContext,
  kind: "source" | "target",
  excludedSnapshotId?: string
): Promise<{ readonly file: vscode.Uri; readonly label: string } | undefined> {
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

function getTrustLimitedSnapshotStates(selection: ComparisonSnapshotSelection): readonly ComparisonSnapshotTrustState[] {
  return [selection.snapshotTrust?.sourceTrustState, selection.snapshotTrust?.targetTrustState]
    .filter((state): state is ComparisonSnapshotTrustState => state === "Modified" || state === "Invalid");
}

function summarizeTrustLimitedSnapshotStates(states: readonly ComparisonSnapshotTrustState[]): string {
  const uniqueStates = [...new Set(states)];
  if (uniqueStates.includes("Invalid") && uniqueStates.includes("Modified")) {
    return "modified or invalid integrity metadata";
  }

  if (uniqueStates.includes("Invalid")) {
    return "invalid integrity metadata";
  }

  return "content that no longer matches its DVQR integrity hash";
}

async function confirmTrustLimitedSnapshotComparison(selection: ComparisonSnapshotSelection): Promise<boolean> {
  const trustLimitedStates = getTrustLimitedSnapshotStates(selection);
  if (!trustLimitedStates.length) {
    return true;
  }

  const detail = summarizeTrustLimitedSnapshotStates(trustLimitedStates);
  const action = await vscode.window.showWarningMessage(
    `DV Quick Run: One or more selected snapshots have ${detail}. DVQR can keep the comparison inspectable, but the evidence is trust-limited and should not be treated as verified snapshot truth.`,
    { modal: true },
    "Compare Untrusted"
  );

  return action === "Compare Untrusted";
}

export async function readRegisteredSnapshotFiles(context: vscode.ExtensionContext): Promise<ComparisonSnapshotSelection | undefined> {
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

  const sourceLabel = getSingleEnvironmentLabel("source", sourceSnapshots.snapshots) ?? source.label;
  const targetLabel = getSingleEnvironmentLabel("target", targetSnapshots.snapshots) ?? target.label;

  if (sourceLabel === targetLabel) {
    const action = await vscode.window.showWarningMessage(
      `DV Quick Run: Both saved snapshots are labelled ${sourceLabel}. Continue only if this is an intentional point-in-time comparison.`,
      "Compare Anyway"
    );

    if (action !== "Compare Anyway") {
      return undefined;
    }
  }

  const snapshots = [...sourceSnapshots.snapshots, ...targetSnapshots.snapshots];

  return {
    snapshots,
    sourceLabel,
    targetLabel,
    entityLogicalName: getComparisonEntityLogicalName(snapshots),
    snapshotTrust: {
      sourceTrustState: sourceSnapshots.trustState,
      targetTrustState: targetSnapshots.trustState
    }
  };
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

export async function buildComparisonViewModelFromSnapshots(
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

  if (!(await confirmTrustLimitedSnapshotComparison(selection))) {
    return undefined;
  }

  const providers = await loadProComparisonProviders();
  const engine = createCrossEnvironmentComparisonEngine(providers);

  const comparisonEntityLogicalName = selection.entityLogicalName ?? getComparisonEntityLogicalName(selection.snapshots);

  const model = await engine.compare({
    source: buildEnvironmentRef(selection.snapshots, sourceLabel),
    target: buildEnvironmentRef(selection.snapshots, targetLabel),
    entityLogicalName: comparisonEntityLogicalName,
    subjectLabel: selection.subjectLabel,
    snapshots: selection.snapshots
  });

  const modelWithSubject = selection.subjectLabel || comparisonEntityLogicalName ? {
    ...model,
    summary: {
      ...model.summary,
      subjectLabel: selection.subjectLabel ?? model.summary.subjectLabel,
      entityLogicalName: comparisonEntityLogicalName ?? model.summary.entityLogicalName
    }
  } : model;

  return selection.snapshotTrust ? {
    ...modelWithSubject,
    snapshotTrust: selection.snapshotTrust
  } : modelWithSubject;
}
