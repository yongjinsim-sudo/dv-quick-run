import * as vscode from "vscode";

const KEY = "dvQuickRun.entityDefsCache";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

export type EntityDef = {
  entitySetName: string;
  logicalName: string;
};

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