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
  const path =
    `/EntityDefinitions(LogicalName='${safeLogicalName}')/Attributes` +
    "?$select=LogicalName,AttributeType,IsValidForRead,IsValidForCreate,IsValidForUpdate,IsValidForAdvancedFind,AttributeOf,SchemaName,DisplayName&$top=5000";

  try {
    const rows = await getList<any>(client, token, path);
    const normalized = normalizeFieldMetadataList(rows);
    if (normalized.length) {
      return normalized;
    }
  } catch {
    // Fall back to expanded entity metadata below.
  }

  const response = await client.get(
    `/EntityDefinitions(LogicalName='${safeLogicalName}')?$select=LogicalName&$expand=Attributes($select=LogicalName,AttributeType,IsValidForRead,IsValidForCreate,IsValidForUpdate,IsValidForAdvancedFind,AttributeOf,SchemaName,DisplayName)`,
    token
  );

  const rows = Array.isArray((response as { Attributes?: any[] })?.Attributes)
    ? (response as { Attributes?: any[] }).Attributes ?? []
    : [];

  const normalized = normalizeFieldMetadataList(rows);
  if (!normalized.length) {
    throw new Error(`No fields parsed for ${logicalName}`);
  }

  return normalized;
}

export async function fetchNormalizedChoiceMetadata(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<ChoiceMetadata[]> {
  const safeLogicalName = logicalName.replace(/'/g, "''");

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
    return normalized;
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
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToOneRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencingEntityNavigationPropertyName`
    ).catch(() => []),
    getList<any>(
      client,
      token,
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/OneToManyRelationships?$select=SchemaName,ReferencingAttribute,ReferencedEntity,ReferencingEntity,ReferencedEntityNavigationPropertyName`
    ).catch(() => []),
    getList<any>(
      client,
      token,
      `/EntityDefinitions(LogicalName='${safeLogicalName}')/ManyToManyRelationships?$select=SchemaName,Entity1LogicalName,Entity2LogicalName,Entity1NavigationPropertyName,Entity2NavigationPropertyName`
    ).catch(() => [])
  ]);

  return normalizeRelationshipMetadataList([...manyToOne, ...oneToMany, ...manyToMany], logicalName);
}
