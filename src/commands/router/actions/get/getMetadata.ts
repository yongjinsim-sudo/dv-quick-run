import { CommandContext } from "../../../context/commandContext.js";
import { DataverseClient } from "../../../../services/dataverseClient.js";

import { EntityDef } from "../../../../utils/entitySetCache.js";
import { FieldDef } from "../../../../services/entityFieldMetadataService.js";

import {
  loadEntityDefs,
  loadFields
} from "../shared/metadataAccess.js";

export async function getEntityDefs(
  ctx: CommandContext,
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {
  return loadEntityDefs(ctx, client, token);
}

export async function getFieldsForEntity(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldDef[]> {
  return loadFields(ctx, client, token, logicalName);
}