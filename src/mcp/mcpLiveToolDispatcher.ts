import { DvqrMcpServerFoundation } from "./dvqrMcpServerFoundation.js";
import { DvqrMcpFreeApplicationAdapter } from "./mcpFreeApplicationAdapter.js";
import { createDvqrMcpCapabilityPayload } from "./mcpCapabilityPayload.js";
import { DvqrMcpLiveCapabilityPolicy } from "./mcpLiveCapabilityPolicy.js";
import {
  DVQR_LIVE_MCP_TOOL_BY_NAME,
  type DvqrLiveMcpFreeHandlerId
} from "./mcpLiveToolCatalogue.js";
import type { DvqrMcpPortableTextOptions } from "./mcpPortableText.js";
import type { DvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import type { DvqrMcpFreeToolResult } from "./mcpToolResults.js";
import { formatDvqrMcpToolResponse, type DvqrMcpToolResponse } from "./mcpToolResponseFormatter.js";

export interface DvqrMcpLiveToolCall {
  readonly name: string;
  readonly arguments?: Record<string, unknown>;
}

type FreeHandler = (args: Record<string, unknown>) => Promise<DvqrMcpToolResponse>;

export class DvqrMcpLiveToolDispatcher {
  private readonly portableTextOptions: DvqrMcpPortableTextOptions;
  private readonly freeHandlers: Readonly<Record<DvqrLiveMcpFreeHandlerId, FreeHandler>>;
  private readonly capabilityPolicy: DvqrMcpLiveCapabilityPolicy;

  public constructor(
    private readonly config: DvqrMcpRuntimeConfiguration,
    private readonly freeAdapter = new DvqrMcpFreeApplicationAdapter(config),
    private readonly foundation = new DvqrMcpServerFoundation()
  ) {
    this.capabilityPolicy = new DvqrMcpLiveCapabilityPolicy(config.proEnabled);
    this.portableTextOptions = {
      enabled: config.emitTextMirror,
      maxCharacters: config.textMirrorMaxCharacters
    };
    this.freeHandlers = this.createFreeHandlers();
  }

  public async dispatch(call: DvqrMcpLiveToolCall): Promise<DvqrMcpToolResponse> {
    const tool = DVQR_LIVE_MCP_TOOL_BY_NAME.get(call.name);
    if (!tool) {
      return this.format(`Unknown DVQR MCP tool: ${call.name}`, {
        code: "ToolNotFound",
        toolName: call.name
      }, true);
    }

    const args = call.arguments ?? {};
    const decision = this.capabilityPolicy.decide(tool);
    if (!decision.allowed) {
      return this.format(
        "This investigation acceleration tool requires DVQR Pro. Free MCP can execute and explain supported queries; Pro derives readiness, gaps and evidence recommendations.",
        this.capabilityPolicy.capabilityRequiredPayload(tool),
        true
      );
    }
    if (tool.handler.kind === "pro") {
      return this.dispatchProTool(tool.name, tool.handler.internalName, args);
    }
    return this.freeHandlers[tool.handler.id](args);
  }

  private createFreeHandlers(): Readonly<Record<DvqrLiveMcpFreeHandlerId, FreeHandler>> {
    return {
      listCapabilities: async () => this.format(
        "DVQR local MCP is active. Free execution and understanding tools are available; Pro tools provide investigation acceleration.",
        createDvqrMcpCapabilityPayload(this.config.proEnabled)
      ),
      explainOData: async (args) => this.formatFreeResult(this.freeAdapter.explainOData(args)),
      executeOData: async (args) => this.formatFreeResult(await this.freeAdapter.executeOData(args)),
      searchMetadata: async (args) => this.formatFreeResult(await this.freeAdapter.searchMetadata(args)),
      getEntityMetadata: async (args) => this.formatFreeResult(await this.freeAdapter.getEntityMetadata(args)),
      discoverCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.discoverCustomApis(args)),
      getCustomApiDefinition: async (args) => this.formatFreeResult(await this.freeAdapter.getCustomApiDefinition(args)),
      explainCustomApi: async (args) => this.formatFreeResult(await this.freeAdapter.explainCustomApi(args)),
      compareCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.compareCustomApis(args)),
      recommendCustomApis: async (args) => this.formatFreeResult(await this.freeAdapter.recommendCustomApis(args)),
      recommendSolutionArchitecture: async (args) => this.formatFreeResult(await this.freeAdapter.recommendSolutionArchitecture(args)),
      checkCustomApiExecution: async (args) => this.formatFreeResult(await this.freeAdapter.checkCustomApiExecution(args)),
      previewCustomApiExecution: async (args) => this.formatFreeResult(await this.freeAdapter.previewCustomApiExecution(args)),
      executeCustomApi: async (args) => this.formatFreeResult(await this.freeAdapter.executeCustomApi(args)),
      interpretCustomApiExecution: async (args) => this.formatFreeResult(this.freeAdapter.interpretCustomApiExecution(args)),
      discoverOperationalAnchors: async (args) => this.formatFreeResult(await this.freeAdapter.discoverOperationalAnchors(args)),
      resolveNavigationProperty: async (args) => this.formatFreeResult(await this.freeAdapter.resolveNavigationProperty(args)),
      findRelationshipPaths: async (args) => this.formatFreeResult(await this.freeAdapter.findRelationshipPaths(args)),
      generateRelationshipQuery: async (args) => this.dispatchRelationshipQuery(args),
      probeRelationshipPath: async (args) => this.formatFreeResult(await this.freeAdapter.probeRelationshipPath(args)),
      explainLookup: async (args) => this.formatFreeResult(await this.freeAdapter.explainLookup(args))
    };
  }

  private async dispatchRelationshipQuery(args: Record<string, unknown>): Promise<DvqrMcpToolResponse> {
    try {
      const result = await this.freeAdapter.generateRelationshipQuery(args);
      if (result.ok) {
        return this.format(result.summary, result.structuredContent);
      }
      if (result.code === "UnknownNavigationProperty" || result.code === "InvalidArguments") {
        return this.format(result.message, result.structuredContent ?? {
          ok: false,
          code: result.code,
          queryGenerated: false,
          message: result.message
        });
      }
      return this.format(result.message, result.structuredError ?? result, true);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return this.format(
        `DVQR could not generate a relationship query safely: ${message}. No query was generated.`,
        {
          ok: false,
          code: "ExecutionFailed",
          queryGenerated: false,
          message,
          evidenceBoundary: "DVQR did not emit a query because the metadata-verified generation path failed."
        },
        true
      );
    }
  }

  private dispatchProTool(
    publicName: string,
    internalName: string,
    args: Record<string, unknown>
  ): DvqrMcpToolResponse {
    const result = this.foundation.callTool({ name: internalName, arguments: args as never });
    if (!result.ok) {
      return this.format(result.error.message, result, true);
    }
    return this.format(`DVQR completed ${publicName}.`, result.structuredContent);
  }

  private formatFreeResult(result: DvqrMcpFreeToolResult): DvqrMcpToolResponse {
    return result.ok
      ? this.format(result.displayText ?? result.summary, result.structuredContent)
      : this.format(result.message, result.structuredError ?? result, true);
  }

  private format(text: string, structuredContent: unknown, isError = false): DvqrMcpToolResponse {
    return formatDvqrMcpToolResponse(text, structuredContent, this.portableTextOptions, isError);
  }
}
