import * as vscode from "vscode";
import type { EntityRelationshipExplorerResult } from "../services/entityRelationshipExplorerService.js";
import {
  clearBucketStorage,
  getMetadataStorageDiagnostics,
  listBucketLogicalNames,
  readPerEntityCacheSync,
  writePerEntityCache,
  writePerEntityCacheSync
} from "./metadataStorage.js";

const KEY_PREFIX = "dvQuickRun.entityRelationshipExplorerCache";
const KEY_VERSION = "v1";

type CacheShape = Record<string, EntityRelationshipExplorerResult>;

function normalizeEnvironmentKey(environmentName: string): string {
  return environmentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

function normalize(logicalName: string): string {
  return logicalName.trim().toLowerCase();
}

function buildKey(environmentName: string): string {
  return `${KEY_PREFIX}.${normalizeEnvironmentKey(environmentName)}.${KEY_VERSION}`;
}

function readLegacyAll(ctx: vscode.ExtensionContext, environmentName: string): CacheShape {
  return ctx.workspaceState.get<CacheShape>(buildKey(environmentName)) ?? {};
}

export function getCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): EntityRelationshipExplorerResult | undefined {
  const normalizedLogicalName = normalize(logicalName);
  const stored = readPerEntityCacheSync<EntityRelationshipExplorerResult>(ctx, environmentName, normalizedLogicalName, "relationshipExplorer");
  if (stored) {
    return stored;
  }

  const legacyPayload = readLegacyAll(ctx, environmentName)[normalizedLogicalName];
  if (legacyPayload) {
    writePerEntityCacheSync(ctx, environmentName, normalizedLogicalName, "relationshipExplorer", legacyPayload);
  }

  return legacyPayload;
}

export async function setCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  value: EntityRelationshipExplorerResult
): Promise<void> {
  await writePerEntityCache(ctx, environmentName, normalize(logicalName), "relationshipExplorer", value);
}

export function getEntityRelationshipExplorerCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  storageBytes: number;
} {
  return {
    logicalNames: listBucketLogicalNames(ext, environmentName, "relationshipExplorer"),
    storageBytes: getMetadataStorageDiagnostics(ext, environmentName).bucketBytes.relationshipExplorer
  };
}

export async function clearCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await clearBucketStorage(ctx, environmentName, "relationshipExplorer");
  await ctx.workspaceState.update(buildKey(environmentName), undefined);
}
