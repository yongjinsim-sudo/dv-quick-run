import * as vscode from "vscode";
import type { NavPropertyDef } from "../services/entityRelationshipMetadataService.js";

const KEY = "dvQuickRun.entityRelationshipCache";

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