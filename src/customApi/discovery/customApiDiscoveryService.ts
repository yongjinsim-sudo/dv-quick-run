import type { CommandContext } from "../../commands/context/commandContext.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import type { CustomApiDefinition } from "../models/customApiTypes.js";
import {
  CUSTOM_API_QUERY,
  CUSTOM_API_REQUEST_PARAMETER_QUERY,
  CUSTOM_API_RESPONSE_PROPERTY_QUERY,
  mapCustomApiDefinitions,
  type CustomApiRecord,
  type CustomApiRequestParameterRecord,
  type CustomApiResponsePropertyRecord,
  type DataverseListResponse
} from "./customApiDefinitionMapper.js";

export class CustomApiDiscoveryService {
  constructor(
    private readonly ctx: CommandContext,
    private readonly client: DataverseClient,
    private readonly token: string
  ) {}

  async discoverCustomApis(): Promise<CustomApiDefinition[]> {
    const [customApiResult, requestParameterResult, responsePropertyResult] = await Promise.all([
      this.client.get(CUSTOM_API_QUERY, this.token),
      this.client.get(CUSTOM_API_REQUEST_PARAMETER_QUERY, this.token),
      this.client.get(CUSTOM_API_RESPONSE_PROPERTY_QUERY, this.token)
    ]) as [
      DataverseListResponse<CustomApiRecord>,
      DataverseListResponse<CustomApiRequestParameterRecord>,
      DataverseListResponse<CustomApiResponsePropertyRecord>
    ];

    const definitions = mapCustomApiDefinitions(
      customApiResult.value ?? [],
      requestParameterResult.value ?? [],
      responsePropertyResult.value ?? []
    );
    this.ctx.output.appendLine(`DV Quick Run: Discovered ${definitions.length} Custom API definitions.`);
    return definitions;
  }
}
