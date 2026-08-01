import * as assert from "assert";
import {
  createDvqrLiveMcpToolRegistry,
  DVQR_LIVE_MCP_TOOL_BY_NAME,
  DVQR_LIVE_MCP_TOOLS
} from "../../mcp/mcpLiveToolCatalogue.js";
import { loadDvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { DvqrMcpLiveCapabilityPolicy } from "../../mcp/mcpLiveCapabilityPolicy.js";
import { createDvqrMcpCapabilityPayload } from "../../mcp/mcpCapabilityPayload.js";
import { DvqrMcpFreeApplicationAdapter } from "../../mcp/mcpFreeApplicationAdapter.js";
import { McpCustomApiExecutionPreviewSessionStore } from "../../mcp/mcpCustomApiExecutionPreviewSessionStore.js";

suite("dvqrMcpLiveRuntime", () => {
  test("publishes the first live Free and Pro tool surface", () => {
    const names = DVQR_LIVE_MCP_TOOLS.map((tool) => tool.name);
    assert.deepStrictEqual(names.slice(0, 5), [
      "dvqr_list_capabilities",
      "dvqr_explain_odata",
      "dvqr_execute_odata",
      "dvqr_search_metadata",
      "dvqr_get_entity_metadata"
    ]);
    assert.strictEqual(DVQR_LIVE_MCP_TOOLS.filter((tool) => tool.tier === "pro").length, 4);
    assert.ok(DVQR_LIVE_MCP_TOOLS.every((tool) => !/patch|delete|update/i.test(tool.name)));
  });


  test("registers every tool once with a matching typed handler", () => {
    assert.strictEqual(DVQR_LIVE_MCP_TOOL_BY_NAME.size, DVQR_LIVE_MCP_TOOLS.length);
    for (const tool of DVQR_LIVE_MCP_TOOLS) {
      assert.strictEqual(tool.tier, tool.handler.kind);
      assert.strictEqual(DVQR_LIVE_MCP_TOOL_BY_NAME.get(tool.name), tool);
    }
  });

  test("requires an explicit discovery query so MCP clients send an empty string for inventory calls", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_discover_custom_apis");
    if (!tool) throw new Error("Expected dvqr_discover_custom_apis to be registered.");
    const schema = tool.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["query"]);
    assert.match(schema.properties.query.description, /empty string/);
  });

  test("publishes mutually exclusive Custom API explain and definition routing guidance", () => {
    const explain = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_explain_custom_api");
    const definition = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_get_custom_api_definition");
    if (!explain || !definition) throw new Error("Expected Custom API explain and definition tools.");

    assert.ok(DVQR_LIVE_MCP_TOOLS.indexOf(explain) < DVQR_LIVE_MCP_TOOLS.indexOf(definition));
    assert.match(explain.title, /Explain What/);
    assert.match(explain.description, /What does AIReply do\?/);
    assert.match(explain.description, /Do not use dvqr_get_custom_api_definition/);
    assert.match(definition.title, /Exact Custom API Metadata Definition/);
    assert.match(definition.description, /Do NOT choose this tool when the user asks what the API does/);
    assert.match(definition.description, /use dvqr_explain_custom_api/);
  });

  test("publishes an unambiguous Custom API tool-selection decision table", () => {
    const payload = createDvqrMcpCapabilityPayload(false) as any;
    const guidance = payload.toolSelectionGuidance.customApis as string[];
    assert.ok(guidance.some((line) => /what a named Custom API does/.test(line) && /dvqr_explain_custom_api/.test(line)));
    assert.ok(guidance.some((line) => /exact definition/.test(line) && /dvqr_get_custom_api_definition/.test(line)));
    assert.ok(guidance.some((line) => /Never substitute/.test(line)));
  });

  test("publishes deterministic Custom API compare and recommend routing", () => {
    const compare = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_compare_custom_apis");
    const recommend = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_recommend_custom_apis");
    if (!compare || !recommend) throw new Error("Expected Custom API compare and recommend tools.");
    assert.match(compare.description, /Compare AIReply vs AISummarize/);
    assert.match(compare.description, /Do not make several dvqr_explain_custom_api calls/);
    assert.match(recommend.description, /Which API should I use/);
    assert.match(recommend.description, /Do not repeatedly call discovery or explain tools/);
    assert.match(recommend.description, /suppresses weak lexical matches/);
    assert.strictEqual((compare.inputSchema as any).properties.uniqueNames.maxItems, 10);
    const guidance = (createDvqrMcpCapabilityPayload(false) as any).toolSelectionGuidance.customApis as string[];
    assert.ok(guidance.some((line) => /dvqr_compare_custom_apis/.test(line)));
    assert.ok(guidance.some((line) => /dvqr_recommend_custom_apis/.test(line)));
    assert.ok(guidance.some((line) => /no strong fit/.test(line)));
  });

  test("publishes solution architecture routing separately from API shortlist recommendation", () => {
    const architecture = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_recommend_solution_architecture");
    const recommend = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_recommend_custom_apis");
    if (!architecture || !recommend) throw new Error("Expected solution architecture and Custom API recommendation tools.");
    assert.match(architecture.description, /end-to-end solution pipeline/);
    assert.match(architecture.description, /do not call dvqr_recommend_custom_apis first/i);
    assert.match(architecture.description, /original goal unchanged/i);
    assert.match(recommend.description, /ranked capability shortlist/);
    assert.match(recommend.description, /DO NOT use this tool when the user asks to design/i);
    const guidance = (createDvqrMcpCapabilityPayload(false) as any).toolSelectionGuidance.customApis as string[];
    assert.ok(guidance.some((line) => /dvqr_recommend_solution_architecture/.test(line)));
  });

  test("publishes preview-bound Custom API live execution routing", () => {
    const preview = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_preview_custom_api_execution");
    const execute = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_execute_custom_api");
    if (!preview || !execute) throw new Error("Expected Custom API preview and execution tools.");
    assert.match(preview.description, /single-use previewId|preview/i);
    assert.match(preview.description, /call this tool directly/i);
    assert.match(preview.description, /do not call definition or explain first/i);
    assert.match(preview.description, /Never use dvqr_execute_odata/i);
    assert.match(execute.description, /ONLY DV Quick Run tool permitted to execute Custom APIs/i);
    assert.match(execute.description, /execute AIReply immediately.*not confirmation/i);
    assert.match(execute.description, /Never use dvqr_execute_odata/i);
    assert.match(execute.description, /reply exactly EXECUTE/i);
    assert.match(execute.description, /previewId/i);
    const odata = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_execute_odata");
    if (!odata) throw new Error("Expected OData execution tool.");
    assert.match(odata.description, /Do NOT use this tool to invoke Dataverse Actions, Functions or Custom APIs/i);
    const schema = execute.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["previewId", "confirmation"]);
    assert.deepStrictEqual(schema.properties.confirmation.enum, ["EXECUTE"]);
  });

  test("publishes execution interpretation as a non-executing continuation tool", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_interpret_custom_api_execution");
    if (!tool) throw new Error("Expected Custom API execution interpretation tool.");
    assert.match(tool.description, /without previewing, re-executing or contacting Dataverse/i);
    assert.match(tool.description, /what happened|why an execution failed/i);
    assert.strictEqual(tool.handler.kind, "free");
    const schema = tool.inputSchema as any;
    assert.deepStrictEqual(schema.required, undefined);
    assert.ok(schema.properties.executionId);
  });

  test("wires preview and execute through one runtime singleton session store", () => {
    const store = new McpCustomApiExecutionPreviewSessionStore();
    const adapter = new DvqrMcpFreeApplicationAdapter({
      environmentUrl: "https://example.crm6.dynamics.com",
      requestTimeoutMs: 30000
    } as any, store) as any;
    assert.strictEqual(adapter.customApiExecutionPreviewSessions, store);
    assert.strictEqual(adapter.customApiExecutionPreviewApplicationService.previewSessions, store);
    assert.strictEqual(adapter.customApiExecutionApplicationService.previewSessions, store);
  });

  test("rejects duplicate tool registrations", () => {
    const duplicate = [DVQR_LIVE_MCP_TOOLS[0], DVQR_LIVE_MCP_TOOLS[0]];
    assert.throws(() => createDvqrLiveMcpToolRegistry(duplicate), /Duplicate DVQR MCP tool registration/);
  });


  test("projects registration and availability from one capability policy", () => {
    const freePolicy = new DvqrMcpLiveCapabilityPolicy(false);
    const proPolicy = new DvqrMcpLiveCapabilityPolicy(true);
    const proTool = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.tier === "pro");
    const freeTool = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.tier === "free");
    if (!proTool || !freeTool) {
      throw new Error("Expected both Free and Pro MCP tools.");
    }

    assert.strictEqual(freePolicy.decide(freeTool).allowed, true);
    assert.strictEqual(freePolicy.decide(proTool).availability, "capability_required");
    assert.strictEqual(proPolicy.decide(proTool).availability, "available");

    const payload = createDvqrMcpCapabilityPayload(false);
    const projected = (payload.implementedTools as readonly any[]).find((tool) => tool.name === proTool.name);
    assert.strictEqual(projected.availability, "capability_required");
  });

  test("builds capability-required responses from the registered descriptor", () => {
    const policy = new DvqrMcpLiveCapabilityPolicy(false);
    const proTool = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.tier === "pro");
    if (!proTool) {
      throw new Error("Expected a Pro MCP tool.");
    }
    const payload = policy.capabilityRequiredPayload(proTool);
    assert.strictEqual(payload.capability, proTool.name);
    assert.strictEqual(payload.availableIn, proTool.tier);
  });

  test("guides callers to relationshipHint and forbids guessed pathIds", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_generate_relationship_query");
    if (!tool) {
      throw new Error("Expected dvqr_generate_relationship_query to be registered.");
    }
    assert.match(tool.description, /Prefer relationshipHint/);
    const properties = (tool.inputSchema as any).properties;
    assert.match(properties.pathId.description, /copied exactly/);
    assert.match(properties.pathId.description, /Do not construct or guess/);
    assert.match(properties.relationshipHint.description, /Preferred when the user names/);
    assert.match(tool.description, /return no query/);
  });

  test("loads explicit local runtime configuration", () => {
    const config = loadDvqrMcpRuntimeConfiguration({
      DVQR_MCP_ENVIRONMENT_URL: "https://example.crm6.dynamics.com/",
      DVQR_MCP_TENANT_ID: "tenant",
      DVQR_MCP_PRO_ENABLED: "true",
      DVQR_MCP_REQUEST_TIMEOUT_MS: "15000"
    });
    assert.strictEqual(config.environmentUrl, "https://example.crm6.dynamics.com");
    assert.strictEqual(config.tenantId, "tenant");
    assert.strictEqual(config.proEnabled, true);
    assert.strictEqual(config.requestTimeoutMs, 15000);
  });
});
