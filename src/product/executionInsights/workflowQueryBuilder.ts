import { normalizeGuid } from "./pluginTraceQueryBuilder.js";
import { DEFAULT_WORKFLOW_MAX_ROWS } from "./workflowTypes.js";

export const FULL_WORKFLOW_SELECT_FIELDS = [
  "workflowid",
  "workflowidunique",
  "name",
  "category",
  "mode",
  "primaryentity",
  "statecode",
  "statuscode",
  "type",
  "modifiedon",
  "createdon",
  "_activeworkflowid_value"
] as const;

export const SAFE_WORKFLOW_SELECT_FIELDS = [
  "workflowid",
  "workflowidunique",
  "name",
  "category",
  "mode",
  "primaryentity",
  "statecode",
  "statuscode"
] as const;

function normalizeMaxRows(maxRows: number): number {
  return Math.max(1, Math.floor(maxRows));
}

function buildSelectClause(selectFields: readonly string[]): string {
  return selectFields.join(",");
}

export function buildWorkflowByIdQuery(
  id: string,
  maxRows: number = DEFAULT_WORKFLOW_MAX_ROWS,
  selectFields: readonly string[] = FULL_WORKFLOW_SELECT_FIELDS
): string | undefined {
  const guid = normalizeGuid(id);
  if (!guid) {
    return undefined;
  }

  const filter = [`workflowid eq ${guid}`, `workflowidunique eq ${guid}`].join(" or ");
  return `/workflows?$select=${buildSelectClause(selectFields)}&$filter=${encodeURIComponent(filter)}&$orderby=modifiedon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildWorkflowSafeByIdQuery(id: string, maxRows: number = DEFAULT_WORKFLOW_MAX_ROWS): string | undefined {
  return buildWorkflowByIdQuery(id, maxRows, SAFE_WORKFLOW_SELECT_FIELDS);
}
