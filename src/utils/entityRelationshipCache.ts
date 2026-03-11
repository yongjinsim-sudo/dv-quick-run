import * as vscode from "vscode";
import type { NavPropertyDef } from "../services/entityRelationshipMetadataService.js";

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

function readAll(ctx: vscode.ExtensionContext, environmentName: string): CacheShape {
  return ctx.workspaceState.get<CacheShape>(buildKey(environmentName)) ?? {};
}

async function writeAll(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  value: CacheShape
): Promise<void> {
  await ctx.workspaceState.update(buildKey(environmentName), value);
}

export function getCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): NavPropertyDef[] | undefined {
  const all = readAll(ctx, environmentName);
  return all[normalize(logicalName)];
}

export async function setCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  value: NavPropertyDef[]
): Promise<void> {
  const all = readAll(ctx, environmentName);
  all[normalize(logicalName)] = value;
  await writeAll(ctx, environmentName, all);
}

export function getEntityRelationshipCacheDiagnostics(
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
    countsByLogicalName[logicalName] = Array.isArray(store[logicalName]) ? store[logicalName].length : 0;
  }

  return {
    logicalNames,
    countsByLogicalName
  };
}

export async function clearCachedNavigationProperties(
  ext: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await ext.workspaceState.update(buildKey(environmentName), undefined);
}