import * as path from "path";
import * as vscode from "vscode";
import { toEnvironmentCachePrefix } from "./environmentCacheKey.js";

const METADATA_ROOT_DIR = "metadata-cache";

function safeName(value: string): string {
  return value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-");
}

function getStorageFsPath(ext: vscode.ExtensionContext): string {
  const baseUri = ext.globalStorageUri ?? ext.storageUri;
  if (baseUri?.fsPath) {
    return baseUri.fsPath;
  }

  return path.join(ext.extensionUri.fsPath, ".dv-quick-run-storage");
}

export function getMetadataRootFsPath(ext: vscode.ExtensionContext): string {
  return path.join(getStorageFsPath(ext), METADATA_ROOT_DIR);
}

export function getEnvironmentMetadataRootFsPath(
  ext: vscode.ExtensionContext,
  environmentName: string
): string {
  return path.join(getMetadataRootFsPath(ext), toEnvironmentCachePrefix(environmentName || "unknown"));
}

export function getEntityDefsCachePath(ext: vscode.ExtensionContext, environmentName: string): string {
  return path.join(getEnvironmentMetadataRootFsPath(ext, environmentName), "entityDefs.json");
}

export function getEntityFieldsCachePath(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): string {
  return path.join(
    getEnvironmentMetadataRootFsPath(ext, environmentName),
    "fields",
    `${safeName(logicalName)}.json`
  );
}

export function getEntityChoicesCachePath(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): string {
  return path.join(
    getEnvironmentMetadataRootFsPath(ext, environmentName),
    "choices",
    `${safeName(logicalName)}.json`
  );
}

export function getEntityRelationshipsCachePath(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): string {
  return path.join(
    getEnvironmentMetadataRootFsPath(ext, environmentName),
    "relationships",
    `${safeName(logicalName)}.json`
  );
}

export function getRelationshipExplorerCachePath(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): string {
  return path.join(
    getEnvironmentMetadataRootFsPath(ext, environmentName),
    "relationshipExplorer",
    `${safeName(logicalName)}.json`
  );
}
