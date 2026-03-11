import * as vscode from "vscode";
import type { FieldDef } from "../services/entityFieldMetadataService";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

type CachePayloadV3 = {
  fetchedAt: number;
  fields: FieldDef[];
};

function key(logicalName: string) {
  // Bump version so old string[] cache is ignored automatically.
  return `dvQuickRun.fieldsCache.v3.${logicalName.toLowerCase()}`;
}

function normalizeFields(raw: any): FieldDef[] | undefined {
  if (!raw) {return undefined;}

  // v2 expected shape
  if (Array.isArray(raw) && raw.length > 0 && typeof raw[0] === "object") {
    const fields = raw as FieldDef[];
    return fields.filter(f => !!f && typeof f.logicalName === "string" && !!f.logicalName.trim());
  }

  // migration: old cache might be string[]
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
  logicalName: string
): FieldDef[] | undefined {
  const payload = context.globalState.get<CachePayloadV3>(key(logicalName));
  if (!payload) {return undefined;}

  const age = Date.now() - payload.fetchedAt;
  if (age > TTL_MS) {return undefined;}

  const normalized = normalizeFields(payload.fields);
  if (!normalized?.length) {return undefined;}

  return normalized;
}

export async function setCachedFields(
  context: vscode.ExtensionContext,
  logicalName: string,
  fields: FieldDef[]
): Promise<void> {
  const payload: CachePayloadV3 = {
    fetchedAt: Date.now(),
    fields
  };

  await context.globalState.update(key(logicalName), payload);
}

export function getEntityFieldCacheDiagnostics(ext: vscode.ExtensionContext): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
} {
  const store = ext.globalState.get<Record<string, any[]>>("dvQuickRun.entityFieldCache") ?? {};

  const logicalNames = Object.keys(store).sort();
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    countsByLogicalName[logicalName] = Array.isArray(store[logicalName]) ? store[logicalName].length : 0;
  }

  return {
    logicalNames,
    countsByLogicalName
  };
}

export async function clearCachedFields(ext: vscode.ExtensionContext): Promise<void> {
  await ext.globalState.update("dvQuickRun.entityFieldCache", undefined);
}