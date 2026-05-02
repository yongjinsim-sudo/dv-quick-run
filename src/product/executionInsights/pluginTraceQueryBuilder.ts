import { DEFAULT_PLUGIN_TRACE_MAX_ROWS } from "./pluginTraceTypes.js";

export const FULL_PLUGIN_TRACE_SELECT_FIELDS = [
  "plugintracelogid",
  "correlationid",
  "requestid",
  "typename",
  "messagename",
  "primaryentity",
  "depth",
  "mode",
  "performanceexecutionduration",
  "exceptiondetails",
  "createdon"
] as const;

// Cross-tenant safe baseline. These fields are used as a recovery path when
// richer plugintracelogs selects return Dataverse 400 in minimal environments.
export const SAFE_PLUGIN_TRACE_SELECT_FIELDS = [
  "plugintracelogid",
  "createdon",
  "typename",
  "messagename",
  "correlationid"
] as const;

const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function normalizeGuid(value: unknown): string | undefined {
  const text = String(value ?? "").trim().replace(/[{}]/g, "");
  return GUID_PATTERN.test(text) ? text.toLowerCase() : undefined;
}

function normalizeMaxRows(maxRows: number): number {
  return Math.max(1, Math.floor(maxRows));
}

function buildSelectClause(selectFields: readonly string[]): string {
  return selectFields.join(",");
}

export function buildPluginTraceRecentQuery(
  maxRows: number = DEFAULT_PLUGIN_TRACE_MAX_ROWS,
  selectFields: readonly string[] = FULL_PLUGIN_TRACE_SELECT_FIELDS
): string {
  return `/plugintracelogs?$select=${buildSelectClause(selectFields)}&$orderby=createdon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildPluginTraceSafeRecentQuery(maxRows: number = DEFAULT_PLUGIN_TRACE_MAX_ROWS): string {
  return buildPluginTraceRecentQuery(maxRows, SAFE_PLUGIN_TRACE_SELECT_FIELDS);
}

export function buildPluginTraceCorrelationQuery(
  id: string,
  maxRows: number = DEFAULT_PLUGIN_TRACE_MAX_ROWS,
  selectFields: readonly string[] = FULL_PLUGIN_TRACE_SELECT_FIELDS
): string | undefined {
  const guid = normalizeGuid(id);
  if (!guid) {
    return undefined;
  }

  const filter = [
    `correlationid eq ${guid}`,
    `requestid eq ${guid}`
  ].join(" or ");

  return `/plugintracelogs?$select=${buildSelectClause(selectFields)}&$filter=${encodeURIComponent(filter)}&$orderby=createdon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildPluginTraceSafeCorrelationQuery(id: string, maxRows: number = DEFAULT_PLUGIN_TRACE_MAX_ROWS): string | undefined {
  return buildPluginTraceCorrelationQuery(id, maxRows, SAFE_PLUGIN_TRACE_SELECT_FIELDS);
}
