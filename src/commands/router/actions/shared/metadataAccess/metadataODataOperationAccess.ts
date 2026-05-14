import type { CommandContext } from "../../../../context/commandContext.js";
import type { DataverseClient } from "../../../../../services/dataverseClient.js";
import type { ODataOperationRegistry } from "../../../../../customApi/odata/odataMetadataParser.js";
import { ODataOperationRegistryService } from "../../../../../customApi/odata/odataOperationRegistryService.js";

export async function loadODataOperationRegistry(
  ctx: CommandContext,
  client: DataverseClient,
  token: string,
  environmentUrl: string
): Promise<ODataOperationRegistry> {
  const registryService = new ODataOperationRegistryService(ctx, client, token);
  return await registryService.getRegistry(environmentUrl);
}

export function clearODataOperationRegistryCache(environmentUrl?: string): void {
  ODataOperationRegistryService.clearCache(environmentUrl);
}
