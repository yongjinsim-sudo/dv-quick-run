import { DataverseClient } from "./dataverseClient.js";
import { fetchNormalizedFieldMetadata } from "../metadata/metadataService.js";
import type { FieldMetadata } from "../metadata/metadataModel.js";

export type FieldDef = FieldMetadata;

export async function fetchEntityFields(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<FieldDef[]> {
  return fetchNormalizedFieldMetadata(client, token, logicalName);
}
