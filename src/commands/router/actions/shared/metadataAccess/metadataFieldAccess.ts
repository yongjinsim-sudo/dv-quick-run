import { CommandContext } from "../../../../context/commandContext.js";
import { DataverseClient } from "../../../../../services/dataverseClient.js";
import type { FieldMetadata } from "../../../../../metadata/metadataModel.js";
import { FieldDef, fetchEntityFields } from "../../../../../services/entityFieldMetadataService.js";
import { getCachedFields, setCachedFields } from "../../../../../utils/entityFieldCache.js";
import { getFieldsMemory, getOrCreateFieldsInFlight, setFieldsMemory } from "../metadataAccess/metadataSessionCache.js";
import { appendOutput, MetadataLoadOptions, normalizeMetadataName, runMetadataLoad } from "./metadataAccessCommon.js";
import { getSelectableFields, type SelectableField, selectTokenForField } from "../selectableFields.js";

export async function loadFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<FieldDef[]> {
  const memory = getFieldsMemory<FieldDef>(logicalName);
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedFields(ctx.ext, envName, logicalName);
  if (cached?.length) {
    setFieldsMemory(logicalName, cached);
    appendOutput(ctx, `Fields cache hit for ${logicalName}: ${cached.length} fields.`, options);
    return cached;
  }

  return await getOrCreateFieldsInFlight<FieldDef>(logicalName, async () => {
    const fetched = await runMetadataLoad<FieldDef[]>(
      `DV Quick Run: Loading fields for ${logicalName}...`,
      async () => await fetchEntityFields(client, token, logicalName),
      options
    );

    await setCachedFields(ctx.ext, envName, logicalName, fetched);
    setFieldsMemory(logicalName, fetched);
    appendOutput(ctx, `Fields fetched for ${logicalName}: ${fetched.length} fields.`, options);
    return fetched;
  });
}

export async function loadSelectableFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<SelectableField[]> {
  const fields = await loadFields(ctx, client, token, logicalName, options);
  return getSelectableFields(fields);
}

export function buildFieldMap(fields: FieldDef[]): Map<string, FieldDef> {
  return new Map(
    fields
      .filter((field): field is FieldDef => !!field && !!normalizeMetadataName(field.logicalName))
      .map((field) => [normalizeMetadataName(field.logicalName), field])
  );
}

export function findFieldByLogicalName(
  fields: FieldDef[],
  logicalName: string
): FieldDef | undefined {
  const key = normalizeMetadataName(logicalName);
  if (!key) {
    return undefined;
  }

  return buildFieldMap(fields).get(key);
}

export function findFieldBySelectToken(
  fields: FieldDef[],
  selectToken: string
): FieldDef | undefined {
  const normalizedToken = normalizeMetadataName(selectToken);
  if (!normalizedToken) {
    return undefined;
  }

  return fields.find((field) => normalizeMetadataName(getSelectToken(field)) === normalizedToken);
}

function getSelectToken(field: FieldMetadata): string {
  return selectTokenForField({
    logicalName: field.logicalName ?? "",
    attributeType: field.attributeType ?? ""
  }) ?? "";
}
