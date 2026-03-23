import { CommandContext } from "../../../context/commandContext.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import { findFieldByLogicalName, loadFields, resolveChoiceValue } from "../shared/metadataAccess.js";
import type { ResolvedChoiceValue } from "../shared/valueAwareness.js";
import { InvestigationSummaryCategory, InvestigationSummaryField, RecordContext } from "./types.js";
import { toFriendlyLabel, normalize } from "./investigationDisplayHelpers"; 

const LIFECYCLE_FIELDS = [
  "statecode",
  "statuscode",
  "createdon",
  "modifiedon"
];

const OWNERSHIP_FIELDS = [
  "_ownerid_value",
  "_owninguser_value",
  "_createdby_value",
  "_modifiedby_value",
  "_owningbusinessunit_value"
];

const BUSINESS_FIELD_HINTS = [
  "fullname",
  "name",
  "subject",
  "title",
  "emailaddress1",
  "telephone1",
  "mobilephone",
  "accountnumber",
  "customerid",
  "parentcustomerid",
  "companyname",
  "regardingobjectid"
];

const SUMMARY_CATEGORY_ORDER: InvestigationSummaryCategory[] = [
  "identity",
  "lifecycle",
  "ownership",
  "business"
];

const SUMMARY_LABEL_OVERRIDES: Record<string, string> = {
  contactid: "Contact",
  fullname: "Full Name",
  statecode: "Status",
  statuscode: "Status Reason",
  createdon: "Created On",
  modifiedon: "Modified On",
  _createdby_value: "Created By",
  _modifiedby_value: "Modified By",
  _ownerid_value: "Owner",
  _owninguser_value: "Owning User",
  _owningbusinessunit_value: "Owning Business Unit",
  _transactioncurrencyid_value: "Currency",
  _companyname_value: "Company Name",
  emailaddress1: "Email"
};

export function tryGetPrimaryName(
  recordContext: RecordContext,
  record: Record<string, unknown>
): string | undefined {
  if (!recordContext.primaryNameField) {
    return undefined;
  }

  return toDisplayValue(record[recordContext.primaryNameField]);
}

export async function buildSummaryFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  record: Record<string, unknown>,
  sourceJson?: Record<string, unknown>
): Promise<InvestigationSummaryField[]> {
  const fields = await loadFields(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    { silent: true }
  );

  const summary = new Map<string, InvestigationSummaryField>();

  const addField = async (
    logicalName: string,
    category: InvestigationSummaryCategory
  ): Promise<void> => {
    if (!logicalName || summary.has(logicalName) || !(logicalName in record)) {
      return;
    }

    const fieldMeta = findFieldByLogicalName(fields, logicalName);
    const value = await toSummaryDisplayValue(
      ctx,
      client,
      token,
      recordContext,
      record,
      logicalName
    );

    if (!value || isNoisySummaryValue(logicalName, value)) {
      return;
    }

    summary.set(logicalName, {
      logicalName,
      label: toFriendlyLabel(logicalName, fieldMeta?.displayName),
      value,
      category
    });
  };

  await addField(recordContext.primaryIdField ?? "", "identity");
  await addField(recordContext.primaryNameField ?? "", "identity");

  for (const logicalName of LIFECYCLE_FIELDS) {
    await addField(logicalName, "lifecycle");
  }

  for (const logicalName of OWNERSHIP_FIELDS) {
    await addField(logicalName, "ownership");
  }

  const preferredBusinessFields = buildPreferredBusinessFieldOrder(
    recordContext,
    record,
    sourceJson
  );

  for (const logicalName of preferredBusinessFields) {
    await addField(logicalName, "business");
  }

  return sortSummaryFields([...summary.values()]).slice(0, 12);
}

function buildPreferredBusinessFieldOrder(
  recordContext: RecordContext,
  record: Record<string, unknown>,
  sourceJson?: Record<string, unknown>
): string[] {
  const ordered = new Set<string>();

  for (const key of BUSINESS_FIELD_HINTS) {
    if (key in record) {
      ordered.add(key);
    }
  }

  for (const key of Object.keys(sourceJson ?? {})) {
    if (isBusinessRelevantFieldName(key, recordContext) && key in record) {
      ordered.add(key);
    }
  }

  for (const key of Object.keys(record)) {
    if (isBusinessRelevantFieldName(key, recordContext)) {
      ordered.add(key);
    }
  }

  return [...ordered];
}

function isBusinessRelevantFieldName(
  logicalName: string,
  recordContext: RecordContext
): boolean {
  const normalized = logicalName.toLowerCase();

  if (!normalized || normalized.startsWith("@")) {
    return false;
  }

  if (normalized === recordContext.primaryIdField?.toLowerCase()) {
    return false;
  }

  if (normalized === recordContext.primaryNameField?.toLowerCase()) {
    return false;
  }

  if (LIFECYCLE_FIELDS.includes(normalized) || OWNERSHIP_FIELDS.includes(normalized)) {
    return false;
  }

  if (normalized.startsWith("_")) {
    return false;
  }

  if (normalized.endsWith("@odata.context") || normalized.includes("formattedvalue")) {
    return false;
  }

  return /(name|title|subject|number|code|email|phone|mobile|company|customer|regarding|address|city|state|country)/.test(normalized);
}

function sortSummaryFields(
  values: InvestigationSummaryField[]
): InvestigationSummaryField[] {
  return values.sort((left, right) => {
    const categoryDelta =
      SUMMARY_CATEGORY_ORDER.indexOf(left.category) -
      SUMMARY_CATEGORY_ORDER.indexOf(right.category);

    if (categoryDelta !== 0) {
      return categoryDelta;
    }

    return summaryFieldPriority(left.logicalName) - summaryFieldPriority(right.logicalName);
  });
}

function summaryFieldPriority(logicalName: string): number {
  const normalized = logicalName.toLowerCase();

  const explicitOrder = [
    "fullname",
    "name",
    "emailaddress1",
    "telephone1",
    "mobilephone",
    "statecode",
    "statuscode",
    "createdon",
    "modifiedon",
    "_ownerid_value",
    "_createdby_value",
    "_modifiedby_value"
  ];

  const explicitIndex = explicitOrder.indexOf(normalized);
  if (explicitIndex >= 0) {
    return explicitIndex;
  }

  return 1000;
}

function isNoisySummaryValue(logicalName: string, value: string): boolean {
  const normalized = logicalName.toLowerCase();
  const trimmed = value.trim();

  if (!trimmed) {
    return true;
  }

  if (normalized.startsWith("_") && !trimmed.includes("(") && isLikelyGuid(trimmed)) {
    return true;
  }

  return false;
}

function isLikelyGuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function toSummaryDisplayValue(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  record: Record<string, unknown>,
  logicalName: string
): Promise<string | undefined> {
  const rawValue = record[logicalName];
  if (rawValue === undefined || rawValue === null || rawValue === "") {
    return undefined;
  }

  const resolvedChoice = await tryResolveChoiceDisplayValue(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    logicalName,
    rawValue
  );

  if (resolvedChoice) {
    return resolvedChoice;
  }

  if (isLookupValueField(logicalName)) {
    return getLookupFormattedValue(record, logicalName) ??
      toGuidString(rawValue) ??
      toDisplayValue(rawValue);
  }

  return toDisplayValue(rawValue);
}

async function tryResolveChoiceDisplayValue(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  entityLogicalName: string,
  logicalName: string,
  rawValue: unknown
): Promise<string | undefined> {
  if (
    typeof rawValue !== "string" &&
    typeof rawValue !== "number" &&
    typeof rawValue !== "boolean"
  ) {
    return undefined;
  }

  try {
    const resolved = await resolveChoiceValue(
      ctx,
      client,
      token,
      entityLogicalName,
      logicalName,
      rawValue
    );

    if (!resolved) {
      return undefined;
    }

    return formatResolvedChoiceValue(resolved);
  } catch {
    return undefined;
  }
}

function formatResolvedChoiceValue(
  resolved: ResolvedChoiceValue
): string | undefined {
  if (resolved.option.label?.trim()) {
    return `${resolved.option.value} (${resolved.option.label})`;
  }

  if (resolved.option.value !== undefined && resolved.option.value !== null) {
    return String(resolved.option.value);
  }

  return undefined;
}

function getLookupFormattedValue(
  record: Record<string, unknown>,
  rawLookupLogicalName: string
): string | undefined {
  const annotationKey =
    `${rawLookupLogicalName}@OData.Community.Display.V1.FormattedValue`;

  return toDisplayValue(record[annotationKey]);
}

function isLookupValueField(logicalName: string): boolean {
  return logicalName.startsWith("_") && logicalName.endsWith("_value");
}

function stripLookupWrapper(logicalName: string): string {
  return logicalName.replace(/^_/, "").replace(/_value$/, "");
}

function toGuidString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed || undefined;
}

function toDisplayValue(value: unknown): string | undefined {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  return JSON.stringify(value);
}