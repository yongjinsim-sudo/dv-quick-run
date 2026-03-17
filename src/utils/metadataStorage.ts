import * as path from "path";
import * as vscode from "vscode";
import {
  getEntityChoicesCachePath,
  getEntityDefsCachePath,
  getEntityFieldsCachePath,
  getEntityRelationshipsCachePath,
  getEnvironmentMetadataRootFsPath,
  getMetadataRootFsPath,
  getRelationshipExplorerCachePath
} from "./storagePaths.js";
import {
  deleteDirectoryIfExists,
  deleteFileIfExists,
  getDirectorySizeSync,
  getFileSizeSync,
  listJsonBaseNames,
  readJsonFileSync,
  writeJsonFile,
  writeJsonFileSync
} from "./jsonStorage.js";

export type MetadataBucketName = "entityDefs" | "fields" | "choices" | "relationships" | "relationshipExplorer";

export function readEntityDefsCacheSync<T>(ext: vscode.ExtensionContext, environmentName: string): T | undefined {
  return readJsonFileSync<T>(getEntityDefsCachePath(ext, environmentName));
}

export async function writeEntityDefsCache(
  ext: vscode.ExtensionContext,
  environmentName: string,
  value: unknown
): Promise<void> {
  await writeJsonFile(getEntityDefsCachePath(ext, environmentName), value);
}

export function writeEntityDefsCacheSync(
  ext: vscode.ExtensionContext,
  environmentName: string,
  value: unknown
): void {
  writeJsonFileSync(getEntityDefsCachePath(ext, environmentName), value);
}

export function readPerEntityCacheSync<T>(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  bucket: Exclude<MetadataBucketName, "entityDefs">
): T | undefined {
  const filePath = getPerEntityPath(ext, environmentName, logicalName, bucket);
  return readJsonFileSync<T>(filePath);
}

export async function writePerEntityCache(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  bucket: Exclude<MetadataBucketName, "entityDefs">,
  value: unknown
): Promise<void> {
  const filePath = getPerEntityPath(ext, environmentName, logicalName, bucket);
  await writeJsonFile(filePath, value);
}

export function writePerEntityCacheSync(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  bucket: Exclude<MetadataBucketName, "entityDefs">,
  value: unknown
): void {
  const filePath = getPerEntityPath(ext, environmentName, logicalName, bucket);
  writeJsonFileSync(filePath, value);
}

export async function clearEnvironmentMetadataStorage(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await deleteDirectoryIfExists(getEnvironmentMetadataRootFsPath(ext, environmentName));
}

export async function clearBucketStorage(
  ext: vscode.ExtensionContext,
  environmentName: string,
  bucket: MetadataBucketName
): Promise<void> {
  if (bucket === "entityDefs") {
    await deleteFileIfExists(getEntityDefsCachePath(ext, environmentName));
    return;
  }

  await deleteDirectoryIfExists(path.dirname(getPerEntityPath(ext, environmentName, "sample", bucket)));
}

export function listBucketLogicalNames(
  ext: vscode.ExtensionContext,
  environmentName: string,
  bucket: Exclude<MetadataBucketName, "entityDefs">
): string[] {
  return listJsonBaseNames(path.dirname(getPerEntityPath(ext, environmentName, "sample", bucket)));
}

export function getMetadataStorageDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  rootPath: string;
  environmentRootPath: string;
  totalBytes: number;
  bucketBytes: Record<MetadataBucketName, number>;
  bucketEntityCounts: Record<MetadataBucketName, number>;
} {
  const environmentRootPath = getEnvironmentMetadataRootFsPath(ext, environmentName);
  const bucketBytes: Record<MetadataBucketName, number> = {
    entityDefs: getFileSizeSync(getEntityDefsCachePath(ext, environmentName)),
    fields: getDirectorySizeSync(path.dirname(getPerEntityPath(ext, environmentName, "sample", "fields"))),
    choices: getDirectorySizeSync(path.dirname(getPerEntityPath(ext, environmentName, "sample", "choices"))),
    relationships: getDirectorySizeSync(path.dirname(getPerEntityPath(ext, environmentName, "sample", "relationships"))),
    relationshipExplorer: getDirectorySizeSync(path.dirname(getPerEntityPath(ext, environmentName, "sample", "relationshipExplorer")))
  };

  const bucketEntityCounts: Record<MetadataBucketName, number> = {
    entityDefs: bucketBytes.entityDefs > 0 ? 1 : 0,
    fields: listBucketLogicalNames(ext, environmentName, "fields").length,
    choices: listBucketLogicalNames(ext, environmentName, "choices").length,
    relationships: listBucketLogicalNames(ext, environmentName, "relationships").length,
    relationshipExplorer: listBucketLogicalNames(ext, environmentName, "relationshipExplorer").length
  };

  return {
    rootPath: getMetadataRootFsPath(ext),
    environmentRootPath,
    totalBytes: getDirectorySizeSync(environmentRootPath),
    bucketBytes,
    bucketEntityCounts
  };
}

function getPerEntityPath(
  ext: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  bucket: Exclude<MetadataBucketName, "entityDefs">
): string {
  switch (bucket) {
    case "fields":
      return getEntityFieldsCachePath(ext, environmentName, logicalName);
    case "choices":
      return getEntityChoicesCachePath(ext, environmentName, logicalName);
    case "relationships":
      return getEntityRelationshipsCachePath(ext, environmentName, logicalName);
    case "relationshipExplorer":
      return getRelationshipExplorerCachePath(ext, environmentName, logicalName);
  }
}
