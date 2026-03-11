import * as vscode from "vscode";
import type { FieldDef } from "../services/entityFieldMetadataService";

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

export function getCachedFields(
  context: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): FieldDef[] | undefined {
  const payload = context.globalState.get<CachePayloadV3>(key(environmentName, logicalName));
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

  await context.globalState.update(key(environmentName, logicalName), payload);
}

export function getEntityFieldCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
} {
  const envKey = normalizeEnvironmentKey(environmentName);
  const allKeys = ext.globalState.keys();
  const prefix = `${KEY_PREFIX}.${envKey}.${KEY_VERSION}.`;

  const matchingKeys = allKeys.filter(k => k.startsWith(prefix)).sort();
  const logicalNames = matchingKeys.map(k => k.slice(prefix.length));
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    const payload = ext.globalState.get<CachePayloadV3>(key(environmentName, logicalName));
    countsByLogicalName[logicalName] = Array.isArray(payload?.fields) ? payload!.fields.length : 0;
  }

  return {
    logicalNames,
    countsByLogicalName
  };
}

export async function clearCachedFields(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  const envKey = normalizeEnvironmentKey(environmentName);
  const prefix = `${KEY_PREFIX}.${envKey}.${KEY_VERSION}.`;

  await Promise.all(
    ext.globalState.keys()
      .filter(k => k.startsWith(prefix))
      .map(k => ext.globalState.update(k, undefined))
  );
}