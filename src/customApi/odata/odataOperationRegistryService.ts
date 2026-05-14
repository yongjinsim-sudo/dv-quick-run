import type { CommandContext } from "../../commands/context/commandContext.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import type { ODataOperationRegistry } from "./odataMetadataParser.js";
import { parseODataOperationRegistry } from "./odataMetadataParser.js";

interface CachedRegistry {
  environmentUrl: string;
  registry: ODataOperationRegistry;
}

const cachedRegistries = new Map<string, CachedRegistry>();

function normalizeEnvironmentUrl(environmentUrl: string): string {
  return environmentUrl.trim().replace(/\/+$/, "").toLowerCase();
}

export class ODataOperationRegistryService {
  constructor(
    private readonly ctx: CommandContext,
    private readonly client: DataverseClient,
    private readonly token: string
  ) {}

  async getRegistry(environmentUrl: string): Promise<ODataOperationRegistry> {
    const normalizedEnvironmentUrl = normalizeEnvironmentUrl(environmentUrl);
    const cachedRegistry = cachedRegistries.get(normalizedEnvironmentUrl);
    if (cachedRegistry) {
      return cachedRegistry.registry;
    }

    const metadataXml = await this.client.getText("/$metadata", this.token, { timeoutMs: 30000 });
    const registry = parseODataOperationRegistry(metadataXml);
    cachedRegistries.set(normalizedEnvironmentUrl, { environmentUrl: normalizedEnvironmentUrl, registry });
    this.ctx.output.appendLine(`DV Quick Run: Loaded OData operation registry with ${registry.operations.length} operations.`);
    return registry;
  }

  static clearCache(environmentUrl?: string): void {
    if (environmentUrl) {
      cachedRegistries.delete(normalizeEnvironmentUrl(environmentUrl));
      return;
    }

    cachedRegistries.clear();
  }

  static getCachedEnvironmentUrls(): string[] {
    return Array.from(cachedRegistries.keys()).sort();
  }
}
