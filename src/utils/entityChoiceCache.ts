import * as vscode from "vscode";
import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY = "dvQuickRun.choiceMetadataCache.v1";

type CacheShape = Record<string, {
  fetchedAt: number;
  values: ChoiceMetadataDef[];
}>;

function normalize(logicalName: string): string {
  return logicalName.trim().toLowerCase();
}

function readAll(ctx: vscode.ExtensionContext): CacheShape {
  return ctx.globalState.get<CacheShape>(KEY) ?? {};
}

async function writeAll(ctx: vscode.ExtensionContext, value: CacheShape): Promise<void> {
  await ctx.globalState.update(KEY, value);
}

export function getCachedChoiceMetadata(
  ctx: vscode.ExtensionContext,
  logicalName: string
): ChoiceMetadataDef[] | undefined {
  const all = readAll(ctx);
  const payload = all[normalize(logicalName)];
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
  logicalName: string,
  values: ChoiceMetadataDef[]
): Promise<void> {
  const all = readAll(ctx);
  all[normalize(logicalName)] = {
    fetchedAt: Date.now(),
    values
  };
  await writeAll(ctx, all);
}

export function getEntityChoiceCacheDiagnostics(ext: vscode.ExtensionContext): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
} {
  const store = ext.globalState.get<Record<string, any[]>>("dvQuickRun.entityChoiceCache") ?? {};

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

export async function clearCachedChoiceMetadata(ext: vscode.ExtensionContext): Promise<void> {
  await ext.globalState.update("dvQuickRun.entityChoiceCache", undefined);
}