import * as vscode from "vscode";
import type { EntityRelationshipExplorerResult } from "../services/entityRelationshipExplorerService.js";

const KEY = "dvQuickRun.entityRelationshipExplorerCache";

type CacheShape = Record<string, EntityRelationshipExplorerResult>;

function normalize(logicalName: string): string {
  return logicalName.trim().toLowerCase();
}

function readAll(ctx: vscode.ExtensionContext): CacheShape {
  return ctx.workspaceState.get<CacheShape>(KEY) ?? {};
}

async function writeAll(ctx: vscode.ExtensionContext, value: CacheShape): Promise<void> {
  await ctx.workspaceState.update(KEY, value);
}

export function getCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  logicalName: string
): EntityRelationshipExplorerResult | undefined {
  return readAll(ctx)[normalize(logicalName)];
}

export async function setCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  logicalName: string,
  value: EntityRelationshipExplorerResult
): Promise<void> {
  const all = readAll(ctx);
  all[normalize(logicalName)] = value;
  await writeAll(ctx, all);
}