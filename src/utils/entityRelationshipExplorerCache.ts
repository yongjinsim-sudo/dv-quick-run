import * as vscode from "vscode";
import type { EntityRelationshipExplorerResult } from "../services/entityRelationshipExplorerService.js";

const KEY_PREFIX = "dvQuickRun.entityRelationshipExplorerCache";
const KEY_VERSION = "v1";

type CacheShape = Record<string, EntityRelationshipExplorerResult>;

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

export function getCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string
): EntityRelationshipExplorerResult | undefined {
  return readAll(ctx, environmentName)[normalize(logicalName)];
}

export async function setCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string,
  logicalName: string,
  value: EntityRelationshipExplorerResult
): Promise<void> {
  const all = readAll(ctx, environmentName);
  all[normalize(logicalName)] = value;
  await writeAll(ctx, environmentName, all);
}

export async function clearCachedEntityRelationships(
  ctx: vscode.ExtensionContext,
  environmentName: string
): Promise<void> {
  await ctx.workspaceState.update(buildKey(environmentName), undefined);
}