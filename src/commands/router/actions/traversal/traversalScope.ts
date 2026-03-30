import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo, logWarn } from "../../../../utils/logger.js";
import type {
  TraversalEntityNode,
  TraversalGraph
} from "../shared/traversal/traversalTypes.js";
import type { TraversalScopeSettings } from "./traversalActionTypes.js";

export function normalizeTraversalTableName(value: string): string {
  return value.trim().toLowerCase();
}

function getTraversalListSetting(settingName: string): string[] {
  const value = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<unknown[]>(settingName, []);

  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => normalizeTraversalTableName(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

function matchesPattern(entity: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (!pattern.includes("*")) {
    return entity === pattern;
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = "^" + escaped.replace(/\*/g, ".*") + "$";
  const regex = new RegExp(regexPattern, "i");

  return regex.test(entity);
}

function matchesAnyPattern(entity: string, patterns?: string[]): boolean {
  if (!patterns || patterns.length === 0) {
    return false;
  }

  return patterns.some((pattern) => matchesPattern(entity, pattern));
}

export function loadTraversalScopeSettings(ctx: CommandContext): TraversalScopeSettings {
  const allowedTables = new Set(getTraversalListSetting("traversal.allowedTables"));
  const excludedTables = new Set(getTraversalListSetting("traversal.excludedTables"));

  logInfo(
    ctx.output,
    `[Traversal] Scope applied: allowed=${allowedTables.size} patterns; excluded=${excludedTables.size} patterns`
  );

  if (allowedTables.size > 0) {
    logDebug(
      ctx.output,
      `[Traversal] Allowed patterns: ${Array.from(allowedTables).join(", ")}`
    );
  }

  if (excludedTables.size > 0) {
    logDebug(
      ctx.output,
      `[Traversal] Excluded patterns: ${Array.from(excludedTables).join(", ")}`
    );
  }

  if ([...excludedTables].some((pattern) => pattern.trim() === "*")) {
    logWarn(
      ctx.output,
      '[Traversal] Warning: excludedTables contains "*" — all tables will be excluded.'
    );
  }

  return {
    allowedTables,
    excludedTables,
    scopeSignature: JSON.stringify({
      allowedTables: [...allowedTables].sort(),
      excludedTables: [...excludedTables].sort()
    })
  };
}

function isTraversalEntityInScope(
  logicalName: string,
  sourceEntity: string,
  targetEntity: string,
  settings: TraversalScopeSettings
): boolean {
  const normalized = normalizeTraversalTableName(logicalName);

  if (normalized === sourceEntity || normalized === targetEntity) {
    return true;
  }

  const allowedPatterns = [...settings.allowedTables];
  const excludedPatterns = [...settings.excludedTables];

  if (allowedPatterns.length > 0 && !matchesAnyPattern(normalized, allowedPatterns)) {
    return false;
  }

  if (matchesAnyPattern(normalized, excludedPatterns)) {
    return false;
  }

  return true;
}

export function applyTraversalScopeToGraph(
  graph: TraversalGraph,
  sourceEntity: string,
  targetEntity: string,
  settings: TraversalScopeSettings
): TraversalGraph {
  const normalizedSource = normalizeTraversalTableName(sourceEntity);
  const normalizedTarget = normalizeTraversalTableName(targetEntity);
  const scopedEntities: Record<string, TraversalEntityNode> = {};

  for (const [logicalName, node] of Object.entries(graph.entities)) {
    if (!isTraversalEntityInScope(logicalName, normalizedSource, normalizedTarget, settings)) {
      continue;
    }

    scopedEntities[logicalName] = {
      ...node,
      outboundRelationships: node.outboundRelationships.filter((edge) =>
        isTraversalEntityInScope(edge.toEntity, normalizedSource, normalizedTarget, settings)
      )
    };
  }

  return {
    entities: scopedEntities
  };
}
