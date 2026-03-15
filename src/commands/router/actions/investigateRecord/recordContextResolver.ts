import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import {
  loadEntityDefByEntitySetName,
  loadEntityDefs
} from "../shared/metadataAccess.js";
import { InvestigationInput, RecordContext } from "./types.js";

interface EntityChoice {
  logicalName: string;
  entitySetName: string;
  primaryIdField?: string;
  primaryNameField?: string;
}

export async function resolveRecordContext(
  ctx: CommandContext,
  input: InvestigationInput
): Promise<RecordContext | undefined> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());

  if (input.entityLogicalName && input.entitySetName) {
    return {
      entityLogicalName: input.entityLogicalName,
      entitySetName: input.entitySetName,
      inferenceSource: "explicit"
    };
  }

  if (input.entitySetName) {
    const entity = await loadEntityDefByEntitySetName(
      ctx,
      client,
      token,
      input.entitySetName
    );

    if (entity) {
      return {
        entityLogicalName: entity.logicalName,
        entitySetName: entity.entitySetName,
        primaryIdField: entity.primaryIdAttribute,
        primaryNameField: entity.primaryNameAttribute,
        inferenceSource: "recordPath"
      };
    }

    return {
      entityLogicalName: singularizeEntitySetName(input.entitySetName),
      entitySetName: input.entitySetName,
      inferenceSource: "recordPath"
    };
  }

  const picked = await promptForEntity(ctx, client, token);
  if (!picked) {
    return undefined;
  }

  return {
    entityLogicalName: picked.logicalName,
    entitySetName: picked.entitySetName,
    primaryIdField: picked.primaryIdField,
    primaryNameField: picked.primaryNameField,
    inferenceSource: "quickPick"
  };
}

async function promptForEntity(
  ctx: CommandContext,
  client: ReturnType<CommandContext["getClient"]>,
  token: string
): Promise<EntityChoice | undefined> {
  const entities = await getEntityChoices(ctx, client, token);

  if (!entities.length) {
    vscode.window.showWarningMessage("No Dataverse tables were available for selection.");
    return undefined;
  }

  const picked = await vscode.window.showQuickPick(
    entities.map((entity) => ({
      label: entity.logicalName,
      description: entity.entitySetName,
      detail: buildEntityDetail(entity),
      entity
    })),
    {
      placeHolder: "Select the Dataverse table for this record"
    }
  );

  return picked?.entity;
}

async function getEntityChoices(
  ctx: CommandContext,
  client: ReturnType<CommandContext["getClient"]>,
  token: string
): Promise<EntityChoice[]> {
  const defs = await loadEntityDefs(ctx, client, token, { silent: true });

  return defs
    .filter((def) => !!def.logicalName && !!def.entitySetName)
    .map((def) => ({
      logicalName: def.logicalName,
      entitySetName: def.entitySetName,
      primaryIdField: def.primaryIdAttribute,
      primaryNameField: def.primaryNameAttribute
    }))
    .sort((a, b) => a.logicalName.localeCompare(b.logicalName));
}

function buildEntityDetail(entity: EntityChoice): string {
  const parts: string[] = [];

  if (entity.primaryNameField) {
    parts.push(`Primary Name: ${entity.primaryNameField}`);
  }

  if (entity.primaryIdField) {
    parts.push(`Primary Id: ${entity.primaryIdField}`);
  }

  return parts.join(" | ");
}

function singularizeEntitySetName(entitySetName: string): string {
  if (entitySetName.endsWith("ies")) {
    return `${entitySetName.slice(0, -3)}y`;
  }

  if (entitySetName.endsWith("s")) {
    return entitySetName.slice(0, -1);
  }

  return entitySetName;
}

export async function promptForRecordContext(
  ctx: CommandContext
): Promise<RecordContext | undefined> {
  const client = ctx.getClient();
  const token = await ctx.getToken(ctx.getScope());

  const picked = await promptForEntity(ctx, client, token);
  if (!picked) {
    return undefined;
  }

  return {
    entityLogicalName: picked.logicalName,
    entitySetName: picked.entitySetName,
    primaryIdField: picked.primaryIdField,
    primaryNameField: picked.primaryNameField,
    inferenceSource: "quickPick"
  };
}