import { normalizeGuid } from "./pluginTraceQueryBuilder.js";

const FLOW_SESSION_SELECT = [
  "flowsessionid",
  "name",
  "workflowid",
  "flowid",
  "runid",
  "flowrunid",
  "environmentid",
  "correlationid",
  "requestid",
  "statecode",
  "statuscode",
  "status",
  "startedon",
  "completedon",
  "createdon",
  "modifiedon",
  "errormessage"
].join(",");

const FLOW_SESSION_SAFE_SELECT = [
  "flowsessionid",
  "name",
  "createdon",
  "modifiedon"
].join(",");

function eq(field: string, value: string): string | undefined {
  const guid = normalizeGuid(value);
  return guid ? `${field} eq ${guid}` : undefined;
}

export function buildFlowSessionRecordQuery(id: string): string | undefined {
  const guid = normalizeGuid(id);
  return guid ? `/flowsessions(${guid})?$select=${FLOW_SESSION_SELECT}` : undefined;
}

export function buildFlowSessionSafeRecordQuery(id: string): string | undefined {
  const guid = normalizeGuid(id);
  return guid ? `/flowsessions(${guid})?$select=${FLOW_SESSION_SAFE_SELECT}` : undefined;
}

export function buildFlowSessionLinkedQuery(args: {
  correlationId?: string;
  requestId?: string;
  workflowActivationId?: string;
  maxRows: number;
}): string | undefined {
  const filters = [
    args.correlationId ? eq("correlationid", args.correlationId) : undefined,
    args.requestId ? eq("requestid", args.requestId) : undefined,
    args.workflowActivationId ? eq("workflowid", args.workflowActivationId) : undefined,
    args.workflowActivationId ? eq("_workflowid_value", args.workflowActivationId) : undefined
  ].filter((part): part is string => !!part);

  if (!filters.length) {
    return undefined;
  }

  return `/flowsessions?$select=${FLOW_SESSION_SELECT}&$filter=${filters.join(" or ")}&$orderby=createdon desc&$top=${Math.max(1, args.maxRows)}`;
}

export function buildFlowSessionSafeLinkedQuery(args: {
  correlationId?: string;
  requestId?: string;
  workflowActivationId?: string;
  maxRows: number;
}): string | undefined {
  const filters = [
    args.correlationId ? eq("correlationid", args.correlationId) : undefined,
    args.requestId ? eq("requestid", args.requestId) : undefined,
    args.workflowActivationId ? eq("workflowid", args.workflowActivationId) : undefined
  ].filter((part): part is string => !!part);

  if (!filters.length) {
    return undefined;
  }

  return `/flowsessions?$select=${FLOW_SESSION_SAFE_SELECT}&$filter=${filters.join(" or ")}&$orderby=createdon desc&$top=${Math.max(1, args.maxRows)}`;
}
