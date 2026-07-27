import type { ReadonlyJsonObject } from "../core/readiness/index.js";
import { DvqrMcpApplicationAdapter } from "./mcpApplicationAdapter.js";
import { createDvqrMcpCapabilityManifest } from "./mcpCapabilityManifest.js";
import {
  DVQR_MCP_CONTRACT_VERSION,
  type DvqrMcpCapabilityManifestV1,
  type DvqrMcpToolCallV1,
  type DvqrMcpToolResultV1
} from "./mcpContracts.js";
import { DVQR_MCP_TOOL_CATALOGUE, type DvqrMcpToolName } from "./mcpToolCatalogue.js";

const toolNames = new Set(DVQR_MCP_TOOL_CATALOGUE.map((tool) => tool.name));

export class DvqrMcpServerFoundation {
  public constructor(private readonly adapter = new DvqrMcpApplicationAdapter()) {}

  public capabilities(): DvqrMcpCapabilityManifestV1 {
    return createDvqrMcpCapabilityManifest();
  }

  public listTools() {
    return DVQR_MCP_TOOL_CATALOGUE;
  }

  public callTool(call: DvqrMcpToolCallV1): DvqrMcpToolResultV1 {
    if (!toolNames.has(call.name)) {
      return {
        contractVersion: DVQR_MCP_CONTRACT_VERSION,
        ok: false,
        toolName: call.name,
        error: {
          contractVersion: DVQR_MCP_CONTRACT_VERSION,
          code: "ToolNotFound",
          message: `Unknown DVQR MCP tool: ${call.name}`,
          retryable: false,
          limitations: ["No application service was invoked."]
        }
      };
    }
    return this.adapter.call(call.name as DvqrMcpToolName, call.arguments as ReadonlyJsonObject | undefined);
  }
}
