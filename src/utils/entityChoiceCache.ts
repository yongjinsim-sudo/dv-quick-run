import * as vscode from "vscode";
import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";
import {
  clearBucketStorage,
  getMetadataStorageDiagnostics,
  listBucketLogicalNames,
  readPerEntityCacheSync,
  writePerEntityCache,
  writePerEntityCacheSync
} from "./metadataStorage.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY_PREFIX = "dvQuickRun.choiceMetadataCache";
const KEY_VERSION = "v1";

type CacheShape = Record<string, {
  fetchedAt: number;
  values: ChoiceMetadataDef[];
}>;

type CachePayload = {
  fetchedAt: number;
  values: ChoiceMetadataDef[];
};

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
  return ctx.globalState.get<CacheShape>(buildKey(environmentName)) ?? {};
}

function tryReadPayload(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): CachePayload | undefined {
  const normalizedLogicalName = normalize(logicalName);
  const stored = readPerEntityCacheSync<CachePayload>(ctx, environmentName, normalizedLogicalName, "choices");
  if (stored) {
    return stored;
  }

  const legacyPayload = readLegacyAll(ctx, environmentName)[normalizedLogicalName];
  if (legacyPayload) {
    writePerEntityCacheSync(ctx, environmentName, normalizedLogicalName, "choices", legacyPayload);
  }

  return legacyPayload;
}

export function getCachedChoiceMetadata(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): ChoiceMetadataDef[] | undefined {
  const payload = tryReadPayload(ctx, environmentName, logicalName);
  if (!payload?.values?.length) {
    return undefined;
  }

  const age = Date.now() - payload.fetchedAt;
  if (age > TTL_MS) {
    return undefined;
  }

  return payload.values;
}

export async function setCachedChoiceMetadata(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  values: ChoiceMetadataDef[]
): Promise<void> {
  await writePerEntityCache(ctx, environmentName, normalize(logicalName), "choices", {
    fetchedAt: Date.now(),
    values
  } satisfies CachePayload);
}

export function getEntityChoiceCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
  storageBytes: number;
} {
  const logicalNames = listBucketLogicalNames(ext, environmentName, "choices");
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    const payload = readPerEntityCacheSync<CachePayload>(ext, environmentName, logicalName, "choices");
    countsByLogicalName[logicalName] = Array.isArray(payload?.values)
      ? payload.values.length
      : 0;
  }

  return {
    logicalNames,
    countsByLogicalName,
    storageBytes: getMetadataStorageDiagnostics(ext, environmentName).bucketBytes.choices
  };
}

export async function clearCachedChoiceMetadata(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await clearBucketStorage(ext, environmentName, "choices");
  await ext.globalState.update(buildKey(environmentName), undefined);
}
