import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";

import { getCachedEntityDefs, setCachedEntityDefs, EntityDef } from "../../../../utils/entitySetCache.js";
import { fetchEntityDefs } from "../../../../services/entityMetadataService.js";
import type { FieldMetadata } from "../../../../metadata/metadataModel.js";
import { getCachedFields, setCachedFields } from "../../../../utils/entityFieldCache.js";
import { fetchEntityFields, FieldDef } from "../../../../services/entityFieldMetadataService.js";

import {
  getSelectableFields,
  type SelectableField,
  selectTokenForField
} from "./selectableFields.js";

function normalizeName(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export async function loadEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {
  const cached = getCachedEntityDefs(ctx.ext);
  if (cached?.length) {
    ctx.output.appendLine(`Entity defs cache hit: ${cached.length} items.`);
    return cached;
  }

  try {
    const defs = await vscode.window.withProgress<EntityDef[]>(
      {
        location: vscode.ProgressLocation.Notification,
        title: "DV Quick Run: Loading Dataverse entity list...",
        cancellable: false
      },
      async () => await fetchEntityDefs(client, token)
    );

    await setCachedEntityDefs(ctx.ext, defs);
    ctx.output.appendLine(`Entity defs fetched: ${defs.length} items.`);
    return defs;
  } catch (e: any) {
    ctx.output.appendLine(`Entity defs fetch failed: ${e?.message ?? String(e)}`);

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

    vscode.window.showWarningMessage(
      "DV Quick Run: Could not load entity metadata. Using fallback table list."
    );

    return fallback;
  }
}

export async function loadFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldDef[]> {
  const cached = getCachedFields(ctx.ext, logicalName);
  if (cached?.length) {
    ctx.output.appendLine(`Fields cache hit for ${logicalName}: ${cached.length} fields.`);
    return cached;
  }

  const fields = await vscode.window.withProgress<FieldDef[]>(
    {
      location: vscode.ProgressLocation.Notification,
      title: `DV Quick Run: Loading fields for ${logicalName}...`,
      cancellable: false
    },
    async () => await fetchEntityFields(client, token, logicalName)
  );

  await setCachedFields(ctx.ext, logicalName, fields);
  ctx.output.appendLine(`Fields fetched for ${logicalName}: ${fields.length} fields.`);
  return fields;
}

export async function loadSelectableFields(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<SelectableField[]> {
  const fields = await loadFields(ctx, client, token, logicalName);
  const selectable = getSelectableFields(fields);
  ctx.output.appendLine(`Selectable fields for ${logicalName}: ${selectable.length} / ${fields.length}`);
  return selectable;
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
