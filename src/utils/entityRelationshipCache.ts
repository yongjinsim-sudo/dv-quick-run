import * as vscode from "vscode";
import type { NavPropertyDef } from "../services/entityRelationshipMetadataService.js";
import {
  clearBucketStorage,
  getMetadataStorageDiagnostics,
  listBucketLogicalNames,
  readPerEntityCacheSync,
  writePerEntityCache,
  writePerEntityCacheSync
} from "./metadataStorage.js";

const KEY_PREFIX = "dvQuickRun.entityRelationshipCache";
const KEY_VERSION = "v1";

type CacheShape = Record<string, NavPropertyDef[]>;

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

export function getCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): NavPropertyDef[] | undefined {
  const normalizedLogicalName = normalize(logicalName);
  const stored = readPerEntityCacheSync<NavPropertyDef[]>(ctx, environmentName, normalizedLogicalName, "relationships");
  if (stored) {
    return stored;
  }

  const legacyPayload = readLegacyAll(ctx, environmentName)[normalizedLogicalName];
  if (legacyPayload) {
    writePerEntityCacheSync(ctx, environmentName, normalizedLogicalName, "relationships", legacyPayload);
  }

  return legacyPayload;
}

export async function setCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  value: NavPropertyDef[]
): Promise<void> {
  await writePerEntityCache(ctx, environmentName, normalize(logicalName), "relationships", value);
}

export function getEntityRelationshipCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
  storageBytes: number;
} {
  const logicalNames = listBucketLogicalNames(ext, environmentName, "relationships");
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    const payload = readPerEntityCacheSync<NavPropertyDef[]>(ext, environmentName, logicalName, "relationships");
    countsByLogicalName[logicalName] = Array.isArray(payload) ? payload.length : 0;
  }

  return {
    logicalNames,
    countsByLogicalName,
    storageBytes: getMetadataStorageDiagnostics(ext, environmentName).bucketBytes.relationships
  };
}

export async function clearCachedNavigationProperties(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await clearBucketStorage(ext, environmentName, "relationships");
  await ext.workspaceState.update(buildKey(environmentName), undefined);
}
