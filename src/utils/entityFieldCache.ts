import * as vscode from "vscode";
import type { FieldDef } from "../services/entityFieldMetadataService.js";
import {
  clearBucketStorage,
  getMetadataStorageDiagnostics,
  listBucketLogicalNames,
  readPerEntityCacheSync,
  writePerEntityCache,
  writePerEntityCacheSync
} from "./metadataStorage.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY_PREFIX = "dvQuickRun.fieldsCache";
const KEY_VERSION = "v3";

type CachePayloadV3 = {
  fetchedAt: number;
  fields: FieldDef[];
};

function normalizeEnvironmentKey(environmentName: string): string {
  return environmentName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-");
}

function key(environmentName: string, logicalName: string) {
  return `${KEY_PREFIX}.${normalizeEnvironmentKey(environmentName)}.${KEY_VERSION}.${logicalName.toLowerCase()}`;
}

function normalizeFields(raw: any): FieldDef[] | undefined {
  if (!raw) {return undefined;}

  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    const fields = raw as FieldDef[];
    return fields.filter(f => !!f && typeof f.logicalName === "string" && !!f.logicalName.trim());
  }

  if (Array.isArray(raw) && (raw.length === 0 || typeof raw[0] === "string")) {
    const fields = (raw as string[])
      .map(s => (s ?? "").toString().trim())
      .filter(Boolean)
      .map(s => ({ logicalName: s } as FieldDef));

    return fields.length ? fields : undefined;
  }

  return undefined;
}

function readPayload(
  context: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): CachePayloadV3 | undefined {
  const normalizedLogicalName = logicalName.toLowerCase();
  const stored = readPerEntityCacheSync<CachePayloadV3>(context, environmentName, normalizedLogicalName, "fields");
  if (stored) {
    return stored;
  }

  const legacyPayload = context.globalState.get<CachePayloadV3>(key(environmentName, logicalName));
  if (legacyPayload) {
    writePerEntityCacheSync(context, environmentName, normalizedLogicalName, "fields", legacyPayload);
  }

  return legacyPayload;
}

export function getCachedFields(
  context: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): FieldDef[] | undefined {
  const payload = readPayload(context, environmentName, logicalName);
  if (!payload) {return undefined;}

  const age = Date.now() - payload.fetchedAt;
  if (age > TTL_MS) {return undefined;}

  const normalized = normalizeFields(payload.fields);
  if (!normalized?.length) {return undefined;}

  return normalized;
}

export async function setCachedFields(
  context: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  fields: FieldDef[]
): Promise<void> {
  const payload: CachePayloadV3 = {
    fetchedAt: Date.now(),
    fields
  };

  await writePerEntityCache(context, environmentName, logicalName.toLowerCase(), "fields", payload);
}

export function getEntityFieldCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
  storageBytes: number;
} {
  const logicalNames = listBucketLogicalNames(ext, environmentName, "fields");
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    const payload = readPerEntityCacheSync<CachePayloadV3>(ext, environmentName, logicalName, "fields");
    countsByLogicalName[logicalName] = Array.isArray(payload?.fields) ? payload.fields.length : 0;
  }

  return {
    logicalNames,
    countsByLogicalName,
    storageBytes: getMetadataStorageDiagnostics(ext, environmentName).bucketBytes.fields
  };
}

export async function clearCachedFields(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  const envKey = normalizeEnvironmentKey(environmentName);
  const prefix = `${KEY_PREFIX}.${envKey}.${KEY_VERSION}.`;

  await clearBucketStorage(ext, environmentName, "fields");
  await Promise.all(
    ext.globalState.keys()
      .filter((k: string) => k.startsWith(prefix))
      .map((k: string) => ext.globalState.update(k, undefined))
  );
}
