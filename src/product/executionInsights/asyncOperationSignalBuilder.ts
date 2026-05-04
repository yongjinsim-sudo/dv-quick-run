import type { ExecutionInsightSeverity } from "./executionInsightTypes.js";
import type { AsyncOperationSignal } from "./asyncOperationTypes.js";
import { normalizeGuid } from "./pluginTraceQueryBuilder.js";

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
}

function readString(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return undefined;
}

function readGuid(row: Record<string, unknown>, names: string[]): string | undefined {
  for (const name of names) {
    const guid = normalizeGuid(row[name]);
    if (guid) {
      return guid;
    }
  }
  return undefined;
}

function readNumber(row: Record<string, unknown>, names: string[]): number | undefined {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.replace(/,/g, ""));
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

function readBoolean(row: Record<string, unknown>, names: string[]): boolean | undefined {
  for (const name of names) {
    const value = row[name];
    if (typeof value === "boolean") {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      if (/^true$/i.test(value.trim())) {
        return true;
      }
      if (/^false$/i.test(value.trim())) {
        return false;
      }
    }
  }
  return undefined;
}

function readFormattedString(row: Record<string, unknown>, fieldName: string): string | undefined {
  return readString(row, [`${fieldName}@OData.Community.Display.V1.FormattedValue`, `${fieldName}@Microsoft.Dynamics.CRM.formattedvalue`]);
}

function deriveExecutionMs(row: Record<string, unknown>): number | undefined {
  const executionTimeSpan = readNumber(row, ["executiontimespan", "executionTimeSpan", "ExecutionTimeSpan"]);
  if (typeof executionTimeSpan === "number" && executionTimeSpan > 0) {
    return executionTimeSpan * 1000;
  }

  const started = readString(row, ["startedon", "startedOn", "StartTime"]);
  const completed = readString(row, ["completedon", "completedOn", "EndTime"]);
  if (started && completed) {
    const diff = Date.parse(completed) - Date.parse(started);
    if (Number.isFinite(diff) && diff >= 0) {
      return diff;
    }
  }

  const friendlyMessage = readString(row, ["friendlymessage", "friendlyMessage"]);
  if (!friendlyMessage) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(friendlyMessage) as unknown;
    const record = asRecord(parsed);
    const start = readString(record ?? {}, ["StartTime"]);
    const end = readString(record ?? {}, ["EndTime"]);
    if (start && end) {
      const diff = Date.parse(end) - Date.parse(start);
      if (Number.isFinite(diff) && diff >= 0) {
        return diff;
      }
    }
  } catch {
    // friendlymessage is best-effort only.
  }

  return undefined;
}

function summarizeFriendlyMessage(row: Record<string, unknown>): string | undefined {
  const friendlyMessage = readString(row, ["friendlymessage", "friendlyMessage"]);
  if (!friendlyMessage) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(friendlyMessage) as unknown;
    const record = asRecord(parsed);
    const isCompleted = record?.IsCompleted;
    const runId = readGuid(record ?? {}, ["RunId"]);
    const endpointResults = record?.EndpointResults;
    const endpointCount = Array.isArray(endpointResults) ? endpointResults.length : undefined;
    const parts = [
      typeof isCompleted === "boolean" ? `completed=${isCompleted}` : undefined,
      runId ? `run=${runId}` : undefined,
      typeof endpointCount === "number" ? `endpoints=${endpointCount}` : undefined
    ].filter((part): part is string => !!part);
    return parts.length ? parts.join(" · ") : undefined;
  } catch {
    return friendlyMessage.slice(0, 160);
  }
}

function classifySeverity(args: {
  stateLabel?: string;
  statusLabel?: string;
  retryCount?: number;
  isWaitingForEvent?: boolean;
  errorCode?: number;
}): ExecutionInsightSeverity {
  const combined = `${args.stateLabel ?? ""} ${args.statusLabel ?? ""}`.toLowerCase();
  if (/failed|cancel/.test(combined) || typeof args.errorCode === "number") {
    return "high";
  }
  if (/suspend|waiting|wait/.test(combined) || args.isWaitingForEvent) {
    return "medium";
  }
  if ((args.retryCount ?? 0) > 0 || /retry|in progress|processing|paus/.test(combined)) {
    return "low";
  }
  return "low";
}

export function extractAsyncOperationRows(result: unknown): Record<string, unknown>[] {
  const record = asRecord(result);
  const value = record?.value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row);
}

export function buildAsyncOperationSignal(row: Record<string, unknown>, confidence: AsyncOperationSignal["confidence"]): AsyncOperationSignal | undefined {
  const asyncOperationId = readGuid(row, ["asyncoperationid", "asyncOperationId", "AsyncOperationId"]);
  const stateCode = readNumber(row, ["statecode", "stateCode", "StateCode"]);
  const statusCode = readNumber(row, ["statuscode", "statusCode", "StatusCode"]);
  const stateLabel = readFormattedString(row, "statecode");
  const statusLabel = readFormattedString(row, "statuscode");
  const retryCount = readNumber(row, ["retrycount", "retryCount", "RetryCount"]);
  const isWaitingForEvent = readBoolean(row, ["iswaitingforevent", "isWaitingForEvent", "IsWaitingForEvent"]);
  const errorCode = readNumber(row, ["errorcode", "errorCode", "ErrorCode"]);
  const executionTimeMs = deriveExecutionMs(row);
  const severity = classifySeverity({ stateLabel, statusLabel, retryCount, isWaitingForEvent, errorCode });
  const correlationId = readGuid(row, ["correlationid", "correlationId", "CorrelationId"]);
  const requestId = readGuid(row, ["requestid", "requestId", "RequestId"]);
  const operationId = readGuid(row, ["operationid", "operationId", "OperationId"]);
  const workflowActivationId = readGuid(row, ["_workflowactivationid_value", "workflowactivationid", "workflowActivationId"]);
  const primaryEntityType = readString(row, ["primaryentitytype", "primaryEntityType", "PrimaryEntityType"]);
  const messageName = readString(row, ["messagename", "messageName", "MessageName"]);

  const hasExecutionShape = !!asyncOperationId || !!correlationId || !!requestId || typeof stateCode === "number" || typeof statusCode === "number";
  if (!hasExecutionShape) {
    return undefined;
  }

  const startedOn = readString(row, ["startedon", "startedOn", "StartedOn"]);
  const completedOn = readString(row, ["completedon", "completedOn", "CompletedOn"]);
  const modifiedOn = readString(row, ["modifiedon", "modifiedOn", "ModifiedOn"]);
  const createdOn = readString(row, ["createdon", "createdOn", "CreatedOn"]);

  return {
    asyncOperationId,
    correlationId,
    requestId,
    operationId,
    workflowActivationId,
    name: readString(row, ["name", "Name"]),
    operationType: readNumber(row, ["operationtype", "operationType", "OperationType"]),
    operationTypeLabel: readFormattedString(row, "operationtype"),
    messageName,
    primaryEntityType,
    stateCode,
    stateLabel,
    statusCode,
    statusLabel,
    startedOn,
    completedOn,
    modifiedOn,
    createdOn,
    executionTimeSeconds: typeof executionTimeMs === "number" ? Math.round(executionTimeMs / 1000) : undefined,
    executionTimeMs,
    depth: readNumber(row, ["depth", "Depth"]),
    retryCount,
    isWaitingForEvent,
    errorCode,
    message: readString(row, ["message", "Message"]),
    friendlyMessageSummary: summarizeFriendlyMessage(row),
    confidence,
    severity,
    evidenceRef: {
      source: "asyncOperation",
      table: "asyncoperations",
      id: asyncOperationId,
      correlationId,
      requestId,
      operationId,
      workflowActivationId,
      primaryEntityName: primaryEntityType,
      messageName,
      startedOn,
      completedOn,
      durationMs: executionTimeMs,
      stateCode,
      statusCode,
      stateLabel,
      statusLabel
    }
  };
}

export function buildAsyncOperationSignals(result: unknown, confidence: AsyncOperationSignal["confidence"]): AsyncOperationSignal[] {
  return extractAsyncOperationRows(result)
    .map((row) => buildAsyncOperationSignal(row, confidence))
    .filter((signal): signal is AsyncOperationSignal => !!signal);
}

export function findFirstAsyncOperationCorrelationId(result: unknown): string | undefined {
  for (const row of extractAsyncOperationRows(result)) {
    const id = readGuid(row, ["correlationid"]);
    if (id) {
      return id;
    }
  }
  return undefined;
}

export function findFirstAsyncOperationRequestId(result: unknown): string | undefined {
  for (const row of extractAsyncOperationRows(result)) {
    const id = readGuid(row, ["requestid"]);
    if (id) {
      return id;
    }
  }
  return undefined;
}

export function findWorkflowActivationIds(signals: AsyncOperationSignal[]): string[] {
  return Array.from(new Set(signals.map((signal) => signal.workflowActivationId).filter((id): id is string => !!id)));
}
