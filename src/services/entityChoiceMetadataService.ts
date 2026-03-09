import { DataverseClient } from "./dataverseClient";
import { fetchNormalizedChoiceMetadata } from "../metadata/metadataService.js";
import type { ChoiceMetadata } from "../metadata/metadataModel.js";

export type ChoiceMetadataDef = ChoiceMetadata;

export async function fetchEntityChoiceMetadata(
  client: DataverseClient,
  token: string,
  logicalName: string
): Promise<ChoiceMetadataDef[]> {
  return fetchNormalizedChoiceMetadata(client, token, logicalName);
}
