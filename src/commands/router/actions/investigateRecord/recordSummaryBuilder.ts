import { CommandContext } from "../../../context/commandContext.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import {
  findFieldByLogicalName,
  loadEntityDefByLogicalName,
  loadFields,
  loadNavigationProperties,
  resolveChoiceValue
} from "../shared/metadataAccess.js";
import type { ResolvedChoiceValue } from "../shared/valueAwareness.js";
import {
  InvestigationLookupSuggestion,
  InvestigationLookupTargetOption,
  InvestigationReverseSuggestion,
  InvestigationSummaryCategory,
  InvestigationSummaryField,
  RecordContext
} from "./types.js";

type NavigationPropertyLike = {
  navigationPropertyName?: string;
  relationshipType?: string;
  referencingAttribute?: string;
  referencedEntity?: string;
  referencingEntity?: string;
  targetEntityLogicalName?: string;
  targetEntitySetName?: string;
};

type FieldMetadataLike = {
  logicalName?: string;
  displayName?: string;
  type?: string;
  lookupTargets?: string[];
  targets?: string[];
};

type EntityDefinitionLike = {
  logicalName?: string;
  entitySetName?: string;
  primaryIdAttribute?: string;
  primaryNameAttribute?: string;
};

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

const REVERSE_LINK_SOURCE_BLACKLIST = [
  "principalobjectattributeaccess",
  "userentityinstancedata"
];

const LOW_PRIORITY_LOOKUP_TERMS = [
  "owner",
  "owning user",
  "created by",
  "modified by",
  "currency",
  "business unit"
];

const HIGH_PRIORITY_LOOKUP_TERMS = [
  "customer",
  "company",
  "parent",
  "account",
  "contact",
  "patient",
  "care plan",
  "task",
  "subject",
  "regarding"
];

const LOW_PRIORITY_TARGETS = [
  "systemuser",
  "team",
  "transactioncurrency",
  "businessunit"
];

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

export async function buildRelatedRecords(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  record: Record<string, unknown>
): Promise<InvestigationLookupSuggestion[]> {
  const fields = await loadFields(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    { silent: true }
  );

  const navigationProperties = await loadNavigationProperties(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    { silent: true }
  );

  const result: InvestigationLookupSuggestion[] = [];

  for (const [logicalName, rawValue] of Object.entries(record)) {
    if (!isLookupValueField(logicalName)) {
      continue;
    }

    const recordId = toGuidString(rawValue);
    if (!recordId) {
      continue;
    }

    const attributeLogicalName = stripLookupWrapper(logicalName);
    const fieldMeta = findFieldByLogicalName(fields, attributeLogicalName);
    const label = toFriendlyLabel(logicalName, fieldMeta?.displayName);

    const navMatches = findNavigationsForLookup(
      navigationProperties,
      attributeLogicalName
    );

    const isOwnerLookup = attributeLogicalName.toLowerCase() === "ownerid";
    const annotatedTargetLogicalName = getLookupLogicalNameAnnotation(record, logicalName);
    const resolvedTargetLogicalNames = isOwnerLookup
      ? []
      : collectLookupTargetLogicalNames(
          fieldMeta,
          navMatches,
          annotatedTargetLogicalName,
          attributeLogicalName,
          logicalName
        );

    const targetOptions = isOwnerLookup
      ? []
      : await loadLookupTargetOptions(
          ctx,
          client,
          token,
          resolvedTargetLogicalNames
        );

    const primaryTarget = targetOptions[0];

    result.push({
      logicalName: label,
      targetEntityLogicalNameRaw: primaryTarget?.logicalName,
      targetEntityLogicalName: isOwnerLookup
        ? "User / Team"
        : formatLookupTargetDisplay(targetOptions),
      targetEntitySetName: isOwnerLookup ? undefined : primaryTarget?.entitySetName,
      recordId,
      displayName: getLookupFormattedValue(record, logicalName),
      targetOptions: isOwnerLookup ? undefined : targetOptions
    });
  }

  const deduped = dedupeRelatedRecords(result);
  const ranked = rankRelatedRecords(deduped);

  return await enrichTopRelatedRecords(ctx, client, token, ranked, 6);
}

export async function buildReverseLinks(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  recordId: string
): Promise<InvestigationReverseSuggestion[]> {
  const navigationProperties = await loadNavigationProperties(
    ctx,
    client,
    token,
    recordContext.entityLogicalName,
    { silent: true }
  );

  const result: InvestigationReverseSuggestion[] = [];

  for (const nav of navigationProperties as NavigationPropertyLike[]) {
    const referencedEntity = normalize(nav.referencedEntity);
    const referencingEntity = normalize(nav.referencingEntity);
    const referencingAttribute = normalize(nav.referencingAttribute);
    const navigationPropertyName = normalize(nav.navigationPropertyName);

    if (!referencedEntity || !referencingEntity || !referencingAttribute) {
      continue;
    }

    if (referencedEntity !== normalize(recordContext.entityLogicalName)) {
      continue;
    }

    if (REVERSE_LINK_SOURCE_BLACKLIST.includes(referencingEntity)) {
      continue;
    }

    if (!/^[a-zA-Z0-9_]+$/.test(referencingAttribute)) {
      continue;
    }

    const sourceEntityDef = (await loadEntityDefByLogicalName(
      ctx,
      client,
      token,
      referencingEntity
    ).catch(() => undefined)) as EntityDefinitionLike | undefined;

    if (!sourceEntityDef?.entitySetName) {
      continue;
    }

    result.push({
      label: buildReverseLinkLabel(
        navigationPropertyName,
        referencingEntity,
        referencingAttribute
      ),
      sourceEntityLogicalName: prettifyEntityName(referencingEntity),
      sourceEntitySetName: sourceEntityDef.entitySetName,
      referencingAttribute,
      query: `${sourceEntityDef.entitySetName}?$filter=_${referencingAttribute}_value eq ${formatGuidLiteral(recordId)}`
    });
  }

  return rankReverseLinks(result).slice(0, 8);
}

async function enrichTopRelatedRecords(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  relatedRecords: InvestigationLookupSuggestion[],
  limit: number
): Promise<InvestigationLookupSuggestion[]> {
  const enriched = [...relatedRecords];
  const topItems = enriched.slice(0, limit);

  for (const item of topItems) {
    if (item.displayName?.trim()) {
      continue;
    }

    const displayName = await tryResolveLookupDisplayName(
      ctx,
      client,
      token,
      item
    );

    if (displayName) {
      item.displayName = displayName;
    }
  }

  return enriched;
}

async function tryResolveLookupDisplayName(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  item: InvestigationLookupSuggestion
): Promise<string | undefined> {
  if (!item.targetEntityLogicalNameRaw || !item.targetEntitySetName || !item.recordId) {
    return undefined;
  }

  const logicalName = item.targetEntityLogicalNameRaw;
  const entityDef = (await loadEntityDefByLogicalName(
    ctx,
    client,
    token,
    logicalName
  ).catch(() => undefined)) as EntityDefinitionLike | undefined;

  if (!entityDef?.primaryNameAttribute) {
    return undefined;
  }

  const selectParts = [
    entityDef.primaryIdAttribute,
    entityDef.primaryNameAttribute
  ].filter((value): value is string => !!value?.trim());

  const query =
    `${item.targetEntitySetName}(${item.recordId})` +
    `?$select=${selectParts.join(",")}`;

  try {
    const response = await client.get(query, token);
    const record = unwrapSingleRecord(response);

    if (!record) {
      return undefined;
    }

    const directValue = toDisplayValue(record[entityDef.primaryNameAttribute]);
    if (directValue) {
      return directValue;
    }

    const formattedKey =
      `${entityDef.primaryNameAttribute}@OData.Community.Display.V1.FormattedValue`;

    return toDisplayValue(record[formattedKey]);
  } catch {
    return undefined;
  }
}

function unwrapSingleRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  if (!Array.isArray(value)) {
    const record = value as Record<string, unknown>;

    if (Array.isArray(record.value) && record.value.length > 0) {
      const first = record.value[0];
      if (first && typeof first === "object" && !Array.isArray(first)) {
        return first as Record<string, unknown>;
      }
    }

    return record;
  }

  return undefined;
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

  const normalizedLogicalName = logicalName.toLowerCase();

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

async function safeResolveChoiceValue(
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


function getLookupLogicalNameAnnotation(
  record: Record<string, unknown>,
  rawLookupLogicalName: string
): string | undefined {
  const annotationKey = `${rawLookupLogicalName}@Microsoft.Dynamics.CRM.lookuplogicalname`;
  return toDisplayValue(record[annotationKey]);
}

function collectLookupTargetLogicalNames(
  fieldMeta: FieldMetadataLike | undefined,
  navMatches: NavigationPropertyLike[],
  annotatedTargetLogicalName: string | undefined,
  attributeLogicalName: string,
  rawLookupLogicalName: string
): string[] {
  const candidates = new Set<string>();

  if (annotatedTargetLogicalName?.trim()) {
    candidates.add(annotatedTargetLogicalName.trim());
  }

  for (const candidate of getAllLookupTargets(fieldMeta)) {
    candidates.add(candidate);
  }

  for (const candidate of getNavigationTargetLogicalNames(navMatches)) {
    candidates.add(candidate);
  }

  const fallback = getKnownLookupTargetFallback(attributeLogicalName, rawLookupLogicalName);
  if (fallback) {
    candidates.add(fallback);
  }

  return [...candidates];
}

async function loadLookupTargetOptions(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalNames: string[]
): Promise<InvestigationLookupTargetOption[]> {
  const result: InvestigationLookupTargetOption[] = [];

  for (const logicalName of logicalNames) {
    const normalized = logicalName.trim();
    if (!normalized) {
      continue;
    }

    const entityDef = (await loadEntityDefByLogicalName(
      ctx,
      client,
      token,
      normalized
    ).catch(() => undefined)) as EntityDefinitionLike | undefined;

    result.push({
      logicalName: normalized,
      entitySetName: entityDef?.entitySetName,
      displayName: prettifyEntityName(normalized)
    });
  }

  return dedupeLookupTargetOptions(result);
}

function dedupeLookupTargetOptions(
  values: InvestigationLookupTargetOption[]
): InvestigationLookupTargetOption[] {
  const seen = new Set<string>();
  const result: InvestigationLookupTargetOption[] = [];

  for (const value of values) {
    const key = normalize(value.logicalName);
    if (!key || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function formatLookupTargetDisplay(
  targetOptions: InvestigationLookupTargetOption[]
): string | undefined {
  if (!targetOptions.length) {
    return undefined;
  }

  return targetOptions
    .map(option => option.displayName ?? prettifyEntityName(option.logicalName) ?? option.logicalName)
    .join(" / ");
}

function getAllLookupTargets(fieldMeta?: FieldMetadataLike): string[] {
  if (!fieldMeta) {
    return [];
  }

  const candidates = [
    ...(Array.isArray(fieldMeta.lookupTargets) ? fieldMeta.lookupTargets : []),
    ...(Array.isArray(fieldMeta.targets) ? fieldMeta.targets : [])
  ];

  const result: string[] = [];
  const seen = new Set<string>();

  for (const candidate of candidates) {
    if (typeof candidate !== "string") {
      continue;
    }

    const trimmed = candidate.trim();
    const key = trimmed.toLowerCase();
    if (!trimmed || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(trimmed);
  }

  return result;
}

function getPrimaryLookupTarget(fieldMeta?: FieldMetadataLike): string | undefined {
  if (!fieldMeta) {
    return undefined;
  }

  const candidates = [
    ...(Array.isArray(fieldMeta.lookupTargets) ? fieldMeta.lookupTargets : []),
    ...(Array.isArray(fieldMeta.targets) ? fieldMeta.targets : [])
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return undefined;
}

function getNavigationTargetLogicalNames(
  navMatches: NavigationPropertyLike[]
): string[] {
  const result: string[] = [];
  const seen = new Set<string>();

  for (const navMatch of navMatches) {
    const candidates = [
      navMatch.targetEntityLogicalName,
      navMatch.referencedEntity
    ];

    for (const candidate of candidates) {
      if (typeof candidate !== "string") {
        continue;
      }

      const trimmed = candidate.trim();
      const key = trimmed.toLowerCase();
      if (!trimmed || seen.has(key)) {
        continue;
      }

      seen.add(key);
      result.push(trimmed);
    }
  }

  return result;
}

function getKnownLookupTargetFallback(
  attributeLogicalName: string,
  rawLookupLogicalName: string
): string | undefined {
  const normalizedAttribute = attributeLogicalName.toLowerCase();
  const normalizedRaw = rawLookupLogicalName.toLowerCase();

  if (
    normalizedAttribute === "createdby" ||
    normalizedAttribute === "modifiedby" ||
    normalizedAttribute === "owninguser"
  ) {
    return "systemuser";
  }

  if (normalizedAttribute === "transactioncurrencyid") {
    return "transactioncurrency";
  }

  if (normalizedAttribute === "owningbusinessunit") {
    return "businessunit";
  }

  if (normalizedAttribute === "ownerid" || normalizedRaw === "_ownerid_value") {
    return undefined;
  }

  return undefined;
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

function toFriendlyLabel(logicalName: string, displayName?: string): string {
  const override = SUMMARY_LABEL_OVERRIDES[logicalName.toLowerCase()];
  if (override) {
    return override;
  }

  if (displayName?.trim()) {
    return displayName.trim();
  }

  const stripped = stripLookupWrapper(logicalName);

  return stripped
    .replace(/^msdyn_/i, "")
    .replace(/^msemr_/i, "")
    .replace(/^bu_/i, "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function prettifyEntityName(value?: string): string | undefined {
  if (!value?.trim()) {
    return undefined;
  }

  return value
    .replace(/_/g, " ")
    .replace(/\b\w/g, char => char.toUpperCase());
}

function normalize(value?: string): string {
  return value?.trim().toLowerCase() ?? "";
}

function findNavigationsForLookup(
  navigationProperties: unknown[],
  attributeLogicalName: string
): NavigationPropertyLike[] {
  const normalizedAttribute = normalize(attributeLogicalName);

  return (navigationProperties as NavigationPropertyLike[]).filter(nav => {
    const referencingAttribute = normalize(nav.referencingAttribute);
    const navigationPropertyName = normalize(nav.navigationPropertyName);

    return (
      referencingAttribute === normalizedAttribute ||
      navigationPropertyName === normalizedAttribute
    );
  });
}

function dedupeRelatedRecords(
  values: InvestigationLookupSuggestion[]
): InvestigationLookupSuggestion[] {
  const seen = new Set<string>();
  const result: InvestigationLookupSuggestion[] = [];

  for (const value of values) {
    const key = [
      value.logicalName,
      value.targetEntitySetName,
      value.recordId
    ].join("|");

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(value);
  }

  return result;
}

function rankRelatedRecords(
  values: InvestigationLookupSuggestion[]
): InvestigationLookupSuggestion[] {
  return [...values].sort((a, b) => {
    const scoreDiff =
      scoreRelatedRecordDisplayPriority(b) -
      scoreRelatedRecordDisplayPriority(a);

    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return a.logicalName.localeCompare(b.logicalName);
  });
}

function scoreRelatedRecordDisplayPriority(
  value: InvestigationLookupSuggestion
): number {
  const label = value.logicalName.toLowerCase();
  const target = (value.targetEntityLogicalName ?? "").toLowerCase().replace(/\s+/g, "");

  let score = 50;

  for (const term of HIGH_PRIORITY_LOOKUP_TERMS) {
    if (label.includes(term) || target.includes(term.replace(/\s+/g, ""))) {
      score += 30;
      break;
    }
  }

  if (target && !LOW_PRIORITY_TARGETS.includes(target)) {
    score += 15;
  }

  for (const term of LOW_PRIORITY_LOOKUP_TERMS) {
    if (label.includes(term)) {
      score -= 35;
      break;
    }
  }

  for (const targetTerm of LOW_PRIORITY_TARGETS) {
    if (target === targetTerm) {
      score -= 20;
      break;
    }
  }

  return score;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  return value as Record<string, unknown>;
}

function buildReverseLinkLabel(
  navigationPropertyName: string,
  referencingEntity: string,
  referencingAttribute: string
): string {
  if (navigationPropertyName) {
    return toFriendlyLabel(navigationPropertyName);
  }

  return `${prettifyEntityName(referencingEntity) ?? referencingEntity} via ${referencingAttribute}`;
}

function rankReverseLinks(
  links: InvestigationReverseSuggestion[]
): InvestigationReverseSuggestion[] {
  return [...links]
    .map(link => ({
      link,
      score: scoreReverseLink(link)
    }))
    .sort((a, b) => b.score - a.score || a.link.label.localeCompare(b.link.label))
    .map(item => item.link)
    .filter((link, index, array) => {
      const firstIndex = array.findIndex(candidate =>
        candidate.sourceEntitySetName === link.sourceEntitySetName &&
        candidate.referencingAttribute === link.referencingAttribute
      );

      return firstIndex === index;
    });
}

function scoreReverseLink(link: InvestigationReverseSuggestion): number {
  const label = `${link.label} ${link.sourceEntityLogicalName ?? ""}`.toLowerCase();
  const attn = (link.referencingAttribute ?? "").toLowerCase();

  if (label.includes("activityparty") || attn === "partyid") {
    return 120;
  }

  if (label.includes("annotation") || label.includes("note") || attn === "objectid") {
    return 110;
  }

  if (label.includes("activity")) {
    return 100;
  }

  if (label.includes("task")) {
    return 95;
  }

  if (label.includes("email")) {
    return 85;
  }

  if (label.includes("appointment")) {
    return 85;
  }

  if (label.includes("phonecall")) {
    return 85;
  }

  if (attn.includes("regarding")) {
    return 70;
  }

  if (attn.includes("customer") || attn.endsWith("id")) {
    return 60;
  }

  return 50;
}

function formatGuidLiteral(value: string): string {
  return value;
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
