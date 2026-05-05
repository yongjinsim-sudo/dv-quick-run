export type GroupedExecutionIdentifierKind =
  | "asyncOperationId"
  | "pluginTraceLogId"
  | "correlationId"
  | "requestId"
  | "workflowId"
  | "flowSessionId";

export interface GroupedExecutionIdentifierQuery {
  label: string;
  query: string;
  totalIdentifierCount: number;
  includedIdentifierCount: number;
  capped: boolean;
}

export interface BuildGroupedIdentifierQueryArgs {
  kind: GroupedExecutionIdentifierKind;
  identifiers: Array<string | undefined>;
  maxIdentifiers?: number;
  top?: number;
}

interface GroupedIdentifierTarget {
  table: string;
  idField: string;
  selectFields: readonly string[];
  orderBy?: string;
  label: string;
}

const DEFAULT_MAX_GROUPED_IDENTIFIERS = 10;
const DEFAULT_GROUPED_QUERY_TOP = 25;
const GUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const TARGETS: Record<GroupedExecutionIdentifierKind, GroupedIdentifierTarget> = {
  asyncOperationId: {
    table: "asyncoperations",
    idField: "asyncoperationid",
    selectFields: [
      "name",
      "asyncoperationid",
      "correlationid",
      "requestid",
      "statecode",
      "statuscode",
      "startedon",
      "completedon",
      "executiontimespan",
      "_workflowactivationid_value"
    ],
    orderBy: "startedon desc",
    label: "Query grouped asyncoperations"
  },
  pluginTraceLogId: {
    table: "plugintracelogs",
    idField: "plugintracelogid",
    selectFields: [
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
    ],
    orderBy: "createdon desc",
    label: "Query grouped plugin traces"
  },
  correlationId: {
    table: "asyncoperations",
    idField: "correlationid",
    selectFields: [
      "name",
      "asyncoperationid",
      "correlationid",
      "requestid",
      "statecode",
      "statuscode",
      "startedon",
      "completedon",
      "executiontimespan",
      "_workflowactivationid_value"
    ],
    orderBy: "startedon desc",
    label: "Query grouped correlations"
  },
  requestId: {
    table: "asyncoperations",
    idField: "requestid",
    selectFields: [
      "name",
      "asyncoperationid",
      "correlationid",
      "requestid",
      "statecode",
      "statuscode",
      "startedon",
      "completedon",
      "executiontimespan",
      "_workflowactivationid_value"
    ],
    orderBy: "startedon desc",
    label: "Query grouped requests"
  },
  workflowId: {
    table: "workflows",
    idField: "workflowid",
    selectFields: [
      "name",
      "workflowid",
      "workflowidunique",
      "category",
      "mode",
      "primaryentity",
      "statecode",
      "statuscode"
    ],
    label: "Query grouped workflows"
  },
  flowSessionId: {
    table: "flowsessions",
    idField: "flowsessionid",
    selectFields: [
      "flowsessionid",
      "name",
      "correlationid",
      "createdon",
      "modifiedon",
      "statecode",
      "statuscode"
    ],
    orderBy: "createdon desc",
    label: "Query grouped flow sessions"
  }
};

function normalizeGuid(value: string | undefined): string | undefined {
  const text = String(value ?? "").trim().replace(/[{}]/g, "");
  return GUID_PATTERN.test(text) ? text.toLowerCase() : undefined;
}

function normalizePositiveInteger(value: number | undefined, fallback: number): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(1, Math.floor(value));
}

export function normalizeGroupedIdentifiers(
  identifiers: Array<string | undefined>,
  maxIdentifiers: number = DEFAULT_MAX_GROUPED_IDENTIFIERS
): { values: string[]; totalIdentifierCount: number; capped: boolean } {
  const allValues = Array.from(new Set(
    identifiers
      .map(normalizeGuid)
      .filter((value): value is string => !!value)
  ));
  const normalizedMax = normalizePositiveInteger(maxIdentifiers, DEFAULT_MAX_GROUPED_IDENTIFIERS);

  return {
    values: allValues.slice(0, normalizedMax),
    totalIdentifierCount: allValues.length,
    capped: allValues.length > normalizedMax
  };
}

export function buildGroupedIdentifierInvestigationQuery(
  args: BuildGroupedIdentifierQueryArgs
): GroupedExecutionIdentifierQuery | undefined {
  const target = TARGETS[args.kind];
  if (!target) {
    return undefined;
  }

  const normalized = normalizeGroupedIdentifiers(args.identifiers, args.maxIdentifiers);
  if (normalized.values.length === 0) {
    return undefined;
  }

  const filter = normalized.values
    .map((id) => `${target.idField} eq ${id}`)
    .join(" or ");
  const top = normalizePositiveInteger(args.top, DEFAULT_GROUPED_QUERY_TOP);
  const orderBy = target.orderBy ? `&$orderby=${encodeURIComponent(target.orderBy)}` : "";

  return {
    label: normalized.values.length > 1 ? target.label : `Query ${target.label.replace(/^Query grouped /, "")}`,
    query: `/${target.table}?$select=${target.selectFields.join(",")}&$filter=${encodeURIComponent(filter)}${orderBy}&$top=${top}`,
    totalIdentifierCount: normalized.totalIdentifierCount,
    includedIdentifierCount: normalized.values.length,
    capped: normalized.capped
  };
}
