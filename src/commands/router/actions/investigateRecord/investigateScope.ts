import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logDebug, logInfo } from "../../../../utils/logger.js";

export type InvestigateScopeSettings = {
  searchScopeTables: Set<string>;
  maxSearchTables: number;
  maxSearchColumns: number;
  scopeSignature: string;
};

function normalizeInvestigateTableName(value: string): string {
  return value.trim().toLowerCase();
}

function dedupeNonEmpty(values: string[]): string[] {
  return values
    .map((item) => normalizeInvestigateTableName(item))
    .filter((item, index, array) => item.length > 0 && array.indexOf(item) === index);
}

function getInvestigateListSetting(settingName: string, fallback: string[]): string[] {
  const value = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get(settingName, fallback) as unknown;

  if (!Array.isArray(value)) {
    return dedupeNonEmpty(fallback);
  }

  return dedupeNonEmpty(value.filter((item): item is string => typeof item === "string"));
}

function clampPositiveInteger(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 ? value : fallback;
}

function getInvestigateNumericSetting(settingName: string, fallback: number): number {
  const value = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get(settingName, fallback) as unknown;

  return clampPositiveInteger(value, fallback);
}

export function matchesInvestigatePattern(entity: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (!pattern.includes("*")) {
    return entity === pattern;
  }

  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexPattern, "i").test(entity);
}

export function loadInvestigateScopeSettings(ctx: CommandContext, options?: { log?: boolean }): InvestigateScopeSettings {
  const searchScopeTables = new Set(getInvestigateListSetting("investigate.searchScopeTables", ["account", "contact"]));
  const maxSearchTables = getInvestigateNumericSetting("investigate.maxSearchTables", 10);
  const maxSearchColumns = getInvestigateNumericSetting("investigate.maxSearchColumns", 50);
  const shouldLog = options?.log !== false;

  if (shouldLog) {
    logInfo(ctx.output, `[Investigate] Search scope applied: ${Array.from(searchScopeTables).join(", ") || "(none)"}`);
    logDebug(ctx.output, `[Investigate] Search limits: tables=${maxSearchTables}; columns=${maxSearchColumns}`);
  }

  return {
    searchScopeTables,
    maxSearchTables,
    maxSearchColumns,
    scopeSignature: JSON.stringify({
      searchScopeTables: [...searchScopeTables].sort(),
      maxSearchTables,
      maxSearchColumns
    })
  };
}
