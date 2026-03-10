import * as vscode from "vscode";
import type { NavPropertyDef } from "../services/entityRelationshipMetadataService.js";

const KEY = "dvQuickRun.entityRelationshipCache.v1";

type CacheShape = Record<string, NavPropertyDef[]>;

function normalize(logicalName: string): string {
  return logicalName.trim().toLowerCase();
}

function readAll(ctx: vscode.ExtensionContext): CacheShape {
  return ctx.workspaceState.get<CacheShape>(KEY) ?? {};
}

async function writeAll(ctx: vscode.ExtensionContext, value: CacheShape): Promise<void> {
  await ctx.workspaceState.update(KEY, value);
}

export function getCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  logicalName: string
): NavPropertyDef[] | undefined {
  const all = readAll(ctx);
  return all[normalize(logicalName)];
}

export async function setCachedNavigationProperties(
  ctx: vscode.ExtensionContext,
  logicalName: string,
  value: NavPropertyDef[]
): Promise<void> {
  const all = readAll(ctx);
  all[normalize(logicalName)] = value;
  await writeAll(ctx, all);
}

export function getEntityRelationshipCacheDiagnostics(ext: vscode.ExtensionContext): {
  logicalNames: string[];
  countsByLogicalName: Record<string, number>;
} {
  const store = ext.globalState.get<Record<string, any[]>>("dvQuickRun.entityRelationshipCache") ?? {};

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

export async function clearCachedNavigationProperties(ext: vscode.ExtensionContext): Promise<void> {
  await ext.globalState.update("dvQuickRun.entityRelationshipCache", undefined);
}