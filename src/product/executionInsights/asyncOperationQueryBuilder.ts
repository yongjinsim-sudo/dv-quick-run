import { DEFAULT_ASYNC_OPERATION_MAX_ROWS } from "./asyncOperationTypes.js";
import { normalizeGuid } from "./pluginTraceQueryBuilder.js";

export const FULL_ASYNC_OPERATION_SELECT_FIELDS = [
  "asyncoperationid",
  "correlationid",
  "requestid",
  "name",
  "operationtype",
  "messagename",
  "primaryentitytype",
  "statecode",
  "statuscode",
  "startedon",
  "completedon",
  "modifiedon",
  "createdon",
  "executiontimespan",
  "depth",
  "retrycount",
  "iswaitingforevent",
  "errorcode",
  "message",
  "friendlymessage",
  "_workflowactivationid_value"
] as const;

export const SAFE_ASYNC_OPERATION_SELECT_FIELDS = [
  "asyncoperationid",
  "correlationid",
  "requestid",
  "name",
  "statecode",
  "statuscode",
  "modifiedon",
  "createdon",
  "_workflowactivationid_value"
] as const;

function normalizeMaxRows(maxRows: number): number {
  return Math.max(1, Math.floor(maxRows));
}

function buildSelectClause(selectFields: readonly string[]): string {
  return selectFields.join(",");
}

export function buildAsyncOperationRecentQuery(
  maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS,
  selectFields: readonly string[] = FULL_ASYNC_OPERATION_SELECT_FIELDS
): string {
  return `/asyncoperations?$select=${buildSelectClause(selectFields)}&$orderby=modifiedon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildAsyncOperationSafeRecentQuery(maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS): string {
  return buildAsyncOperationRecentQuery(maxRows, SAFE_ASYNC_OPERATION_SELECT_FIELDS);
}

export function buildAsyncOperationCorrelationQuery(
  id: string,
  maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS,
  selectFields: readonly string[] = FULL_ASYNC_OPERATION_SELECT_FIELDS
): string | undefined {
  const guid = normalizeGuid(id);
  if (!guid) {
    return undefined;
  }

  const filter = `correlationid eq ${guid}`;
  return `/asyncoperations?$select=${buildSelectClause(selectFields)}&$filter=${encodeURIComponent(filter)}&$orderby=modifiedon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildAsyncOperationSafeCorrelationQuery(id: string, maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS): string | undefined {
  return buildAsyncOperationCorrelationQuery(id, maxRows, SAFE_ASYNC_OPERATION_SELECT_FIELDS);
}

export function buildAsyncOperationRequestQuery(
  id: string,
  maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS,
  selectFields: readonly string[] = FULL_ASYNC_OPERATION_SELECT_FIELDS
): string | undefined {
  const guid = normalizeGuid(id);
  if (!guid) {
    return undefined;
  }

  const filter = `requestid eq ${guid}`;
  return `/asyncoperations?$select=${buildSelectClause(selectFields)}&$filter=${encodeURIComponent(filter)}&$orderby=modifiedon desc&$top=${normalizeMaxRows(maxRows)}`;
}

export function buildAsyncOperationSafeRequestQuery(id: string, maxRows: number = DEFAULT_ASYNC_OPERATION_MAX_ROWS): string | undefined {
  return buildAsyncOperationRequestQuery(id, maxRows, SAFE_ASYNC_OPERATION_SELECT_FIELDS);
}
