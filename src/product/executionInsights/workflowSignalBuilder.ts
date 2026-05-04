import type { WorkflowSignal } from "./workflowTypes.js";
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

export function extractWorkflowRows(result: unknown): Record<string, unknown>[] {
  const record = asRecord(result);
  const value = record?.value;
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((row) => asRecord(row))
    .filter((row): row is Record<string, unknown> => !!row);
}

export function buildWorkflowSignal(row: Record<string, unknown>, confidence: WorkflowSignal["confidence"]): WorkflowSignal | undefined {
  const workflowId = readGuid(row, ["workflowid", "workflowId", "WorkflowId"]);
  const workflowIdUnique = readGuid(row, ["workflowidunique", "workflowIdUnique", "WorkflowIdUnique"]);
  const activeWorkflowId = readGuid(row, ["_activeworkflowid_value", "activeworkflowid", "activeWorkflowId"]);
  const name = readString(row, ["name", "Name"]);
  const category = readNumber(row, ["category", "Category"]);
  const mode = readNumber(row, ["mode", "Mode"]);
  const primaryEntity = readString(row, ["primaryentity", "primaryEntity", "PrimaryEntity"]);
  const stateCode = readNumber(row, ["statecode", "stateCode", "StateCode"]);
  const statusCode = readNumber(row, ["statuscode", "statusCode", "StatusCode"]);

  if (!workflowId && !workflowIdUnique && !name) {
    return undefined;
  }

  return {
    workflowId,
    workflowIdUnique,
    activeWorkflowId,
    name,
    category,
    categoryLabel: readFormattedString(row, "category"),
    mode,
    modeLabel: readFormattedString(row, "mode"),
    primaryEntity,
    stateCode,
    stateLabel: readFormattedString(row, "statecode"),
    statusCode,
    statusLabel: readFormattedString(row, "statuscode"),
    type: readNumber(row, ["type", "Type"]),
    typeLabel: readFormattedString(row, "type"),
    modifiedOn: readString(row, ["modifiedon", "modifiedOn", "ModifiedOn"]),
    createdOn: readString(row, ["createdon", "createdOn", "CreatedOn"]),
    confidence,
    evidenceRef: {
      source: "workflow",
      table: "workflows",
      id: workflowId,
      workflowId,
      workflowIdUnique,
      primaryEntityName: primaryEntity,
      stateCode,
      statusCode,
      stateLabel: readFormattedString(row, "statecode"),
      statusLabel: readFormattedString(row, "statuscode")
    }
  };
}

export function buildWorkflowSignals(result: unknown, confidence: WorkflowSignal["confidence"]): WorkflowSignal[] {
  return extractWorkflowRows(result)
    .map((row) => buildWorkflowSignal(row, confidence))
    .filter((signal): signal is WorkflowSignal => !!signal);
}
