import { DataverseClient } from "../services/dataverseClient.js";
import { ChoiceMetadata, EntityMetadata, FieldMetadata, RelationshipMetadata } from "./metadataModel.js";
import {
  normalizeChoiceMetadataList,
  normalizeEntityMetadataList,
  normalizeFieldMetadataList,
  normalizeRelationshipMetadataList
} from "./metadataAdapters.js";

type ODataList<T> = { value?: T[] };

async function getList<T>(client: DataverseClient, token: string, path: string): Promise<T[]> {
  const response = (await client.get(path, token)) as ODataList<T>;
  return Array.isArray(response?.value) ? response.value : [];
}

async function getItem<T>(client: DataverseClient, token: string, path: string): Promise<T | undefined> {
  const response = (await client.get(path, token)) as T | undefined;
  return response && typeof response === "object" ? response : undefined;
}

function normalizeODataStringLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

function getChoiceAttributeCast(attributeType: string | undefined): string | undefined {
  const normalized = (attributeType ?? "").trim().toLowerCase();

  if (normalized === "picklist") {
    return "Microsoft.Dynamics.CRM.PicklistAttributeMetadata";
  }

  if (normalized === "multipicklist" || normalized === "multiselectpicklist") {
    return "Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata";
  }

  if (normalized === "state") {
    return "Microsoft.Dynamics.CRM.StateAttributeMetadata";
  }

  if (normalized === "status") {
    return "Microsoft.Dynamics.CRM.StatusAttributeMetadata";
  }

  if (normalized === "boolean") {
    return "Microsoft.Dynamics.CRM.BooleanAttributeMetadata";
  }

  return undefined;
}

function getChoiceOptionCount(choice: ChoiceMetadata): number {
  return Array.isArray(choice.options) ? choice.options.length : 0;
}

function mergeChoiceMetadataByBestOptionCoverage(choices: readonly ChoiceMetadata[]): ChoiceMetadata[] {
  const byField = new Map<string, ChoiceMetadata>();

  for (const choice of choices) {
    const key = choice.fieldLogicalName.trim().toLowerCase();
    if (!key) {
      continue;
    }

    const existing = byField.get(key);
    if (!existing || getChoiceOptionCount(choice) > getChoiceOptionCount(existing)) {
      byField.set(key, choice);
    }
  }

  return Array.from(byField.values()).sort((a, b) =>
    a.fieldLogicalName.localeCompare(b.fieldLogicalName, undefined, { sensitivity: "base" })
  );
}

async function hydrateChoiceAttributesDirectly(
  client: DataverseClient,
  token: string,
  entityLogicalName: string,
  attributes: readonly ChoiceMetadata[]
): Promise<ChoiceMetadata[]> {
  const safeEntityLogicalName = normalizeODataStringLiteral(entityLogicalName);
  const hydrated: ChoiceMetadata[] = [];

  for (const attribute of attributes) {
    const cast = getChoiceAttributeCast(attribute.attributeType ?? attribute.kind);
    if (!cast) {
      hydrated.push(attribute);
      continue;
    }

    const safeAttributeLogicalName = normalizeODataStringLiteral(attribute.fieldLogicalName);
    const path =
      `/EntityDefinitions(LogicalName='${safeEntityLogicalName}')/Attributes(LogicalName='${safeAttributeLogicalName}')/${cast}` +
      "?$select=LogicalName,AttributeType&$expand=OptionSet,GlobalOptionSet";

    try {
      const row = await getItem<any>(client, token, path);
      const normalized = normalizeChoiceMetadataList(row ? [row] : [], entityLogicalName);
      hydrated.push(normalized[0] ?? attribute);
    } catch {
      hydrated.push(attribute);
    }
  }

  return hydrated;
}

export async function fetchNormalizedEntityMetadata(
  client: DataverseClient,
  token: string
): Promise<EntityMetadata[]> {
  const attempts = [
    "/EntityDefinitions?$select=EntitySetName,LogicalName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute&$filter=EntitySetName ne null",
    "/EntityDefinitions?$select=EntitySetName,LogicalName,DisplayName,PrimaryIdAttribute,PrimaryNameAttribute&$top=5000",
    "/EntityDefinitions?$top=500"
  ];

  let lastError: unknown;

  for (const path of attempts) {
    try {
      const rows = await getList<any>(client, token, path);
      const normalized = normalizeEntityMetadataList(rows);
      if (normalized.length) {
        return normalized;
      }
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Unable to load Dataverse entity metadata.");
}

export async function fetchNormalizedFieldMetadata(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldMetadata[]> {
  const safeLogicalName = logicalName.replace(/'/g, "''");
  const baseSelect = "LogicalName,AttributeType,IsValidForRead,IsValidForCreate,IsValidForUpdate,IsValidForAdvancedFind,AttributeOf,SchemaName,DisplayName,RequiredLevel,IsSearchable,IsAuditEnabled,Description";
  const path =
    `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes` +
    `?$select=${baseSelect}&$top=5000`;

  try {
    const rows = await getList<any>(client, token, path);
    const normalized = normalizeFieldMetadataList(rows);
    if (normalized.length) {
      return await hydrateLookupTargets(client, token, logicalName, normalized);
    }
  } catch {
    // Fall back to expanded entity metadata below.
  }

  const response = await client.get(
    `/EntityDefinitions(LogicalName='${safeLogicalName}')?$select=LogicalName&$expand=Attributes($select=${baseSelect})`,
    token
  );

  const rows = Array.isArray((response as { Attributes?: any[] })?.Attributes)
    ? (response as { Attributes?: any[] }).Attributes ?? []
    : [];

  const normalized = normalizeFieldMetadataList(rows);
  if (!normalized.length) {
    throw new Error(`No fields parsed for ${logicalName}`);
  }

  return hydrateLookupTargets(client, token, logicalName, normalized);
}

async function hydrateLookupTargets(
  client: DataverseClient,
  token: string,
  logicalName: string,
  fields: readonly FieldMetadata[]
): Promise<FieldMetadata[]> {
  const safeLogicalName = normalizeODataStringLiteral(logicalName);
  const lookupCasts = [
    "Microsoft.Dynamics.CRM.LookupAttributeMetadata",
    "Microsoft.Dynamics.CRM.CustomerAttributeMetadata",
    "Microsoft.Dynamics.CRM.OwnerAttributeMetadata"
  ];
  const targetsByLogicalName = new Map<string, string[]>();

  for (const cast of lookupCasts) {
    try {
      const rows = await getList<any>(
        client,
        token,
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/${cast}` +
          "?$select=LogicalName,Targets&$top=5000"
      );
      for (const row of rows) {
        const fieldLogicalName = typeof row?.LogicalName === "string"
          ? row.LogicalName.trim().toLowerCase()
          : typeof row?.logicalname === "string"
            ? row.logicalname.trim().toLowerCase()
            : "";
        if (!fieldLogicalName) {
          continue;
        }
        const targets = normalizeLookupTargetRows(row?.Targets ?? row?.targets);
        if (targets.length > 0) {
          targetsByLogicalName.set(fieldLogicalName, targets);
        }
      }
    } catch {
      // Lookup target hydration is best-effort. Base attribute metadata remains usable.
    }
  }

  if (targetsByLogicalName.size === 0) {
    return [...fields];
  }

  return fields.map((field) => {
    const hydratedTargets = targetsByLogicalName.get(field.logicalName.trim().toLowerCase());
    if (!hydratedTargets || hydratedTargets.length === 0) {
      return field;
    }
    return {
      ...field,
      lookupTargets: hydratedTargets
    };
  });
}

function normalizeLookupTargetRows(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const result: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") {
      continue;
    }
    const normalized = item.trim();
    if (normalized && !result.some((existing) => existing.toLowerCase() === normalized.toLowerCase())) {
      result.push(normalized);
    }
  }
  return result.sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" }));
}

export async function fetchNormalizedChoiceMetadata(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<ChoiceMetadata[]> {
  const safeLogicalName = normalizeODataStringLiteral(logicalName);

  const attempts: Array<{ path: string; isExpandedEntity?: boolean }> = [
    {
      path:
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/Microsoft.Dynamics.CRM.PicklistAttributeMetadata` +
        `?$select=LogicalName,AttributeType&$expand=OptionSet,GlobalOptionSet&$top=5000`
    },
    {
      path:
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/Microsoft.Dynamics.CRM.MultiSelectPicklistAttributeMetadata` +
        `?$select=LogicalName,AttributeType&$expand=OptionSet,GlobalOptionSet&$top=5000`
    },
    {
      path:
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/Microsoft.Dynamics.CRM.StateAttributeMetadata` +
        `?$select=LogicalName,AttributeType&$expand=OptionSet&$top=5000`
    },
    {
      path:
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/Microsoft.Dynamics.CRM.StatusAttributeMetadata` +
        `?$select=LogicalName,AttributeType&$expand=OptionSet&$top=5000`
    },
    {
      path:
        `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes/Microsoft.Dynamics.CRM.BooleanAttributeMetadata` +
        `?$select=LogicalName,AttributeType&$expand=OptionSet&$top=5000`
    }
  ];

  let lastError: unknown;
  const allRows: any[] = [];

  for (const attempt of attempts) {
    try {
      const rows = await getList<any>(client, token, attempt.path);
      if (rows.length) {
        allRows.push(...rows);
      }
    } catch (error) {
      lastError = error;
    }
  }

  const normalized = normalizeChoiceMetadataList(allRows, logicalName);
  if (normalized.length) {
    const hydrated = await hydrateChoiceAttributesDirectly(client, token, logicalName, normalized);
    return mergeChoiceMetadataByBestOptionCoverage([...normalized, ...hydrated]);
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error(`Unable to load choice metadata for ${logicalName}.`);
  }

  return [];
}

export async function fetchNormalizedNavigationProperties(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<RelationshipMetadata[]> {
  const safeLogicalName = logicalName.replace(/'/g, "''");
  const [manyToOne, oneToMany, manyToMany] = await Promise.all([
    getList<any>(
      client,
      token,
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToOneRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedAttribute,ReferencingEntityNavigationPropertyName,CascadeConfiguration,AssociatedMenuConfiguration`
    ).catch(() => []),
    getList<any>(
      client,
      token,
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/OneToManyRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedAttribute,ReferencedEntityNavigationPropertyName,CascadeConfiguration,AssociatedMenuConfiguration`
    ).catch(() => []),
    getList<any>(
      client,
      token,
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName,IntersectEntityName`
    ).catch(() => [])
  ]);

  return normalizeRelationshipMetadataList([...manyToOne, ...oneToMany, ...manyToMany], logicalName);
}
