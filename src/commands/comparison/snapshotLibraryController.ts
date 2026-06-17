import * as vscode from "vscode";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import {
  buildSnapshotRegistryEntry,
  createEvidenceWorkspace,
  deleteComparisonSnapshot,
  getRegisteredComparisonSnapshots,
  registerComparisonSnapshot,
  setComparisonSnapshotFavourite,
  setComparisonSnapshotLabel,
  copySnapshotFilePath,
  copySnapshotWorkspacePath,
  openComparisonWorkspaceFolder,
  openReportWorkspaceFolder,
  openSnapshotWorkspaceFolder,
  revealSnapshotFileInExplorer,
  resolveSnapshotWorkspace,
  validateComparisonSnapshotDocument
} from "../../product/comparison/index.js";
import type { ComparisonSnapshotRegistryEntry, ComparisonSnapshotTrustState, OperationalComparisonSnapshotDocument } from "../../product/comparison/index.js";
import { canRunCrossEnvironmentDiff, shouldShowComparisonTeaser } from "../../product/capabilities/capabilityResolver.js";
import { cloneSnapshotsForComparison } from "../../product/comparison/snapshotLibrary/comparisonSnapshotClone.js";
import { getMockComparisonSnapshotsForEntry, isMockComparisonRegistryEntry, mockSnapshotRegistryEntries, normalizeMockComparisonRegistryEntry } from "../../product/comparison/snapshotLibrary/mockComparisonSnapshots.js";
import { getRecentComparisons, recordRecentComparison, removeRecentComparison } from "../../product/comparison/snapshotLibrary/recentComparisonService.js";
import { renderSnapshotLibraryHtml } from "../../product/comparison/snapshotLibrary/snapshotLibraryRenderer.js";
import type { CommandContext } from "../context/commandContext.js";
import { promptForCrossEnvironmentDiffProAccess } from "./comparisonCapabilityPrompt.js";
import { revealComparisonSurface } from "./comparisonSurfaceController.js";
import { buildComparisonViewModelFromSnapshots, readSnapshotUri } from "./comparisonSnapshotSelection.js";

let snapshotLibraryPanel: vscode.WebviewPanel | undefined;
let snapshotLibraryMessageDisposable: vscode.Disposable | undefined;

function isCrossEnvironmentDiffPreviewMode(): boolean {
  return !canRunCrossEnvironmentDiff() && shouldShowComparisonTeaser();
}

export function canOpenSnapshotLibrarySurface(): boolean {
  return canRunCrossEnvironmentDiff() || shouldShowComparisonTeaser();
}

function getSnapshotLibraryEntries(context: vscode.ExtensionContext): readonly ComparisonSnapshotRegistryEntry[] {
  const entries = isCrossEnvironmentDiffPreviewMode() ? mockSnapshotRegistryEntries : getRegisteredComparisonSnapshots(context);
  return entries.map(normalizeMockComparisonRegistryEntry);
}

function refreshSnapshotLibraryWebview(ctx: CommandContext): void {
  if (!snapshotLibraryPanel) {
    return;
  }

  snapshotLibraryPanel.webview.html = renderSnapshotLibraryHtml(
    snapshotLibraryPanel.webview,
    getSnapshotLibraryEntries(ctx.ext),
    getRecentComparisons(ctx.ext),
    isCrossEnvironmentDiffPreviewMode(),
    typeof ctx.ext.extension.packageJSON?.version === "string" ? ctx.ext.extension.packageJSON.version : "unknown",
    resolveSnapshotWorkspace()
  );
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

function formatSnapshotPickerTime(value: string | undefined): string {
  if (!value) {
    return "unknown capture time";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

function getSnapshotSubjectLabel(entry: ComparisonSnapshotRegistryEntry): string {
  return entry.entityDisplayName ?? entry.entityLogicalName ?? entry.label;
}

function getSnapshotSubjectKey(entry: ComparisonSnapshotRegistryEntry): string {
  return (entry.entityLogicalName ?? entry.entityDisplayName ?? entry.label).trim().toLowerCase();
}

async function confirmCompatibleComparisonSubjects(
  source: ComparisonSnapshotRegistryEntry,
  target: ComparisonSnapshotRegistryEntry
): Promise<boolean> {
  const sourceSubject = getSnapshotSubjectLabel(source);
  const targetSubject = getSnapshotSubjectLabel(target);

  if (getSnapshotSubjectKey(source) === getSnapshotSubjectKey(target)) {
    return true;
  }

  const action = await vscode.window.showWarningMessage(
    `DV Quick Run: These snapshots represent different operational subjects.\n\nCross-Environment Diff is designed to compare the same operational subject across environments so drift signals remain meaningful and evidence-aligned.\n\nSource: ${sourceSubject}\nTarget: ${targetSubject}`,
    { modal: true },
    "Compare Anyway"
  );

  return action === "Compare Anyway";
}

function buildComparisonSurfaceTitle(source: ComparisonSnapshotRegistryEntry, target: ComparisonSnapshotRegistryEntry): string {
  const sameEnvironment = source.environmentLabel === target.environmentLabel;
  const sourceSubject = getSnapshotSubjectLabel(source);
  const targetSubject = getSnapshotSubjectLabel(target);
  const sameSubject = getSnapshotSubjectKey(source) === getSnapshotSubjectKey(target);

  if (sameEnvironment) {
    return sameSubject
      ? `Timeline Diff: ${source.environmentLabel} · ${sourceSubject}`
      : `Timeline Diff: ${source.environmentLabel} · ${sourceSubject} → ${targetSubject}`;
  }

  return sameSubject
    ? `Cross-Environment Diff: ${sourceSubject} · ${source.environmentLabel} → ${target.environmentLabel}`
    : `Cross-Environment Diff: ${sourceSubject} → ${targetSubject} · ${source.environmentLabel} → ${target.environmentLabel}`;
}

function retitleComparisonViewModel(model: ComparisonViewModel, title: string): ComparisonViewModel {
  return {
    ...model,
    title
  };
}

function getSnapshotDisplayLabel(entry: ComparisonSnapshotRegistryEntry): string {
  const subject = getSnapshotSubjectLabel(entry);
  const customLabel = entry.label && entry.label !== `${subject} · ${entry.environmentLabel}` ? entry.label : undefined;
  return customLabel ? `${customLabel} · ${subject}` : `${entry.environmentLabel} · ${subject}`;
}

function withComparisonSessionMetadata(
  model: ComparisonViewModel,
  source: ComparisonSnapshotRegistryEntry,
  target: ComparisonSnapshotRegistryEntry,
  sourceTrustState: ComparisonSnapshotTrustState,
  targetTrustState: ComparisonSnapshotTrustState
): ComparisonViewModel {
  const sameEnvironment = source.environmentLabel === target.environmentLabel;
  const sameSubject = getSnapshotSubjectKey(source) === getSnapshotSubjectKey(target);

  return {
    ...model,
    session: {
      generatedAtIso: new Date().toISOString(),
      mode: sameEnvironment ? "Timeline Diff" : "Cross-Environment Diff",
      unalignedSubjects: !sameSubject,
      sourceSnapshot: {
        label: getSnapshotDisplayLabel(source),
        environmentLabel: source.environmentLabel,
        subjectLabel: getSnapshotSubjectLabel(source),
        capturedAtIso: source.capturedAtIso,
        trustState: sourceTrustState,
        fileUri: source.fileUri,
        lineageOrigin: source.lineage?.origin,
        lineageCreatedAtIso: source.lineage?.createdAtIso,
        lineageNote: source.lineage?.note
      },
      targetSnapshot: {
        label: getSnapshotDisplayLabel(target),
        environmentLabel: target.environmentLabel,
        subjectLabel: getSnapshotSubjectLabel(target),
        capturedAtIso: target.capturedAtIso,
        trustState: targetTrustState,
        fileUri: target.fileUri,
        lineageOrigin: target.lineage?.origin,
        lineageCreatedAtIso: target.lineage?.createdAtIso,
        lineageNote: target.lineage?.note
      }
    }
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

    if (!(await confirmCompatibleComparisonSubjects(source, target))) {
      return;
    }

    const sourceSnapshots = getMockComparisonSnapshotsForEntry(source)
      ?? await readSnapshotUri(vscode.Uri.parse(source.fileUri));
    const targetSnapshots = getMockComparisonSnapshotsForEntry(target)
      ?? await readSnapshotUri(vscode.Uri.parse(target.fileUri));
    if (!sourceSnapshots || !targetSnapshots) {
      return;
    }

    const sourceSubject = getSnapshotSubjectLabel(source);
    const targetSubject = getSnapshotSubjectLabel(target);
    const sameEnvironment = source.environmentLabel === target.environmentLabel;
    const sourceLabel = sameEnvironment ? `${source.environmentLabel} · ${sourceSubject} source` : source.environmentLabel;
    const targetLabel = sameEnvironment ? `${target.environmentLabel} · ${targetSubject} target` : target.environmentLabel;

    progress.report({ message: "Running comparison providers" });

    const sourceTrustState = isMockComparisonRegistryEntry(source) ? "Verified" : sourceSnapshots.trustState;
    const targetTrustState = isMockComparisonRegistryEntry(target) ? "Verified" : targetSnapshots.trustState;
    const sameSubject = getSnapshotSubjectKey(source) === getSnapshotSubjectKey(target);

    const model = await buildComparisonViewModelFromSnapshots({
      snapshots: [
        ...cloneSnapshotsForComparison(sourceSnapshots.snapshots, sourceLabel),
        ...cloneSnapshotsForComparison(targetSnapshots.snapshots, targetLabel)
      ],
      sourceLabel,
      targetLabel,
      comparisonMode: sameEnvironment ? "timeline" : "crossEnvironment",
      subjectLabel: sameSubject ? sourceSubject : `${sourceSubject} → ${targetSubject}`,
      snapshotTrust: {
        sourceTrustState,
        targetTrustState
      }
    });

    progress.report({ message: sameEnvironment ? "Rendering Timeline Diff" : "Rendering Cross-Environment Diff" });

    if (model) {
      const titledModel = retitleComparisonViewModel(model, buildComparisonSurfaceTitle(source, target));
      const sessionModel = withComparisonSessionMetadata(titledModel, source, target, sourceTrustState, targetTrustState);
      await recordRecentComparison(ctx.ext, {
        comparisonId: `${source.snapshotId}::${target.snapshotId}::${Date.now()}`,
        sourceSnapshotId: source.snapshotId,
        targetSnapshotId: target.snapshotId,
        sourceLabel: getSnapshotDisplayLabel(source),
        targetLabel: getSnapshotDisplayLabel(target),
        sourceEnvironmentLabel: source.environmentLabel,
        targetEnvironmentLabel: target.environmentLabel,
        subjectLabel: sameSubject ? sourceSubject : `${sourceSubject} → ${targetSubject}`,
        generatedAtIso: new Date().toISOString(),
        differenceCount: sessionModel.summary.differenceCount,
        highCount: sessionModel.summary.highCount,
        mediumCount: sessionModel.summary.mediumCount,
        lowCount: sessionModel.summary.lowCount,
        unalignedSubjects: !sameSubject
      });
      revealComparisonSurface(ctx, sessionModel);
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

async function revealRegisteredSnapshotInExplorer(
  ctx: CommandContext,
  snapshotId: string
): Promise<void> {
  const entry = getRegisteredComparisonSnapshots(ctx.ext).find((candidate) => candidate.snapshotId === snapshotId);
  if (!entry) {
    void vscode.window.showWarningMessage("DV Quick Run: The selected snapshot is no longer available in the snapshot registry.");
    return;
  }

  await revealSnapshotFileInExplorer(vscode.Uri.parse(entry.fileUri));
}

async function copyRegisteredSnapshotPath(
  ctx: CommandContext,
  snapshotId: string
): Promise<void> {
  const entry = getRegisteredComparisonSnapshots(ctx.ext).find((candidate) => candidate.snapshotId === snapshotId);
  if (!entry) {
    void vscode.window.showWarningMessage("DV Quick Run: The selected snapshot is no longer available in the snapshot registry.");
    return;
  }

  await copySnapshotFilePath(vscode.Uri.parse(entry.fileUri));
  void vscode.window.showInformationMessage("DV Quick Run: Snapshot path copied.");
}

async function createEvidenceWorkspaceFromSnapshotLibrary(ctx?: CommandContext): Promise<void> {
  const created = await createEvidenceWorkspace();
  if (!created) {
    return;
  }

  void vscode.window.showInformationMessage(`DV Quick Run: Evidence Workspace ready at ${created.dvqrRoot.fsPath}`);

  if (ctx) {
    refreshSnapshotLibraryWebview(ctx);
  }
}

async function openWorkspaceSnapshotFolder(): Promise<void> {
  const resolution = await openSnapshotWorkspaceFolder();
  if (!resolution.available) {
    void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Snapshot workspace is unavailable."}`);
  }
}

async function openWorkspaceComparisonFolder(): Promise<void> {
  const resolution = await openComparisonWorkspaceFolder();
  if (!resolution.available) {
    void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Snapshot workspace is unavailable."}`);
  }
}

async function openWorkspaceReportFolder(): Promise<void> {
  const resolution = await openReportWorkspaceFolder();
  if (!resolution.available) {
    void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Snapshot workspace is unavailable."}`);
  }
}

async function copyWorkspaceSnapshotFolderPath(): Promise<void> {
  const resolution = await copySnapshotWorkspacePath();
  if (!resolution.available) {
    void vscode.window.showWarningMessage(`DV Quick Run: ${resolution.reason ?? "Snapshot workspace is unavailable."}`);
    return;
  }

  void vscode.window.showInformationMessage("DV Quick Run: Snapshot workspace path copied.");
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

export function revealSnapshotLibrarySurface(
  ctx: CommandContext,
  openFileCompare?: () => void | Promise<void>
): void {
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
  snapshotLibraryMessageDisposable = snapshotLibraryPanel.webview.onDidReceiveMessage(async (message: unknown) => {
    const request = message as {
      readonly type?: string;
      readonly sourceSnapshotId?: string;
      readonly targetSnapshotId?: string;
      readonly snapshotId?: string;
      readonly isFavourite?: boolean;
      readonly surface?: string;
      readonly comparisonId?: string;
    };

    if (request.type === "refresh") {
      revealSnapshotLibrarySurface(ctx, openFileCompare);
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

      void openFileCompare?.();
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

    if (request.type === "captureSnapshot") {
      if (!canRunCrossEnvironmentDiff()) {
        void promptForCrossEnvironmentDiffProAccess("Capture Snapshot");
        return;
      }

      void vscode.commands.executeCommand("dvQuickRun.captureOperationalProfileSnapshot")
        .then(() => refreshSnapshotLibraryWebview(ctx));
      return;
    }

    if (request.type === "removeRecentComparison" && request.comparisonId) {
      const choice = await vscode.window.showWarningMessage(
        "Remove this recent comparison from history? Snapshots will not be deleted.",
        { modal: true },
        "Remove"
      );
      if (choice === "Remove") {
        void removeRecentComparison(ctx.ext, request.comparisonId)
          .then(() => snapshotLibraryPanel?.webview.postMessage({ type: "recentComparisonRemoved", comparisonId: request.comparisonId }));
      }
      return;
    }

    if (request.type === "revealFile" && request.snapshotId) {
      void revealRegisteredSnapshotFile(ctx, request.snapshotId);
      return;
    }

    if (request.type === "revealSnapshotInExplorer" && request.snapshotId) {
      void revealRegisteredSnapshotInExplorer(ctx, request.snapshotId);
      return;
    }

    if (request.type === "copySnapshotPath" && request.snapshotId) {
      void copyRegisteredSnapshotPath(ctx, request.snapshotId);
      return;
    }

    if (request.type === "createEvidenceWorkspace") {
      void createEvidenceWorkspaceFromSnapshotLibrary(ctx);
      return;
    }

    if (request.type === "openSnapshotWorkspace") {
      void openWorkspaceSnapshotFolder();
      return;
    }

    if (request.type === "openComparisonWorkspace") {
      void openWorkspaceComparisonFolder();
      return;
    }

    if (request.type === "openReportWorkspace") {
      void openWorkspaceReportFolder();
      return;
    }

    if (request.type === "copySnapshotWorkspacePath") {
      void copyWorkspaceSnapshotFolderPath();
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

    if ((request.type === "compareSnapshots" || request.type === "replayComparison") && request.sourceSnapshotId && request.targetSnapshotId) {
      void compareRegisteredSnapshotEntries(ctx, request.sourceSnapshotId, request.targetSnapshotId)
        .then(() => snapshotLibraryPanel?.webview.postMessage({ type: "compareComplete" }))
        .catch((error: unknown) => {
          const message = error instanceof Error ? error.message : String(error);
          void vscode.window.showWarningMessage(`DV Quick Run: Snapshot comparison failed: ${message}`);
          void snapshotLibraryPanel?.webview.postMessage({ type: "compareFailed" });
        });
    }
  }, null, ctx.ext.subscriptions);

  snapshotLibraryPanel.webview.html = renderSnapshotLibraryHtml(
    snapshotLibraryPanel.webview,
    entries,
    getRecentComparisons(ctx.ext),
    isCrossEnvironmentDiffPreviewMode(),
    typeof ctx.ext.extension.packageJSON?.version === "string" ? ctx.ext.extension.packageJSON.version : "unknown",
    resolveSnapshotWorkspace()
  );
}
