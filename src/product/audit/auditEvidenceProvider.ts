import type { CommandContext } from "../../commands/context/commandContext.js";
import type { AuditEvidenceQueryRequest, AuditEvidenceRecord, AuditEvidenceResult } from "./auditEvidenceTypes.js";

interface DataverseAuditResponse {
  readonly value?: readonly Record<string, unknown>[];
}

function encodeODataString(value: string): string {
  return value.replace(/'/g, "''");
}

function buildAuditSelect(): string {
  return [
    "auditid",
    "createdon",
    "operation",
    "action",
    "attributemask",
    "changedata",
    "_userid_value",
    "_objectid_value",
    "objecttypecode"
  ].join(",");
}

function buildAuditQueryPath(request: AuditEvidenceQueryRequest): string | undefined {
  const from = request.interval.fromCapturedAtIso;
  const to = request.interval.toCapturedAtIso;
  if (!from || !to) {
    return undefined;
  }

  const filters = [
    `createdon ge ${from}`,
    `createdon le ${to}`,
    // Exclude ordinary access audit rows so inline evidence focuses on changes.
    // Do not filter by objecttypecode here: Dataverse audit objecttypecode filtering can
    // fail for custom logical names because the platform resolves it through metadata cache.
    // DVQR keeps the query interval-bounded and then ranks/filter-hints returned rows locally.
    `operation ne 4`
  ];

  const top = Math.max(1, Math.min(request.limit ?? 25, 50));
  return `/audits?$select=${buildAuditSelect()}&$filter=${encodeURIComponent(filters.join(" and "))}&$orderby=createdon asc&$top=${top}`;
}

function stringValue(row: Record<string, unknown>, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
  }
  return undefined;
}

function parseChangedData(changedData: string | undefined): {
  readonly logicalName?: string;
  readonly oldValue?: string;
  readonly newValue?: string;
  readonly relationshipName?: string;
  readonly relatedEntityLogicalName?: string;
  readonly relatedRecordId?: string;
  readonly kind: "AttributeChange" | "AssociationChange" | "Raw";
} {
  if (!changedData) {
    return { kind: "Raw" };
  }

  try {
    const parsed = JSON.parse(changedData) as unknown;
    if (Array.isArray(parsed)) {
      const first = parsed.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;
      return {
        logicalName: typeof first?.logicalName === "string" ? first.logicalName : undefined,
        oldValue: valueToDisplay(first?.oldValue ?? first?.old),
        newValue: valueToDisplay(first?.newValue ?? first?.new),
        kind: "AttributeChange"
      };
    }
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      const changedAttributes = Array.isArray(obj.changedAttributes)
        ? obj.changedAttributes
        : Array.isArray(obj.ChangedAttributes)
          ? obj.ChangedAttributes
          : undefined;
      const firstChangedAttribute = changedAttributes
        ?.find((item) => item && typeof item === "object") as Record<string, unknown> | undefined;

      return {
        logicalName: typeof obj.logicalName === "string"
          ? obj.logicalName
          : typeof firstChangedAttribute?.logicalName === "string"
            ? firstChangedAttribute.logicalName
            : undefined,
        oldValue: valueToDisplay(obj.oldValue ?? obj.old ?? firstChangedAttribute?.oldValue),
        newValue: valueToDisplay(obj.newValue ?? obj.new ?? firstChangedAttribute?.newValue),
        kind: "AttributeChange"
      };
    }
  } catch {
    // Dataverse audit changedata shape may differ by org/version. Try known non-JSON association forms below.
  }

  const association = parseAssociationChangedData(changedData);
  if (association) {
    return association;
  }

  return { kind: "Raw" };
}

function parseAssociationChangedData(changedData: string): {
  readonly relationshipName?: string;
  readonly relatedEntityLogicalName?: string;
  readonly relatedRecordId?: string;
  readonly kind: "AssociationChange";
} | undefined {
  const trimmed = changedData.trim();
  const match = /^([^~,]+)~([^,]+)(?:,([^,]+))?/.exec(trimmed);
  if (!match) {
    return undefined;
  }

  return {
    relationshipName: match[1]?.trim(),
    relatedEntityLogicalName: match[2]?.trim(),
    relatedRecordId: match[3]?.trim(),
    kind: "AssociationChange"
  };
}

function valueToDisplay(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function normalized(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function auditRecordRelevance(record: AuditEvidenceRecord, request: AuditEvidenceQueryRequest): number {
  let score = 0;
  const entity = normalized(request.entityLogicalName);
  const evidenceLabel = normalized(request.evidenceLabel);
  const parentEvidence = normalized(request.parentEvidence);
  const changedData = normalized(record.changedData);
  const objectType = normalized(record.objectTypeCode);
  const changedAttribute = normalized(record.changedAttributeLogicalName);

  if (entity && objectType === entity) {
    score += 50;
  }
  if (changedAttribute && evidenceLabel.includes(changedAttribute)) {
    score += 35;
  }
  if (changedAttribute && parentEvidence.includes(changedAttribute)) {
    score += 35;
  }
  if (request.evidenceValue && changedData.includes(normalized(request.evidenceValue))) {
    score += 10;
  }
  if (request.findingTitle && changedData.includes(normalized(request.findingTitle))) {
    score += 5;
  }
  if (record.kind === "AssociationChange" && normalized(request.providerId).includes("identity")) {
    score += 20;
  }
  if (record.relationshipName && parentEvidence.includes(normalized(record.relationshipName))) {
    score += 20;
  }
  return score;
}

function rankAuditRecords(records: readonly AuditEvidenceRecord[], request: AuditEvidenceQueryRequest): readonly AuditEvidenceRecord[] {
  return [...records]
    .map((record, index) => ({ record, index, score: auditRecordRelevance(record, request) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, Math.max(1, Math.min(request.limit ?? 8, 25)))
    .map((entry) => entry.record);
}

function isLikelyMetadataFinding(request: AuditEvidenceQueryRequest): boolean {
  const haystack = normalized([
    request.findingTitle,
    request.findingSummary,
    request.providerId,
    request.providerTitle,
    request.evidenceLabel,
    request.parentEvidence
  ].filter(Boolean).join(" "));

  return haystack.includes("metadata")
    || haystack.includes("choice")
    || haystack.includes("option")
    || haystack.includes("relationship")
    || haystack.includes("column logical name")
    || haystack.includes("schema name")
    || haystack.includes("entity configuration");
}

function mapAuditRecord(row: Record<string, unknown>): AuditEvidenceRecord {
  const recordedAtIso = stringValue(row, ["createdon"]);
  const changedBy = stringValue(row, [
    "_userid_value@OData.Community.Display.V1.FormattedValue",
    "userid@OData.Community.Display.V1.FormattedValue",
    "userfullname",
    "username"
  ]);
  const userId = stringValue(row, ["_userid_value", "userid"]);
  const operation = stringValue(row, ["operation@OData.Community.Display.V1.FormattedValue", "operation"]);
  const action = stringValue(row, ["action@OData.Community.Display.V1.FormattedValue", "action"]);
  const changedData = stringValue(row, ["changedata", "changedData"]);
  const parsedValues = parseChangedData(changedData);
  const summaryParts = [
    recordedAtIso ? `Recorded at ${recordedAtIso}` : undefined,
    changedBy ? `by ${changedBy}` : userId ? `by ${userId}` : undefined,
    operation ? `operation ${operation}` : undefined
  ].filter(Boolean);

  return {
    auditId: stringValue(row, ["auditid"]),
    recordedAtIso,
    changedBy,
    userId,
    operation,
    action,
    objectId: stringValue(row, ["_objectid_value", "objectid"]),
    objectTypeCode: stringValue(row, ["objecttypecode"]),
    changedAttributeLogicalName: parsedValues.logicalName,
    attributeMask: stringValue(row, ["attributemask"]),
    changedData,
    oldValue: parsedValues.oldValue,
    newValue: parsedValues.newValue,
    relationshipName: parsedValues.relationshipName,
    relatedEntityLogicalName: parsedValues.relatedEntityLogicalName,
    relatedRecordId: parsedValues.relatedRecordId,
    kind: parsedValues.kind,
    summary: summaryParts.join(" · ") || "Audit record returned without formatted summary fields."
  };
}

function unavailableResult(request: AuditEvidenceQueryRequest, summary: string, warning?: string): AuditEvidenceResult {
  return {
    status: "Unavailable",
    title: "Audit evidence unavailable",
    summary,
    interval: request.interval,
    records: [],
    warning
  };
}

export async function queryAuditEvidence(ctx: CommandContext, request: AuditEvidenceQueryRequest): Promise<AuditEvidenceResult> {
  const queryPath = buildAuditQueryPath(request);
  if (!queryPath) {
    return unavailableResult(
      request,
      "Audit lookup requires a snapshot-bounded interval. DVQR did not query audit history because the interval was incomplete."
    );
  }

  const activeEnvironment = ctx.envContext.getActiveEnvironment();
  if (!activeEnvironment) {
    return unavailableResult(
      request,
      "No active Dataverse environment is selected. Select the environment that owns this snapshot interval before checking audit evidence."
    );
  }

  if (request.entityLogicalName && activeEnvironment.name !== undefined) {
    // Keep this as diagnostic context only; snapshot/environment compatibility remains owned by diff/timeline services.
  }

  try {
    const token = await ctx.getToken(ctx.getScope());
    const response = await ctx.getClient().getWithMetadata<DataverseAuditResponse>(queryPath, token, { timeoutMs: 20000 });
    const rows = response.data.value ?? [];
    const records = rankAuditRecords(rows.map(mapAuditRecord), request);
    if (records.length === 0) {
      const metadataSummary = "No audit rows were returned for this metadata-oriented finding inside the selected snapshot interval. Dataverse often does not expose choice/column/relationship label edits as record-level audit rows. Captured snapshot metadata remains the evidence source.";
      return {
        status: "NoMatchingAudit",
        title: "No matching audit evidence found",
        summary: isLikelyMetadataFinding(request)
          ? metadataSummary
          : "No audit rows were returned for this finding inside the selected snapshot interval. This does not prove no change happened; auditing may be disabled, filtered, unavailable, or outside the captured evidence scope.",
        interval: request.interval,
        records,
        queryPath
      };
    }

    return {
      status: "Found",
      title: "Audit evidence found",
      summary: `DVQR found ${records.length} audit record${records.length === 1 ? "" : "s"} inside this snapshot-bounded interval. Audit evidence enriches the finding; it does not establish root cause or remediation status.`,
      interval: request.interval,
      records,
      queryPath
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      status: "Error",
      title: "Audit evidence unavailable",
      summary: "DVQR could not retrieve audit evidence for this interval. Captured diff/timeline evidence remains valid for investigation.",
      interval: request.interval,
      records: [],
      queryPath,
      warning: message
    };
  }
}
