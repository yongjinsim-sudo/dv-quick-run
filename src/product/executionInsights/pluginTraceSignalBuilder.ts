import type { PluginTraceSignal } from "./pluginTraceTypes.js";
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
      const parsed = Number(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return undefined;
}

export function extractPluginTraceRows(result: unknown): Record<string, unknown>[] {
  const record = asRecord(result);
  const value = record?.value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row);
}

export function extractExceptionMessage(exceptionDetails?: string): string | undefined {
  const text = String(exceptionDetails ?? "").trim();
  if (!text) {
    return undefined;
  }

  const xmlMessage = text.match(/<Message>([\s\S]*?)<\/Message>/i)?.[1]
    ?? text.match(/<message>([\s\S]*?)<\/message>/i)?.[1];
  if (xmlMessage?.trim()) {
    return xmlMessage.trim().replace(/\s+/g, " ");
  }

  try {
    const parsed = JSON.parse(text) as unknown;
    const record = asRecord(parsed);
    const message = readString(record ?? {}, ["Message", "message", "ExceptionMessage", "exceptionMessage"]);
    if (message) {
      return message.replace(/\s+/g, " ");
    }
  } catch {
    // Best-effort parser. Non-JSON exception text is handled below.
  }

  const firstLine = text.split(/\r?\n/).map((line) => line.trim()).find((line) => line.length > 0);
  return firstLine ? firstLine.slice(0, 500) : undefined;
}

export function buildPluginTraceSignal(row: Record<string, unknown>, confidence: PluginTraceSignal["confidence"]): PluginTraceSignal | undefined {
  const pluginTraceLogId = readGuid(row, ["plugintracelogid", "PluginTraceLogId"]);
  const typeName = readString(row, ["typename", "typeName", "TypeName", "name"]);
  const messageName = readString(row, ["messagename", "messageName", "MessageName"]);
  const entityName = readString(row, ["primaryentity", "entityname", "primaryEntity", "entityName", "PrimaryEntity"]);
  const exceptionDetails = readString(row, ["exceptiondetails", "exceptionDetails", "ExceptionDetails"]);
  const durationMs = readNumber(row, ["performanceexecutionduration", "duration", "durationMs", "PerformanceExecutionDuration"]);
  const stage = readNumber(row, ["stage", "Stage"]);
  const mode = readNumber(row, ["mode", "Mode"]);
  const depth = readNumber(row, ["depth", "Depth"]);

  const hasExecutionShape = !!typeName || !!messageName || typeof durationMs === "number" || !!exceptionDetails || typeof depth === "number";
  if (!hasExecutionShape) {
    return undefined;
  }

  return {
    pluginTraceLogId,
    correlationId: readGuid(row, ["correlationid", "correlationId", "CorrelationId"]),
    operationId: readGuid(row, ["operationid", "operationId", "OperationId"]),
    requestId: readGuid(row, ["requestid", "requestId", "RequestId"]),
    typeName,
    messageName,
    entityName,
    stage,
    mode,
    depth,
    durationMs,
    exceptionMessage: extractExceptionMessage(exceptionDetails),
    createdOn: readString(row, ["createdon", "createdOn", "CreatedOn"]),
    confidence
  };
}

export function buildPluginTraceSignals(result: unknown, confidence: PluginTraceSignal["confidence"]): PluginTraceSignal[] {
  return extractPluginTraceRows(result)
    .map((row) => buildPluginTraceSignal(row, confidence))
    .filter((signal): signal is PluginTraceSignal => !!signal);
}

export function findFirstTraceCorrelationId(result: unknown): string | undefined {
  for (const row of extractPluginTraceRows(result)) {
    const id = readGuid(row, ["correlationid", "operationid", "requestid"]);
    if (id) {
      return id;
    }
  }
  return undefined;
}
