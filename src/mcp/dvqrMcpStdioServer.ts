#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DvqrMcpLiveToolDispatcher } from "./mcpLiveToolDispatcher.js";
import { DVQR_LIVE_MCP_TOOLS } from "./mcpLiveToolCatalogue.js";
import { loadDvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";

export async function startDvqrMcpStdioServer(): Promise<void> {
  const config = loadDvqrMcpRuntimeConfiguration();
  const dispatcher = new DvqrMcpLiveToolDispatcher(config);
  const server = new Server(
    { name: "dv-quick-run", version: "0.15.6" },
    { capabilities: { tools: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: DVQR_LIVE_MCP_TOOLS.map((tool) => ({
      name: tool.name,
      description: `[${tool.tier.toUpperCase()}] ${tool.description}`,
      inputSchema: tool.inputSchema
    }))
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => dispatcher.dispatch({
    name: request.params.name,
    arguments: (request.params.arguments ?? {}) as Record<string, unknown>
  }));

  const transport = new StdioServerTransport();
  await server.connect(transport);
}

if (require.main === module) {
  startDvqrMcpStdioServer().catch((error) => {
    process.stderr.write(`[DVQR MCP] ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
