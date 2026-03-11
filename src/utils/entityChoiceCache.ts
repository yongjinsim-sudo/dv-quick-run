import * as vscode from "vscode";
import type { ChoiceMetadataDef } from "../services/entityChoiceMetadataService.js";

const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const KEY_PREFIX = "dvQuickRun.choiceMetadataCache";
const KEY_VERSION = "v1";

type CacheShape = Record<string, {
  fetchedAt: number;
  values: ChoiceMetadataDef[];
}>;

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

function readAll(ctx: vscode.ExtensionContext, environmentName: string): CacheShape {
  return ctx.globalState.get<CacheShape>(buildKey(environmentName)) ?? {};
}

async function writeAll(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  value: CacheShape
): Promise<void> {
  await ctx.globalState.update(buildKey(environmentName), value);
}

export function getCachedChoiceMetadata(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): ChoiceMetadataDef[] | undefined {
  const all = readAll(ctx, environmentName);
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
  environmentName: string,
  logicalName: string,
  values: ChoiceMetadataDef[]
): Promise<void> {
  const all = readAll(ctx, environmentName);
  all[normalize(logicalName)] = {
    fetchedAt: Date.now(),
    values
  };
  await writeAll(ctx, environmentName, all);
}

export function getEntityChoiceCacheDiagnostics(
  ext: vscode.ExtensionContext,
  environmentName: string
): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
} {
  const store = readAll(ext, environmentName);

  const logicalNames = Object.keys(store).sort();
  const countsByLogicalName: Record<string, number> = {};

  for (const logicalName of logicalNames) {
    countsByLogicalName[logicalName] = Array.isArray(store[logicalName]?.values)
      ? store[logicalName].values.length
      : 0;
  }

  return {
    logicalNames,
    countsByLogicalName
  };
}

export async function clearCachedChoiceMetadata(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await ext.globalState.update(buildKey(environmentName), undefined);
}