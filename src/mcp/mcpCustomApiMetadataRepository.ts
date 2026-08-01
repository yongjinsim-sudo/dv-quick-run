import { getDataverseAccessToken } from "../auth/azureCliAuth.js";
import {
  CUSTOM_API_QUERY,
  CUSTOM_API_REQUEST_PARAMETER_QUERY,
  CUSTOM_API_RESPONSE_PROPERTY_QUERY,
  mapCustomApiDefinitions,
  type CustomApiRecord,
  type CustomApiRequestParameterRecord,
  type CustomApiResponsePropertyRecord
} from "../customApi/discovery/customApiDefinitionMapper.js";
import type { CustomApiDefinition } from "../customApi/models/customApiTypes.js";
import { mcpDataverseGet } from "./mcpDataverseTransport.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export interface McpCustomApiMetadataSnapshot {
  readonly definitions: readonly CustomApiDefinition[];
  readonly executionContexts: readonly unknown[];
  readonly transports: readonly string[];
  readonly nativeFetchFailures: readonly (string | undefined)[];
}

function values<T>(data: unknown): T[] {
  if (!data || typeof data !== "object" || Array.isArray(data)) return [];
  const value = (data as Record<string, unknown>).value;
  return Array.isArray(value) ? value as T[] : [];
}

export class McpCustomApiMetadataRepository {
  public constructor(private readonly config: DvqrMcpRuntimeConfiguration) {}

  public async discover(environmentUrl: string): Promise<McpCustomApiMetadataSnapshot> {
    const token = await getDataverseAccessToken(`${environmentUrl}/.default`, this.config.tenantId);
    const baseUrl = `${environmentUrl}/api/data/v9.2`;
    const results = await Promise.all([
      mcpDataverseGet({ baseUrl, path: CUSTOM_API_QUERY, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet({ baseUrl, path: CUSTOM_API_REQUEST_PARAMETER_QUERY, token, timeoutMs: this.config.requestTimeoutMs }),
      mcpDataverseGet({ baseUrl, path: CUSTOM_API_RESPONSE_PROPERTY_QUERY, token, timeoutMs: this.config.requestTimeoutMs })
    ]);
    return {
      definitions: mapCustomApiDefinitions(
        values<CustomApiRecord>(results[0].data),
        values<CustomApiRequestParameterRecord>(results[1].data),
        values<CustomApiResponsePropertyRecord>(results[2].data)
      ),
      executionContexts: results.map((result) => result.executionContext),
      transports: results.map((result) => result.transport),
      nativeFetchFailures: results.map((result) => result.nativeFetchFailure)
    };
  }
}
