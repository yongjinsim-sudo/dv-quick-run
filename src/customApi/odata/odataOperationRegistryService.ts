import type { CommandContext } from "../../commands/context/commandContext.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import type { ODataOperationRegistry } from "./odataMetadataParser.js";
import { parseODataOperationRegistry } from "./odataMetadataParser.js";

interface CachedRegistry {
  environmentUrl: string;
  registry: ODataOperationRegistry;
}

let cachedRegistry: CachedRegistry | undefined;

export class ODataOperationRegistryService {
  constructor(
    private readonly ctx: CommandContext,
    private readonly client: DataverseClient,
    private readonly token: string
  ) {}

  async getRegistry(environmentUrl: string): Promise<ODataOperationRegistry> {
    const normalizedEnvironmentUrl = environmentUrl.trim().replace(/\/+$/, "").toLowerCase();
    if (cachedRegistry?.environmentUrl === normalizedEnvironmentUrl) {
      return cachedRegistry.registry;
    }

    const metadataXml = await this.client.getText("/$metadata", this.token, { timeoutMs: 30000 });
    const registry = parseODataOperationRegistry(metadataXml);
    cachedRegistry = { environmentUrl: normalizedEnvironmentUrl, registry };
    this.ctx.output.appendLine(`DV Quick Run: Loaded OData operation registry with ${registry.operations.length} operations.`);
    return registry;
  }

  static clearCache(): void {
    cachedRegistry = undefined;
  }
}
