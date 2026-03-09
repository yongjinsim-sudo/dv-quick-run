import { DataverseClient } from "./dataverseClient";
import { fetchNormalizedEntityMetadata } from "../metadata/metadataService.js";
import type { EntityMetadata } from "../metadata/metadataModel.js";

export type EntityDef = EntityMetadata;

export async function fetchEntityDefs(
  client: DataverseClient,
  token: string
): Promise<EntityDef[]> {
  return fetchNormalizedEntityMetadata(client, token);
}
