import * as vscode from "vscode";
import type { EntityMetadata } from "../metadata/metadataModel.js";
import {
  clearBucketStorage,
  getMetadataStorageDiagnostics,
  readEntityDefsCacheSync,
  writeEntityDefsCache,
  writeEntityDefsCacheSync
} from "./metadataStorage.js";

const KEY_PREFIX = "dvQuickRun.entityDefsCache";
const KEY_VERSION = "v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type EntityDef = EntityMetadata;

type CachePayload = {
  fetchedAt: number;
  defs: EntityDef[];
};

function normalizeEnvironmentKey(environmentName: string): string {
  return environmentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

function buildKey(environmentName: string): string {
  const envKey = normalizeEnvironmentKey(environmentName || "unknown");
  return `${KEY_PREFIX}.${envKey}.${KEY_VERSION}`;
}

function readPayload(
  context: vscode.ExtensionContext,
  environmentName: string
): CachePayload | undefined {
  const stored = readEntityDefsCacheSync<CachePayload>(context, environmentName);
  if (stored) {
    return stored;
  }

  const legacyPayload = context.globalState.get<CachePayload>(buildKey(environmentName));
  if (legacyPayload) {
    writeEntityDefsCacheSync(context, environmentName, legacyPayload);
  }

  return legacyPayload;
}

export function getCachedEntityDefs(
  context: vscode.ExtensionContext,
  environmentName: string
): EntityDef[] | undefined {
  const payload = readPayload(context, environmentName);
  if (!payload?.defs?.length) {
    return undefined;
  }

  const age = Date.now() - payload.fetchedAt;
  if (age > TTL_MS) {
    return undefined;
  }

  return payload.defs;
}

export async function setCachedEntityDefs(
  context: vscode.ExtensionContext,
  environmentName: string,
  defs: EntityDef[]
): Promise<void> {
  const payload: CachePayload = {
    fetchedAt: Date.now(),
    defs
  };

  await writeEntityDefsCache(context, environmentName, payload);
}

export function getEntitySetCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  count: number;
  logicalNames: string[];
  entitySetNames: string[];
  storageBytes: number;
} {
  const defs = getCachedEntityDefs(ext, environmentName) ?? [];

  return {
    count: defs.length,
    logicalNames: defs.map((d) => d.logicalName).sort(),
    entitySetNames: defs.map((d) => d.entitySetName).sort(),
    storageBytes: getMetadataStorageDiagnostics(ext, environmentName).bucketBytes.entityDefs
  };
}

export async function clearCachedEntityDefs(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await clearBucketStorage(ext, environmentName, "entityDefs");
  await ext.globalState.update(buildKey(environmentName), undefined);
}
