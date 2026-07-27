#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DvqrMcpServerFoundation } from "./dvqrMcpServerFoundation.js";
import { DvqrMcpFreeApplicationAdapter } from "./mcpFreeApplicationAdapter.js";
import { DVQR_LIVE_MCP_TOOLS, DVQR_PUBLIC_TO_INTERNAL_TOOL } from "./mcpLiveToolCatalogue.js";
import { loadDvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

function textResult(text: string, structuredContent?: unknown, isError = false) {
  return {
    content: [{ type: "text" as const, text }],
    ...(structuredContent === undefined ? {} : { structuredContent: (structuredContent && typeof structuredContent === "object" && !Array.isArray(structuredContent)) ? structuredContent : { result: structuredContent } }),
    ...(isError ? { isError: true } : {})
  };
}

function capabilityPayload(proEnabled: boolean) {
  return {
    contractVersion: "dvqr-mcp-capabilities-v1",
    product: "DV Quick Run",
    releaseVersion: "0.15.4",
    transport: "stdio",
    mode: "local-read-only",
    commercialBoundary: {
      free: "Execute, query, inspect, explain and understand.",
      pro: "Correlate, derive, prioritise, recommend and investigate."
    },
    proEnabled,
    implementedTools: DVQR_LIVE_MCP_TOOLS.map(({ name, title, tier, description }) => ({ name, title, tier, description })),
    deferredCapabilities: [
      "Guided Traversal MCP projection",
      "Custom API discovery and read-only function execution",
      "Execution Profile projection",
      "DVQR Score projection",
      "Timeline, Cross-Environment Diff and Mini RCA orchestration"
    ],
    limitations: [
      "No PATCH, POST, DELETE or workspace mutation tools are registered.",
      "OData execution uses Azure CLI authentication and requires an explicit local Dataverse environment.",
      "On Windows, low-level Node fetch failures retry through a bounded read-only PowerShell transport.",
      "Pro readiness calls require DVQR_MCP_PRO_ENABLED=true until packaged entitlement reuse is connected."
    ]
  };
}

export async function startDvqrMcpStdioServer(): Promise<void> {
  const config = loadDvqrMcpRuntimeConfiguration();
  const freeAdapter = new DvqrMcpFreeApplicationAdapter(config);
  const foundation = new DvqrMcpServerFoundation();
  const server = new Server(
    { name: "dv-quick-run", version: "0.15.4" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: DVQR_LIVE_MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: `[${tool.tier.toUpperCase()}] ${tool.description}`,
      inputSchema: tool.inputSchema
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "dvqr_list_capabilities") {
      const payload = capabilityPayload(config.proEnabled);
      return textResult("DVQR local MCP is active. Free execution and understanding tools are available; Pro tools provide investigation acceleration.", payload);
    }
    if (name === "dvqr_explain_odata") {
      const result = freeAdapter.explainOData(args);
      return result.ok ? textResult(result.summary, result.structuredContent) : textResult(result.message, result, true);
    }
    if (name === "dvqr_execute_odata") {
      const result = await freeAdapter.executeOData(args);
      return result.ok ? textResult(result.summary, result.structuredContent) : textResult(result.message, result, true);
    }
    if (name === "dvqr_search_metadata") {
      const result = await freeAdapter.searchMetadata(args);
      return result.ok ? textResult(result.summary, result.structuredContent) : textResult(result.message, result, true);
    }
    if (name === "dvqr_get_entity_metadata") {
      const result = await freeAdapter.getEntityMetadata(args);
      return result.ok ? textResult(result.summary, result.structuredContent) : textResult(result.message, result, true);
    }

    const internalName = DVQR_PUBLIC_TO_INTERNAL_TOOL.get(name);
    if (internalName) {
      if (!config.proEnabled) {
        return textResult(
          "This investigation acceleration tool requires DVQR Pro. Free MCP can execute and explain supported queries; Pro derives readiness, gaps and evidence recommendations.",
          {
            status: "capability_required",
            capability: name,
            availableIn: "pro",
            preview: ["Deterministic investigation readiness", "Evidence-gap derivation", "Evidence-linked recommendations"]
          },
          true
        );
      }
      const result = foundation.callTool({ name: internalName, arguments: args as never });
      if (!result.ok) {
        return textResult(result.error.message, result, true);
      }
      return textResult(`DVQR completed ${name}.`, result.structuredContent);
    }

    return textResult(`Unknown DVQR MCP tool: ${name}`, { code: "ToolNotFound", toolName: name }, true);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  startDvqrMcpStdioServer().catch((error) => {
    process.stderr.write(`[DVQR MCP] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
