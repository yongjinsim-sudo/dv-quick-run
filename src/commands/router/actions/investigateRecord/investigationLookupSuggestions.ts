import { CommandContext } from "../../../context/commandContext.js";
import type { DataverseClient } from "../../../../services/dataverseClient.js";
import { findFieldByLogicalName, loadEntityDefByLogicalName, loadFields, loadNavigationProperties } from "../shared/metadataAccess.js";
import { InvestigationLookupSuggestion, InvestigationLookupTargetOption, RecordContext } from "./types.js";
import { prettifyEntityName, normalize } from "./investigationDisplayHelpers";

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

export async function buildRelatedRecords(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  recordContext: RecordContext,
  record: Record<string, unknown>
): Promise<InvestigationLookupSuggestion[]> {
  const [fields, navigationProperties] = await Promise.all([
    loadFields(
      ctx,
      client,
      token,
      recordContext.entityLogicalName,
      { silent: true }
    ),
    loadNavigationProperties(
      ctx,
      client,
      token,
      recordContext.entityLogicalName,
      { silent: true }
    )
  ]);

  const suggestions: Array<InvestigationLookupSuggestion | undefined> = await Promise.all(
    Object.entries(record).map(async ([logicalName, rawValue]) => {
      if (!isLookupValueField(logicalName)) {
        return undefined;
      }

      const recordId = toGuidString(rawValue);
      if (!recordId) {
        return undefined;
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

      const suggestion: InvestigationLookupSuggestion = {
        logicalName: label,
        targetEntityLogicalNameRaw: primaryTarget?.logicalName,
        targetEntityLogicalName: isOwnerLookup
          ? "User / Team"
          : formatLookupTargetDisplay(targetOptions),
        targetEntitySetName: isOwnerLookup ? undefined : primaryTarget?.entitySetName,
        recordId,
        displayName: getLookupFormattedValue(record, logicalName),
        targetOptions: isOwnerLookup ? undefined : targetOptions
      };

      return suggestion;
    })
  );

  const resolvedSuggestions = suggestions.filter(
    (value): value is InvestigationLookupSuggestion => value !== undefined
  );

  const deduped = dedupeRelatedRecords(resolvedSuggestions);
  const ranked = rankRelatedRecords(deduped);

  return await enrichTopRelatedRecords(ctx, client, token, ranked, 6);
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

  await Promise.all(
    topItems.map(async (item) => {
      if (item.displayName?.trim()) {
        return;
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
    })
  );

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
  const entityDefs: Array<InvestigationLookupTargetOption | undefined> = await Promise.all(
    logicalNames.map(async (logicalName) => {
      const normalized = logicalName.trim();
      if (!normalized) {
        return undefined;
      }

      const entityDef = (await loadEntityDefByLogicalName(
        ctx,
        client,
        token,
        normalized
      ).catch(() => undefined)) as EntityDefinitionLike | undefined;

      const option: InvestigationLookupTargetOption = {
        logicalName: normalized,
        entitySetName: entityDef?.entitySetName,
        displayName: prettifyEntityName(normalized)
      };

      return option;
    })
  );

    const resolvedEntityDefs = entityDefs.filter(
    (value): value is InvestigationLookupTargetOption => value !== undefined
  );

  return dedupeLookupTargetOptions(resolvedEntityDefs);
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
