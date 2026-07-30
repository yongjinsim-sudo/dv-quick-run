#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { DvqrMcpServerFoundation } from "./dvqrMcpServerFoundation.js";
import { DvqrMcpFreeApplicationAdapter } from "./mcpFreeApplicationAdapter.js";
import { DVQR_LIVE_MCP_TOOLS, DVQR_PUBLIC_TO_INTERNAL_TOOL } from "./mcpLiveToolCatalogue.js";
import { loadDvqrMcpRuntimeConfiguration } from "./mcpRuntimeConfiguration.js";
import { buildPortableTextPayload, normalizeStructuredContent, type DvqrMcpPortableTextOptions } from "./mcpPortableText.js";

function textResult(
  text: string,
  structuredContent: unknown,
  portableTextOptions: DvqrMcpPortableTextOptions,
  isError = false
) {
  const normalized = normalizeStructuredContent(structuredContent);
  const portable = buildPortableTextPayload(normalized, portableTextOptions);
  const content: Array<{ type: "text"; text: string }> = [{ type: "text", text }];
  if (portable.text !== undefined) {
    content.push({ type: "text", text: portable.text });
  }
  return {
    content,
    ...(normalized === undefined ? {} : { structuredContent: normalized }),
    ...(isError ? { isError: true } : {})
  };
}

function capabilityPayload(proEnabled: boolean) {
  return {
    contractVersion: "dvqr-mcp-capabilities-v1",
    product: "DV Quick Run",
    releaseVersion: "0.15.6",
    transport: "stdio",
    mode: "local-read-only",
    commercialBoundary: {
      free: "Execute, query, inspect, explain and understand.",
      pro: "Correlate, derive, prioritise, recommend and investigate."
    },
    proEnabled,
    implementedTools: DVQR_LIVE_MCP_TOOLS.map(({ name, title, tier, description }) => ({ name, title, tier, description })),
    deferredCapabilities: [
      "FetchXML generation from verified paths",
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
  const portableTextOptions: DvqrMcpPortableTextOptions = {
    enabled: config.emitTextMirror,
    maxCharacters: config.textMirrorMaxCharacters
  };
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

  server.setRequestHandler(CallToolRequestSchema, async (request: any) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;

    if (name === "dvqr_list_capabilities") {
      const payload = capabilityPayload(config.proEnabled);
      return textResult("DVQR local MCP is active. Free execution and understanding tools are available; Pro tools provide investigation acceleration.", payload, portableTextOptions);
    }
    if (name === "dvqr_explain_odata") {
      const result = freeAdapter.explainOData(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_execute_odata") {
      const result = await freeAdapter.executeOData(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_search_metadata") {
      const result = await freeAdapter.searchMetadata(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_get_entity_metadata") {
      const result = await freeAdapter.getEntityMetadata(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_discover_operational_anchors") {
      const result = await freeAdapter.discoverOperationalAnchors(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_resolve_navigation_property") {
      const result = await freeAdapter.resolveNavigationProperty(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_find_relationship_paths") {
      const result = await freeAdapter.findRelationshipPaths(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_generate_relationship_query") {
      try {
        const result = await freeAdapter.generateRelationshipQuery(args);
        if (result.ok) {
          return textResult(result.summary, result.structuredContent, portableTextOptions);
        }
        // A metadata-grounded refusal is an expected tool outcome, not an MCP transport failure.
        // Returning it as a normal completion avoids SDK/client error-envelope handling while
        // preserving the explicit no-query evidence boundary for the caller.
        if (result.code === "UnknownNavigationProperty" || result.code === "InvalidArguments") {
          return textResult(result.message, result.structuredContent ?? {
            ok: false,
            code: result.code,
            queryGenerated: false,
            message: result.message
          }, portableTextOptions);
        }
        return textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        return textResult(
          `DVQR could not generate a relationship query safely: ${message}. No query was generated.`,
          { ok: false, code: "ExecutionFailed", queryGenerated: false, message, evidenceBoundary: "DVQR did not emit a query because the metadata-verified generation path failed." },
          portableTextOptions,
          true
        );
      }
    }
    if (name === "dvqr_probe_relationship_path") {
      const result = await freeAdapter.probeRelationshipPath(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
    }
    if (name === "dvqr_explain_lookup") {
      const result = await freeAdapter.explainLookup(args);
      return result.ok ? textResult(result.summary, result.structuredContent, portableTextOptions) : textResult(result.message, result.structuredError ?? result, portableTextOptions, true);
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
          portableTextOptions,
          true
        );
      }
      const result = foundation.callTool({ name: internalName, arguments: args as never });
      if (!result.ok) {
        return textResult(result.error.message, result, portableTextOptions, true);
      }
      return textResult(`DVQR completed ${name}.`, result.structuredContent, portableTextOptions);
    }

    return textResult(`Unknown DVQR MCP tool: ${name}`, { code: "ToolNotFound", toolName: name }, portableTextOptions, true);
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
