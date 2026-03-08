import { DataverseClient } from "./dataverseClient.js";
import { fetchNormalizedNavigationProperties } from "../metadata/metadataService.js";
import type { RelationshipMetadata } from "../metadata/metadataModel.js";

export type NavPropertyDef = RelationshipMetadata;

export async function fetchEntityNavigationProperties(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<NavPropertyDef[]> {
  return fetchNormalizedNavigationProperties(client, token, logicalName);
}
