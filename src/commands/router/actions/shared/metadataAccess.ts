import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";

import { getCachedEntityDefs, setCachedEntityDefs, EntityDef } from "../../../../utils/entitySetCache.js";
import { fetchEntityDefs } from "../../../../services/entityMetadataService.js";
import type { FieldMetadata } from "../../../../metadata/metadataModel.js";
import { getCachedFields, setCachedFields } from "../../../../utils/entityFieldCache.js";
import { fetchEntityFields, FieldDef } from "../../../../services/entityFieldMetadataService.js";
import { logDebug } from "../../../../utils/logger.js";
import {
  getSelectableFields,
  type SelectableField,
  selectTokenForField
} from "./selectableFields.js";

import { fetchEntityNavigationProperties } from "../../../../services/entityRelationshipMetadataService.js";
import {
  getCachedNavigationProperties,
  setCachedNavigationProperties
} from "../../../../utils/entityRelationshipCache.js";
import {
  getChoiceMemory,
  setChoiceMemory,
  getOrCreateChoiceInFlight
} from "./metadataLoadCache.js";

import {
  getEntityDefsMemory,
  setEntityDefsMemory,
  getOrCreateEntityDefsInFlight,
  getFieldsMemory,
  setFieldsMemory,
  getOrCreateFieldsInFlight,
  getNavigationMemory,
  setNavigationMemory,
  getOrCreateNavigationInFlight
} from "./metadataLoadCache.js";
import { getCachedChoiceMetadata, setCachedChoiceMetadata } from "../../../../utils/entityChoiceCache.js";
import { fetchEntityChoiceMetadata, type ChoiceMetadataDef } from "../../../../services/entityChoiceMetadataService.js";
import {
  matchChoiceLabelFromMetadata,
  resolveChoiceValueFromMetadata,
  type ResolvedChoiceValue
} from "./valueAwareness.js";

type MetadataLoadOptions = {
  silent?: boolean;
  suppressOutput?: boolean;
};

function appendOutput(
  ctx: CommandContext,
  message: string,
  options?: MetadataLoadOptions
): void {
  if (!options?.suppressOutput) {
    logDebug(ctx.output,message);
  }
}

async function runMetadataLoad<T>(
  title: string,
  factory: () => Promise<T>,
  options?: MetadataLoadOptions
): Promise<T> {
  if (options?.silent) {
    return factory();
  }

  return vscode.window.withProgress<T>(
    {
      location: vscode.ProgressLocation.Notification,
      title,
      cancellable: false
    },
    async () => await factory()
  );
}

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export type RelationshipHit = {
  navigationPropertyName: string;
  targetLogicalName: string;
};

export async function loadNavigationProperties(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<any[]> {
  const memory = getNavigationMemory<any>(logicalName);
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedNavigationProperties(ctx.ext, envName, logicalName);
  if (cached?.length) {
    setNavigationMemory(logicalName, cached);
    appendOutput(
      ctx,
      `Navigation properties cache hit for ${logicalName}: ${cached.length} relationships.`,
      options
    );
    return cached;
  }

  const relationships = await getOrCreateNavigationInFlight<any>(logicalName, async () => {
    const fetched = await runMetadataLoad<any[]>(
      `DV Quick Run: Loading navigation properties for ${logicalName}...`,
      async () => await fetchEntityNavigationProperties(client, token, logicalName),
      options
    );

    await setCachedNavigationProperties(ctx.ext, envName, logicalName, fetched);
    setNavigationMemory(logicalName, fetched);
    appendOutput(
      ctx,
      `Navigation properties fetched for ${logicalName}: ${fetched.length} relationships.`,
      options
    );

    return fetched;
  });

  return relationships;
}

export async function findFieldOnDirectlyRelatedEntity(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  defs: EntityDef[],
  baseLogicalName: string,
  fieldToken: string
): Promise<RelationshipHit | undefined> {
  const relationships = await loadNavigationProperties(ctx, client, token, baseLogicalName);

  for (const rel of relationships) {
    const navigationPropertyName = String(rel?.navigationPropertyName ?? "").trim();
    if (!navigationPropertyName) {
      continue;
    }

    const candidateTargets = [rel?.referencedEntity, rel?.referencingEntity]
      .map((value) => String(value ?? "").trim())
      .filter((value) => !!value);

    const targetLogicalName = candidateTargets.find(
      (value) => normalizeName(value) !== normalizeName(baseLogicalName)
    );

    if (!targetLogicalName) {
      continue;
    }

    const targetEntity =
      findEntityByLogicalName(defs, targetLogicalName) ??
      ({ logicalName: targetLogicalName } as EntityDef);

    const targetFields = await loadFields(ctx, client, token, targetEntity.logicalName);

    const found =
      findFieldByLogicalName(targetFields, fieldToken) ??
      findFieldBySelectToken(targetFields, fieldToken);

    if (found) {
      return {
        navigationPropertyName,
        targetLogicalName: targetEntity.logicalName
      };
    }
  }

  return undefined;
}

export async function loadEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  options?: MetadataLoadOptions
): Promise<EntityDef[]> {
  const memory = getEntityDefsMemory<EntityDef>();
  if (memory?.length) {
    return memory;
  }
  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedEntityDefs(ctx.ext, envName);
  if (cached?.length) {
    setEntityDefsMemory(cached);
    appendOutput(ctx, `Entity defs cache hit: ${cached.length} items.`, options);
    return cached;
  }

  try {
    const defs = await getOrCreateEntityDefsInFlight<EntityDef>(async () => {
      const fetched = await runMetadataLoad<EntityDef[]>(
        "DV Quick Run: Loading Dataverse entity list...",
        async () => await fetchEntityDefs(client, token),
        options
      );

      await setCachedEntityDefs(ctx.ext, envName, fetched);
      setEntityDefsMemory(fetched);
      appendOutput(ctx, `Entity defs fetched: ${fetched.length} items.`, options);

      return fetched;
    });

    return defs;
  } catch (e: any) {
    appendOutput(ctx, `Entity defs fetch failed: ${e?.message ?? String(e)}`, options);

    const fallback: EntityDef[] = [
      { entitySetName: "accounts", logicalName: "account" },
      { entitySetName: "contacts", logicalName: "contact" },
      { entitySetName: "systemusers", logicalName: "systemuser" },
      { entitySetName: "businessunits", logicalName: "businessunit" },
      { entitySetName: "teams", logicalName: "team" },
      { entitySetName: "tasks", logicalName: "task" },
      { entitySetName: "incidents", logicalName: "incident" },
      { entitySetName: "opportunities", logicalName: "opportunity" },
      { entitySetName: "leads", logicalName: "lead" },
      { entitySetName: "queues", logicalName: "queue" },
      { entitySetName: "annotations", logicalName: "annotation" }
    ];

    if (!options?.silent) {
      vscode.window.showWarningMessage(
        "DV Quick Run: Could not load entity metadata. Using fallback table list."
      );
    }

    return fallback;
  }
}

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

  const fields = await getOrCreateFieldsInFlight<FieldDef>(logicalName, async () => {
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

  return fields;
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
      .filter((field): field is FieldDef => !!field && !!normalizeName(field.logicalName))
      .map((field) => [normalizeName(field.logicalName), field])
  );
}

export function findFieldByLogicalName(
  fields: FieldDef[],
  logicalName: string
): FieldDef | undefined {
  const key = normalizeName(logicalName);
  if (!key) {
    return undefined;
  }

  return buildFieldMap(fields).get(key);
}

export function findFieldBySelectToken(
  fields: FieldDef[],
  selectToken: string
): FieldDef | undefined {
  const normalizedToken = normalizeName(selectToken);
  if (!normalizedToken) {
    return undefined;
  }

  return fields.find((field) => normalizeName(getSelectToken(field)) === normalizedToken);
}

function getSelectToken(field: FieldMetadata): string {
  return selectTokenForField({
    logicalName: field.logicalName ?? "",
    attributeType: field.attributeType ?? ""
  }) ?? "";
}

export async function loadEntityDefByLogicalName(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<EntityDef | undefined> {
  const defs = await loadEntityDefs(ctx, client, token);
  return findEntityByLogicalName(defs, logicalName);
}

export async function loadEntityDefByEntitySetName(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  entitySetName: string
): Promise<EntityDef | undefined> {
  const defs = await loadEntityDefs(ctx, client, token);
  return findEntityByEntitySetName(defs, entitySetName);
}

export function findEntityByLogicalName(
  defs: EntityDef[],
  logicalName: string
): EntityDef | undefined {
  const ln = normalizeName(logicalName);
  return defs.find((d) => normalizeName(d.logicalName) === ln);
}

export function findEntityByEntitySetName(
  defs: EntityDef[],
  entitySetName: string
): EntityDef | undefined {
  const esn = normalizeName(entitySetName);
  return defs.find((d) => normalizeName(d.entitySetName) === esn);
}

export async function resolveChoiceValue(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  fieldLogicalName: string,
  rawValue: string | number | boolean
): Promise<ResolvedChoiceValue | undefined> {
  const values = await loadChoiceMetadata(ctx, client, token, logicalName);
  return resolveChoiceValueFromMetadata(values, fieldLogicalName, rawValue);
}

export async function matchChoiceLabel(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  fieldLogicalName: string,
  rawLabel: string
): Promise<ResolvedChoiceValue | undefined> {
  const values = await loadChoiceMetadata(ctx, client, token, logicalName);
  return matchChoiceLabelFromMetadata(values, fieldLogicalName, rawLabel);
}

export async function loadChoiceMetadata(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string,
  options?: MetadataLoadOptions
): Promise<ChoiceMetadataDef[]> {
  const memory = getChoiceMemory<ChoiceMetadataDef>(logicalName);
  if (memory?.length) {
    return memory;
  }

  const envName = ctx.envContext.getEnvironmentName();
  const cached = getCachedChoiceMetadata(ctx.ext, envName, logicalName);
  if (cached?.length) {
    setChoiceMemory(logicalName, cached);
    appendOutput(
      ctx,
      `Choice metadata cache hit for ${logicalName}: ${cached.length} fields.`,
      options
    );
    return cached;
  }

  const values = await getOrCreateChoiceInFlight<ChoiceMetadataDef>(logicalName, async () => {
    const fetched = options?.silent
      ? await fetchEntityChoiceMetadata(client, token, logicalName)
      : await vscode.window.withProgress<ChoiceMetadataDef[]>(
          {
            location: vscode.ProgressLocation.Notification,
            title: `DV Quick Run: Loading choice metadata for ${logicalName}...`,
            cancellable: false
          },
          async () => await fetchEntityChoiceMetadata(client, token, logicalName)
        );

    await setCachedChoiceMetadata(ctx.ext, envName, logicalName, fetched);
    setChoiceMemory(logicalName, fetched);
    appendOutput(
      ctx,
      `Choice metadata fetched for ${logicalName}: ${fetched.length} fields.`,
      options
    );

    return fetched;
  });

  return values;
}

