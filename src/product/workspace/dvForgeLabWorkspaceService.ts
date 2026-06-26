import * as path from "path";
import * as vscode from "vscode";

export const DV_FORGELAB_WORKSPACE_RELATIVE_PATH = ".dvforgelab";
export const LEGACY_DVQR_WORKSPACE_RELATIVE_PATH = ".dvqr";
export const DVQR_WORKSPACE_RELATIVE_PATH = path.join(DV_FORGELAB_WORKSPACE_RELATIVE_PATH, "dvqr");
export const DVAF_WORKSPACE_RELATIVE_PATH = path.join(DV_FORGELAB_WORKSPACE_RELATIVE_PATH, "dvaf");
export const DVIM_WORKSPACE_RELATIVE_PATH = path.join(DV_FORGELAB_WORKSPACE_RELATIVE_PATH, "dvim");
export const DVQR_SNAPSHOTS_RELATIVE_PATH = path.join(DVQR_WORKSPACE_RELATIVE_PATH, "snapshots");

export interface DvForgeLabWorkspaceResolution {
  readonly available: boolean;
  readonly workspaceRoot?: vscode.Uri;
  readonly root?: vscode.Uri;
  readonly forgeLabRoot?: vscode.Uri;
  readonly dvqrRoot?: vscode.Uri;
  readonly dvafRoot?: vscode.Uri;
  readonly dvimRoot?: vscode.Uri;
  readonly snapshotsRoot?: vscode.Uri;
  readonly comparisonsRoot?: vscode.Uri;
  readonly reportsRoot?: vscode.Uri;
  readonly dvafExportsRoot?: vscode.Uri;
  readonly dvimExportsRoot?: vscode.Uri;
  readonly configuredSnapshotFolder?: string;
  readonly usingLegacyDvqrRoot?: boolean;
  readonly reason?: string;
}

export interface DvForgeLabWorkspaceLayout {
  readonly forgeLabRoot: vscode.Uri;
  readonly dvqrRoot: vscode.Uri;
  readonly dvafRoot: vscode.Uri;
  readonly dvimRoot: vscode.Uri;
  readonly snapshotsRoot: vscode.Uri;
  readonly comparisonsRoot: vscode.Uri;
  readonly reportsRoot: vscode.Uri;
  readonly dvafExportsRoot: vscode.Uri;
  readonly dvimExportsRoot: vscode.Uri;
}

function getPrimaryWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  return vscode.workspace.workspaceFolders?.[0];
}

function resolvePathFromWorkspace(workspaceFolder: vscode.WorkspaceFolder, value: string): string {
  return path.isAbsolute(value)
    ? value
    : path.join(workspaceFolder.uri.fsPath, value);
}

function dirnameUri(uri: vscode.Uri): vscode.Uri {
  return vscode.Uri.file(path.dirname(uri.fsPath));
}

async function pathExists(uri: vscode.Uri): Promise<boolean> {
  try {
    await vscode.workspace.fs.stat(uri);
    return true;
  } catch {
    return false;
  }
}

export function getDefaultDvForgeLabWorkspaceLayout(workspaceRoot: vscode.Uri): DvForgeLabWorkspaceLayout {
  const forgeLabRoot = vscode.Uri.joinPath(workspaceRoot, DV_FORGELAB_WORKSPACE_RELATIVE_PATH);
  const dvqrRoot = vscode.Uri.joinPath(forgeLabRoot, "dvqr");
  const dvafRoot = vscode.Uri.joinPath(forgeLabRoot, "dvaf");
  const dvimRoot = vscode.Uri.joinPath(forgeLabRoot, "dvim");

  return {
    forgeLabRoot,
    dvqrRoot,
    dvafRoot,
    dvimRoot,
    snapshotsRoot: vscode.Uri.joinPath(dvqrRoot, "snapshots"),
    comparisonsRoot: vscode.Uri.joinPath(dvqrRoot, "comparisons"),
    reportsRoot: vscode.Uri.joinPath(dvqrRoot, "reports"),
    dvafExportsRoot: vscode.Uri.joinPath(dvafRoot, "exports"),
    dvimExportsRoot: vscode.Uri.joinPath(dvimRoot, "exports")
  };
}

export function getLegacyDvqrWorkspaceLayout(workspaceRoot: vscode.Uri): DvForgeLabWorkspaceLayout {
  const forgeLabRoot = vscode.Uri.joinPath(workspaceRoot, DV_FORGELAB_WORKSPACE_RELATIVE_PATH);
  const dvqrRoot = vscode.Uri.joinPath(workspaceRoot, LEGACY_DVQR_WORKSPACE_RELATIVE_PATH);
  const dvafRoot = vscode.Uri.joinPath(forgeLabRoot, "dvaf");
  const dvimRoot = vscode.Uri.joinPath(forgeLabRoot, "dvim");

  return {
    forgeLabRoot,
    dvqrRoot,
    dvafRoot,
    dvimRoot,
    snapshotsRoot: vscode.Uri.joinPath(dvqrRoot, "snapshots"),
    comparisonsRoot: vscode.Uri.joinPath(dvqrRoot, "comparisons"),
    reportsRoot: vscode.Uri.joinPath(dvqrRoot, "reports"),
    dvafExportsRoot: vscode.Uri.joinPath(dvafRoot, "exports"),
    dvimExportsRoot: vscode.Uri.joinPath(dvimRoot, "exports")
  };
}

export function resolveConfiguredSnapshotWorkspaceLayout(args: {
  readonly workspaceFolder: vscode.WorkspaceFolder;
  readonly configuredSnapshotFolder: string;
}): DvForgeLabWorkspaceLayout {
  const snapshotsRoot = vscode.Uri.file(resolvePathFromWorkspace(args.workspaceFolder, args.configuredSnapshotFolder));
  const dvqrRoot = dirnameUri(snapshotsRoot);
  const workspaceRoot = args.workspaceFolder.uri;
  const forgeLabRoot = vscode.Uri.joinPath(workspaceRoot, DV_FORGELAB_WORKSPACE_RELATIVE_PATH);
  const dvafRoot = vscode.Uri.joinPath(forgeLabRoot, "dvaf");
  const dvimRoot = vscode.Uri.joinPath(forgeLabRoot, "dvim");

  return {
    forgeLabRoot,
    dvqrRoot,
    dvafRoot,
    dvimRoot,
    snapshotsRoot,
    comparisonsRoot: vscode.Uri.joinPath(dvqrRoot, "comparisons"),
    reportsRoot: vscode.Uri.joinPath(dvqrRoot, "reports"),
    dvafExportsRoot: vscode.Uri.joinPath(dvafRoot, "exports"),
    dvimExportsRoot: vscode.Uri.joinPath(dvimRoot, "exports")
  };
}

export async function resolveDvForgeLabWorkspace(args?: {
  readonly configuredSnapshotFolder?: string;
  readonly preferLegacyIfPresent?: boolean;
}): Promise<DvForgeLabWorkspaceResolution> {
  const workspaceFolder = getPrimaryWorkspaceFolder();
  if (!workspaceFolder) {
    return {
      available: false,
      reason: "Open a VS Code workspace folder to use workspace-backed DV ForgeLab artifacts."
    };
  }

  const configuredSnapshotFolder = args?.configuredSnapshotFolder?.trim();
  if (configuredSnapshotFolder) {
    const configuredLayout = resolveConfiguredSnapshotWorkspaceLayout({
      workspaceFolder,
      configuredSnapshotFolder
    });

    return {
      available: true,
      workspaceRoot: workspaceFolder.uri,
      root: workspaceFolder.uri,
      configuredSnapshotFolder,
      ...configuredLayout
    };
  }

  const defaultLayout = getDefaultDvForgeLabWorkspaceLayout(workspaceFolder.uri);
  const legacyLayout = getLegacyDvqrWorkspaceLayout(workspaceFolder.uri);
  const useLegacy = args?.preferLegacyIfPresent === true
    && await pathExists(legacyLayout.dvqrRoot)
    && !await pathExists(defaultLayout.forgeLabRoot);
  const layout = useLegacy ? legacyLayout : defaultLayout;

  return {
    available: true,
    workspaceRoot: workspaceFolder.uri,
    root: workspaceFolder.uri,
    usingLegacyDvqrRoot: useLegacy,
    ...layout
  };
}

export async function ensureDvForgeLabWorkspace(args?: {
  readonly configuredSnapshotFolder?: string;
  readonly preferLegacyIfPresent?: boolean;
  readonly includeDvaf?: boolean;
  readonly includeDvim?: boolean;
}): Promise<DvForgeLabWorkspaceResolution> {
  const resolution = await resolveDvForgeLabWorkspace(args);
  if (!resolution.available || !resolution.snapshotsRoot || !resolution.comparisonsRoot || !resolution.reportsRoot) {
    return resolution;
  }

  const folders = [
    resolution.snapshotsRoot,
    resolution.comparisonsRoot,
    resolution.reportsRoot
  ];

  if (args?.includeDvaf === true && resolution.dvafExportsRoot) {
    folders.push(resolution.dvafExportsRoot);
  }

  if (args?.includeDvim === true && resolution.dvimExportsRoot) {
    folders.push(resolution.dvimExportsRoot);
  }

  await Promise.all(folders.map((folder) => vscode.workspace.fs.createDirectory(folder)));
  return resolution;
}

export async function ensureDvafExportsWorkspace(): Promise<DvForgeLabWorkspaceResolution> {
  return ensureDvForgeLabWorkspace({ includeDvaf: true, preferLegacyIfPresent: true });
}

export async function ensureDvimExportsWorkspace(): Promise<DvForgeLabWorkspaceResolution> {
  return ensureDvForgeLabWorkspace({ includeDvim: true, preferLegacyIfPresent: true });
}
