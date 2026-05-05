import type { FlowSessionSignal } from "./flowSessionTypes.js";
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

function readFormattedString(row: Record<string, unknown>, fieldName: string): string | undefined {
  return readString(row, [`${fieldName}@OData.Community.Display.V1.FormattedValue`, `${fieldName}@Microsoft.Dynamics.CRM.formattedvalue`]);
}

function parsePossibleJson(value: string | undefined): Record<string, unknown> | undefined {
  if (!value) {
    return undefined;
  }

  try {
    return asRecord(JSON.parse(value));
  } catch {
    return undefined;
  }
}

function readFromJsonFields(row: Record<string, unknown>, names: string[]): string | undefined {
  const possibleJson = [
    readString(row, ["clientdata", "clientData"]),
    readString(row, ["data", "Data"]),
    readString(row, ["context", "Context"])
  ];

  for (const raw of possibleJson) {
    const parsed = parsePossibleJson(raw);
    if (!parsed) {
      continue;
    }

    const value = readString(parsed, names) ?? readGuid(parsed, names);
    if (value) {
      return value;
    }
  }

  return undefined;
}

function buildFlowRunUrl(args: { environmentId?: string; flowId?: string; runId?: string }): string | undefined {
  if (!args.environmentId || !args.flowId || !args.runId) {
    return undefined;
  }

  return `https://make.powerautomate.com/environments/${encodeURIComponent(args.environmentId)}/flows/${encodeURIComponent(args.flowId)}/runs/${encodeURIComponent(args.runId)}`;
}

export function extractFlowSessionRows(result: unknown): Record<string, unknown>[] {
  const record = asRecord(result);
  if (Array.isArray(record?.value)) {
    return record.value.map((row) => asRecord(row)).filter((row): row is Record<string, unknown> => !!row);
  }

  return record ? [record] : [];
}

export function buildFlowSessionSignal(row: Record<string, unknown>, confidence: FlowSessionSignal["confidence"]): FlowSessionSignal | undefined {
  const flowSessionId = readGuid(row, ["flowsessionid", "flowSessionId", "FlowSessionId"]);
  const flowId = readGuid(row, ["flowid", "flowId", "FlowId", "workflowid", "workflowId", "_workflowid_value"])
    ?? readFromJsonFields(row, ["flowId", "FlowId", "workflowId", "WorkflowId"]);
  const runId = readString(row, ["runid", "runId", "RunId", "flowrunid", "flowRunId", "FlowRunId"])
    ?? readFromJsonFields(row, ["runId", "RunId", "flowRunId", "FlowRunId"])
    ?? flowSessionId;
  const environmentId = readString(row, ["environmentid", "environmentId", "EnvironmentId"])
    ?? readFromJsonFields(row, ["environmentId", "EnvironmentId"]);
  const correlationId = readGuid(row, ["correlationid", "correlationId", "CorrelationId"]);
  const requestId = readGuid(row, ["requestid", "requestId", "RequestId"]);
  const workflowActivationId = readGuid(row, ["_workflowid_value", "workflowid", "workflowId"]);
  const stateCode = readNumber(row, ["statecode", "stateCode", "StateCode"]);
  const statusCode = readNumber(row, ["statuscode", "statusCode", "StatusCode"]);

  const hasFlowSessionShape = !!flowSessionId || !!flowId || !!runId || !!environmentId || typeof stateCode === "number" || typeof statusCode === "number";
  if (!hasFlowSessionShape) {
    return undefined;
  }

  const flowRunUrl = buildFlowRunUrl({ environmentId, flowId, runId });
  return {
    flowSessionId,
    flowId,
    runId,
    environmentId,
    correlationId,
    requestId,
    workflowActivationId,
    name: readString(row, ["name", "Name"]),
    stateCode,
    stateLabel: readFormattedString(row, "statecode"),
    statusCode,
    statusLabel: readFormattedString(row, "statuscode"),
    status: readString(row, ["status", "Status"]),
    startedOn: readString(row, ["startedon", "startedOn", "StartedOn"]),
    completedOn: readString(row, ["completedon", "completedOn", "CompletedOn"]),
    createdOn: readString(row, ["createdon", "createdOn", "CreatedOn"]),
    modifiedOn: readString(row, ["modifiedon", "modifiedOn", "ModifiedOn"]),
    errorMessage: readString(row, ["errormessage", "errorMessage", "ErrorMessage", "message", "Message"]),
    flowRunUrl,
    confidence,
    evidenceRef: {
      source: "flowSession",
      table: "flowsessions",
      id: flowSessionId,
      correlationId,
      requestId,
      workflowActivationId,
      workflowId: flowId,
      startedOn: readString(row, ["startedon", "startedOn", "StartedOn"]),
      completedOn: readString(row, ["completedon", "completedOn", "CompletedOn"]),
      stateCode,
      statusCode,
      stateLabel: readFormattedString(row, "statecode"),
      statusLabel: readFormattedString(row, "statuscode")
    }
  };
}

export function buildFlowSessionSignals(result: unknown, confidence: FlowSessionSignal["confidence"]): FlowSessionSignal[] {
  return extractFlowSessionRows(result)
    .map((row) => buildFlowSessionSignal(row, confidence))
    .filter((signal): signal is FlowSessionSignal => !!signal);
}
