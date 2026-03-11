import * as vscode from "vscode";
import type { EntityMetadata } from "../metadata/metadataModel.js";

const KEY = "dvQuickRun.entityDefsCache.v1";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type EntityDef = EntityMetadata;

type CachePayload = {
  fetchedAt: number;
  defs: EntityDef[];
};

export function getCachedEntityDefs(context: vscode.ExtensionContext): EntityDef[] | undefined {
  const payload = context.globalState.get<CachePayload>(KEY);
  if (!payload?.defs?.length) {return undefined;}

  const age = Date.now() - payload.fetchedAt;
  if (age > TTL_MS) {return undefined;}

  return payload.defs;
}

export async function setCachedEntityDefs(
  context: vscode.ExtensionContext,
  defs: EntityDef[]
): Promise<void> {
  const payload: CachePayload = {
    fetchedAt: Date.now(),
    defs
  };

  await context.globalState.update(KEY, payload);
}


export function getEntitySetCacheDiagnostics(ext: vscode.ExtensionContext): {
  count: number;
  logicalNames: string[];
  entitySetNames: string[];
} {
  const defs = getCachedEntityDefs(ext) ?? [];

  return {
    count: defs.length,
    logicalNames: defs.map((d) => d.logicalName).sort(),
    entitySetNames: defs.map((d) => d.entitySetName).sort()
  };
}

export async function clearCachedEntityDefs(ext: vscode.ExtensionContext): Promise<void> {
  await ext.globalState.update(KEY, undefined);
}