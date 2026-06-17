import * as path from "path";
import * as vscode from "vscode";

const DEFAULT_DVQR_WORKSPACE_RELATIVE_PATH = ".dvqr";
const DEFAULT_SNAPSHOT_WORKSPACE_RELATIVE_PATH = path.join(DEFAULT_DVQR_WORKSPACE_RELATIVE_PATH, "snapshots");
const SNAPSHOT_WORKSPACE_CONFIGURATION_KEY = "snapshotWorkspaceFolder";

export interface SnapshotWorkspaceResolution {
  readonly available: boolean;
  readonly workspaceRoot?: vscode.Uri;
  readonly root?: vscode.Uri;
  readonly dvqrRoot?: vscode.Uri;
  readonly snapshotsRoot?: vscode.Uri;
  readonly comparisonsRoot?: vscode.Uri;
  readonly reportsRoot?: vscode.Uri;
  readonly configuredFolder?: string;
  readonly reason?: string;
}

export interface SnapshotWorkspaceLayout {
  readonly snapshotFile: vscode.Uri;
  readonly entityFolder: vscode.Uri;
  readonly environmentFolder: vscode.Uri;
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

function resolveConfiguredSnapshotWorkspaceFolder(): string | undefined {
  const configured = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<string>(SNAPSHOT_WORKSPACE_CONFIGURATION_KEY, "")
    .trim();

  return configured.length > 0 ? configured : undefined;
}

function resolvePathFromWorkspace(workspaceFolder: vscode.WorkspaceFolder, value: string): string {
  return path.isAbsolute(value)
    ? value
    : path.join(workspaceFolder.uri.fsPath, value);
}

function dirnameUri(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.file(path.dirname(uri.fsPath));
}

export function resolveSnapshotWorkspace(): SnapshotWorkspaceResolution {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  if (!workspaceFolder) {
    return {
      available: false,
      reason: "Open a VS Code workspace folder to use workspace-backed DVQR snapshots."
    };
  }

  const configuredFolder = resolveConfiguredSnapshotWorkspaceFolder();
  const snapshotsRoot = vscode.Uri.file(resolvePathFromWorkspace(
    workspaceFolder,
    configuredFolder ?? DEFAULT_SNAPSHOT_WORKSPACE_RELATIVE_PATH
  ));
  const defaultDvqrRoot = vscode.Uri.file(path.join(workspaceFolder.uri.fsPath, DEFAULT_DVQR_WORKSPACE_RELATIVE_PATH));
  const dvqrRoot = configuredFolder ? dirnameUri(snapshotsRoot) : defaultDvqrRoot;

  return {
    available: true,
    workspaceRoot: workspaceFolder.uri,
    root: workspaceFolder.uri,
    dvqrRoot,
    snapshotsRoot,
    comparisonsRoot: vscode.Uri.joinPath(dvqrRoot, "comparisons"),
    reportsRoot: vscode.Uri.joinPath(dvqrRoot, "reports"),
    configuredFolder
  };
}

export async function ensureSnapshotWorkspace(): Promise<SnapshotWorkspaceResolution> {
  const resolution = resolveSnapshotWorkspace();
  if (!resolution.available || !resolution.snapshotsRoot || !resolution.comparisonsRoot || !resolution.reportsRoot) {
    return resolution;
  }

  await Promise.all([
    vscode.workspace.fs.createDirectory(resolution.snapshotsRoot),
    vscode.workspace.fs.createDirectory(resolution.comparisonsRoot),
    vscode.workspace.fs.createDirectory(resolution.reportsRoot)
  ]);
  return resolution;
}

export async function openSnapshotWorkspaceFolder(): Promise<SnapshotWorkspaceResolution> {
  const resolution = await ensureSnapshotWorkspace();
  if (resolution.available && resolution.snapshotsRoot) {
    await vscode.commands.executeCommand("revealFileInOS", resolution.snapshotsRoot);
  }

  return resolution;
}

export async function openComparisonWorkspaceFolder(): Promise<SnapshotWorkspaceResolution> {
  const resolution = await ensureSnapshotWorkspace();
  if (resolution.available && resolution.comparisonsRoot) {
    await vscode.commands.executeCommand("revealFileInOS", resolution.comparisonsRoot);
  }

  return resolution;
}

export async function openReportWorkspaceFolder(): Promise<SnapshotWorkspaceResolution> {
  const resolution = await ensureSnapshotWorkspace();
  if (resolution.available && resolution.reportsRoot) {
    await vscode.commands.executeCommand("revealFileInOS", resolution.reportsRoot);
  }

  return resolution;
}

export async function copySnapshotWorkspacePath(): Promise<SnapshotWorkspaceResolution> {
  const resolution = resolveSnapshotWorkspace();
  if (resolution.available && resolution.snapshotsRoot) {
    await vscode.env.clipboard.writeText(resolution.snapshotsRoot.fsPath);
  }

  return resolution;
}

export interface CreatedEvidenceWorkspace {
  readonly workspaceFolder: vscode.Uri;
  readonly workspaceFile: vscode.Uri;
  readonly dvqrRoot: vscode.Uri;
  readonly snapshotsRoot: vscode.Uri;
  readonly comparisonsRoot: vscode.Uri;
  readonly reportsRoot: vscode.Uri;
}

function sanitizeWorkspaceFileName(value: string): string {
  const cleaned = value
    .trim()
    .replace(/[<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, " ")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return cleaned || "DVQR Evidence Workspace";
}

export async function createEvidenceWorkspace(): Promise<CreatedEvidenceWorkspace | undefined> {
  const selected = await vscode.window.showOpenDialog({
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: "Create Evidence Workspace Here",
    title: "Select a folder for your DVQR Evidence Workspace"
  });

  const workspaceFolder = selected?.[0];
  if (!workspaceFolder) {
    return undefined;
  }

  const folderName = sanitizeWorkspaceFileName(path.basename(workspaceFolder.fsPath));
  const dvqrRoot = vscode.Uri.joinPath(workspaceFolder, DEFAULT_DVQR_WORKSPACE_RELATIVE_PATH);
  const snapshotsRoot = vscode.Uri.joinPath(dvqrRoot, "snapshots");
  const comparisonsRoot = vscode.Uri.joinPath(dvqrRoot, "comparisons");
  const reportsRoot = vscode.Uri.joinPath(dvqrRoot, "reports");
  const workspaceFile = vscode.Uri.joinPath(workspaceFolder, `${folderName}.code-workspace`);

  await Promise.all([
    vscode.workspace.fs.createDirectory(snapshotsRoot),
    vscode.workspace.fs.createDirectory(comparisonsRoot),
    vscode.workspace.fs.createDirectory(reportsRoot)
  ]);

  const workspaceDefinition = {
    folders: [
      {
        path: "."
      }
    ],
    settings: {
      "dvQuickRun.snapshotWorkspaceFolder": ".dvqr/snapshots"
    }
  };

  try {
    await vscode.workspace.fs.stat(workspaceFile);
  } catch {
    await vscode.workspace.fs.writeFile(
      workspaceFile,
      Buffer.from(`${JSON.stringify(workspaceDefinition, null, 2)}\n`, "utf8")
    );
  }

  const openChoice = await vscode.window.showInformationMessage(
    "DV Quick Run: Evidence Workspace created. Open it now?",
    "Open Workspace",
    "Later"
  );

  if (openChoice === "Open Workspace") {
    await vscode.commands.executeCommand("vscode.openFolder", workspaceFile, false);
  }

  return {
    workspaceFolder,
    workspaceFile,
    dvqrRoot,
    snapshotsRoot,
    comparisonsRoot,
    reportsRoot
  };
}

export async function revealSnapshotFileInExplorer(fileUri: vscode.Uri): Promise<void> {
  await vscode.commands.executeCommand("revealFileInOS", fileUri);
}

export async function copySnapshotFilePath(fileUri: vscode.Uri): Promise<void> {
  await vscode.env.clipboard.writeText(fileUri.fsPath);
}

export function slugSnapshotSegment(value: string | undefined, fallback: string): string {
  const raw = value?.trim() || fallback;
  const slug = raw
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

  return slug || fallback;
}

export function formatSnapshotFileTimestamp(date: Date): string {
  const pad = (value: number): string => value.toString().padStart(2, "0");
  return [
    date.getUTCFullYear().toString(),
    pad(date.getUTCMonth() + 1),
    pad(date.getUTCDate()),
    "-",
    pad(date.getUTCHours()),
    pad(date.getUTCMinutes())
  ].join("");
}


export function buildSnapshotFileName(args: {
  readonly capturedAt?: Date;
  readonly label?: string;
}): string {
  const timestamp = formatSnapshotFileTimestamp(args.capturedAt ?? new Date());
  const labelSegment = args.label ? `-${slugSnapshotSegment(args.label, "snapshot")}` : "";
  return `${timestamp}${labelSegment}.dvqrsnapshot.json`;
}

export function buildSnapshotWorkspaceFileUri(args: {
  readonly snapshotsRoot: vscode.Uri;
  readonly entityLogicalName?: string;
  readonly environmentLabel?: string;
  readonly capturedAt?: Date;
  readonly label?: string;
}): vscode.Uri {
  const entitySegment = slugSnapshotSegment(args.entityLogicalName, "unknown-entity");
  const environmentSegment = slugSnapshotSegment(args.environmentLabel, "unknown-environment");

  return vscode.Uri.joinPath(
    args.snapshotsRoot,
    entitySegment,
    environmentSegment,
    buildSnapshotFileName({ capturedAt: args.capturedAt, label: args.label })
  );
}

export function buildSnapshotWorkspaceLayout(args: {
  readonly snapshotsRoot: vscode.Uri;
  readonly entityLogicalName?: string;
  readonly environmentLabel?: string;
  readonly capturedAt?: Date;
  readonly label?: string;
}): SnapshotWorkspaceLayout {
  const snapshotFile = buildSnapshotWorkspaceFileUri(args);
  const environmentFolder = dirnameUri(snapshotFile);
  return {
    snapshotFile,
    environmentFolder,
    entityFolder: dirnameUri(environmentFolder)
  };
}

export async function ensureSnapshotWorkspaceFileParent(fileUri: vscode.Uri): Promise<void> {
  await vscode.workspace.fs.createDirectory(dirnameUri(fileUri));
}
