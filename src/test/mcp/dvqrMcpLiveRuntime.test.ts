import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import {
  createDvqrLiveMcpToolRegistry,
  DVQR_LIVE_MCP_TOOL_BY_NAME,
  DVQR_LIVE_MCP_TOOLS
} from "../../mcp/mcpLiveToolCatalogue.js";
import { listDvqrMcpProtocolTools } from "../../mcp/dvqrMcpStdioServer.js";
import { loadDvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { DvqrMcpLiveCapabilityPolicy } from "../../mcp/mcpLiveCapabilityPolicy.js";
import { createDvqrMcpCapabilityPayload } from "../../mcp/mcpCapabilityPayload.js";
import { createDvqrMcpCapabilityManifest } from "../../mcp/mcpCapabilityManifest.js";
import { getDvqrReleaseVersion } from "../../product/releaseIdentity.js";
import { DvqrMcpFreeApplicationAdapter } from "../../mcp/mcpFreeApplicationAdapter.js";
import { McpCustomApiExecutionPreviewSessionStore } from "../../mcp/mcpCustomApiExecutionPreviewSessionStore.js";

suite("dvqrMcpLiveRuntime", () => {
  test("projects the packaged release version through every MCP identity surface", () => {
    const root = path.join(__dirname, "..", "..", "..");
    const packageJson = JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")) as { version: string };
    const expected = packageJson.version;
    assert.strictEqual(getDvqrReleaseVersion(), expected);
    assert.strictEqual((createDvqrMcpCapabilityPayload(false) as any).releaseVersion, expected);
    assert.strictEqual(createDvqrMcpCapabilityManifest().releaseVersion, expected);
  });

  test("publishes the first live Free and Pro tool surface", () => {
    const names = DVQR_LIVE_MCP_TOOLS.map((tool) => tool.name);
    assert.deepStrictEqual(names.slice(0, 5), [
      "dvqr_list_capabilities",
      "dvqr_explain_odata",
      "dvqr_execute_odata",
      "dvqr_search_metadata",
      "dvqr_get_entity_metadata"
    ]);
    const proToolNames = DVQR_LIVE_MCP_TOOLS.filter((tool) => tool.tier === "pro").map((tool) => tool.name);
    assert.strictEqual(proToolNames.length, 32);
    assert.ok(proToolNames.includes("dvqr_start_investigation"));
    assert.ok(proToolNames.includes("dvqr_get_investigation"));
    assert.ok(proToolNames.includes("dvqr_list_investigations"));
    assert.ok(proToolNames.includes("dvqr_get_investigation_strategy"));
    assert.ok(proToolNames.includes("dvqr_continue_investigation"));
    assert.ok(proToolNames.includes("dvqr_acquire_mechanism_context"));
    assert.ok(proToolNames.includes("dvqr_pause_investigation"));
    assert.ok(proToolNames.includes("dvqr_resume_investigation"));
    assert.ok(DVQR_LIVE_MCP_TOOLS.every((tool) => !/^dvqr_(?:patch|delete)(?:_|$)/i.test(tool.name)));
    assert.ok(!names.includes("dvqr_update_record"));
  });


  test("publishes investigation tools as persistent state operations rather than evidence acquisition", () => {
    const start = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_start_investigation");
    const get = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_investigation");
    const list = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_list_investigations");
    if (!start || !get || !list) throw new Error("Expected investigation lifecycle tools.");
    assert.match(
      start.description,
      /Investigation Brief.*continue with or edit the inferred intent/is
    );
    assert.match(
      start.description,
      /metadata-only preparation.*no runtime record query.*persists no investigation evidence/is
    );
    assert.ok(
      /do not acquire investigation evidence before intent exists/i.test(start.description) ||
      (/persists no investigation evidence/i.test(start.description) &&
        /dvqr_confirm_investigation_intent/i.test(start.description))
    );
    assert.match(get.description, /authoritative/i);
    assert.match(list.description, /empty list.*authoritative/i);
    const subject = (start.inputSchema as any).properties.subject;
    assert.ok(subject.properties.table);
    assert.ok(subject.properties.recordId);
  });

  test("Pass 10.8.9.4 exposes bootstrap as a confirmation-capable fallback on restricted host surfaces", () => {
    const bootstrap = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_bootstrap_investigation");
    const continuation = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_continue_investigation");
    if (!bootstrap || !continuation) throw new Error("Expected bootstrap and continuation tools.");
    assert.strictEqual(bootstrap.tier, "pro");
    assert.strictEqual(continuation.tier, "pro");
    const schema = bootstrap.inputSchema as any;
    assert.ok(schema.properties.confirmationText);
    assert.match(bootstrap.description, /same investigationId/i);
    assert.match(bootstrap.description, /NEVER call dvqr_start_investigation again/i);
    assert.match(bootstrap.description, /confirmation classifier/i);
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
      DVQR_MCP_WORKSPACE_ROOT: "C:\\work\\dvqr-test",
      DVQR_MCP_PRO_ENABLED: "true",
      DVQR_MCP_REQUEST_TIMEOUT_MS: "15000"
    });
    assert.strictEqual(config.environmentUrl, "https://example.crm6.dynamics.com");
    assert.strictEqual(config.tenantId, "tenant");
    assert.strictEqual(config.workspaceRoot, "C:\\work\\dvqr-test");
    assert.strictEqual(config.proEnabled, true);
    assert.strictEqual(config.requestTimeoutMs, 15000);
  });
  test("publishes the investigation workflow and primary entry point", () => {
    const start = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_start_investigation");
    const capabilities = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_list_capabilities");
    assert.ok(start && capabilities);
    assert.match(start.description, /PRIMARY INVESTIGATION ENTRY POINT/i);
    assert.match(start.description, /investigate or troubleshoot/i);
    assert.match(start.description, /Mini RCA/i);
    assert.match(start.description, /Example: User: Investigate Contact/i);
    assert.match(capabilities.description, /canonical investigation workflow/i);
    const payload = createDvqrMcpCapabilityPayload(true) as any;
    assert.strictEqual(payload.investigationWorkflow.primaryEntryTool, "dvqr_start_investigation");
    assert.deepStrictEqual(
      payload.investigationWorkflow.steps.map((step: any) => step.tool),
      [
        "dvqr_start_investigation",
        "dvqr_confirm_investigation_intent",
        "dvqr_continue_investigation",
        "dvqr_acquire_investigation_evidence",
        "dvqr_assess_investigation_readiness",
        "dvqr_generate_mini_rca",
        "dvqr_acquire_investigation_evidence",
        "dvqr_assess_investigation_readiness",
        "dvqr_generate_mini_rca"
      ]
    );
    assert.ok(payload.toolSelectionGuidance.investigations.some((line: string) => /PRIMARY ENTRY/.test(line) && /dvqr_start_investigation/.test(line)));
    const continuation = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_continue_investigation") as any;
    assert.ok(continuation?.inputSchema?.properties?.confirmationText);
    assert.match(continuation.description, /HOST-COMPATIBILITY FALLBACK/i);
    assert.match(continuation.description, /same confirmation classifier/i);
  });


  test("Pass 10.8.4 publishes managed readiness as investigationId-only on the live MCP surface", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_assess_investigation_readiness");
    if (!tool) throw new Error("Managed readiness tool missing.");
    const schema = tool.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["investigationId"]);
    assert.ok(schema.properties.investigationId);
    assert.strictEqual(schema.properties.request, undefined);
    assert.match(tool.description, /passing only investigationId/i);
  });

  test("publishes unambiguous investigation continuation and readiness routing", () => {
    const get = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_investigation");
    const strategy = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_investigation_strategy");
    const continuation = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_continue_investigation");
    const readiness = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_investigation_readiness");
    const lowLevelGaps = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_investigation_gaps");
    const anchors = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_discover_operational_anchors");
    if (!get || !strategy || !continuation || !readiness || !lowLevelGaps || !anchors) throw new Error("Expected investigation routing tools.");
    assert.match(get.description, /read-only.*never advances/i);
    assert.match(strategy.description, /Only dvqr_continue_investigation may advance/i);
    assert.match(continuation.description, /exact next planned investigation action/i);
    assert.match(readiness.description, /investigationId/i);
    assert.match(readiness.description, /Do not search the workspace/i);
    assert.match(lowLevelGaps.title, /Low-Level/i);
    assert.match(lowLevelGaps.description, /Do not use this tool for conversational requests/i);
    assert.match(lowLevelGaps.description, /dvqr_get_investigation_readiness/i);
    assert.match(anchors.description, /standalone exploratory tool/i);
    assert.match(anchors.description, /not automatically attached/i);
    const guidance = (createDvqrMcpCapabilityPayload(true) as any).toolSelectionGuidance.investigations as string[];
    assert.ok(guidance.some((line) => /only tool that advances/.test(line) && /dvqr_continue_investigation/.test(line)));
    assert.ok(guidance.some((line) => /show readiness/.test(line) && /dvqr_get_investigation_readiness/.test(line)));
  });

});


suite("MCP protocol Mini RCA registration", () => {

  test("Pass 10.8.5 exposes a checkpoint-named Mini RCA generator alias with retrieval distinction", () => {
    const checkpoint = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_generate_mini_rca_checkpoint");
    const getter = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_get_mini_rca");
    if (!checkpoint || !getter) throw new Error("Expected Mini RCA checkpoint generator and getter.");
    assert.match(checkpoint.description, /FIRST-CLASS STRATEGY HANDOFF/i);
    assert.match(checkpoint.description, /same bounded evidence-backed Mini RCA artifact/i);
    assert.match(checkpoint.description, /Do not substitute dvqr_get_mini_rca/i);
    assert.match(getter.description, /does not regenerate/i);
  });
  test("Pass 10.9.1.2 exposes a guaranteed Mini RCA host-surface fallback on continuation", () => {
    const continuation = DVQR_LIVE_MCP_TOOLS.find((tool) => tool.name === "dvqr_continue_investigation");
    if (!continuation) throw new Error("Expected continuation tool.");
    const schema = continuation.inputSchema as any;
    assert.ok(schema.properties.executeRecommendedMiniRca);
    assert.match(String(schema.properties.executeRecommendedMiniRca.description), /restricted host-surface fallback/i);
    assert.match(continuation.description, /HOST-SURFACE MINI RCA FALLBACK/i);
  });

  test("exposes both managed Mini RCA tools through the actual protocol tool list", () => {
    const names = listDvqrMcpProtocolTools().map((tool) => tool.name);
    assert.ok(names.includes("dvqr_generate_mini_rca"));
    assert.ok(names.includes("dvqr_generate_mini_rca_checkpoint"));
    assert.ok(names.includes("dvqr_get_mini_rca"));
  });

  test("documents all investigation evidence provider IDs directly", () => {
    const tool = listDvqrMcpProtocolTools().find((item) => item.name === "dvqr_acquire_investigation_evidence");
    assert.ok(tool);
    const provider = ((tool.inputSchema as any).properties.providerId);
    assert.deepStrictEqual(provider.enum, ["metadata", "relationship-context", "runtime-relationship", "business-path-runtime", "mechanism-context", "timeline-context", "plugin-execution-understanding"]);
  });


  test("business-path discovery consumes workspace Preferred paths before metadata-ranked alternatives", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_discover_business_paths");
    if (!tool) throw new Error("Expected dvqr_discover_business_paths.");
    assert.match(tool.description, /Managed Business Path preference/i);
    assert.match(tool.description, /top-visible workspace recommendation/i);
    assert.match(tool.description, /without changing discovery scores/i);
    assert.match(tool.description, /dvqr_test_business_path/i);
  });


  test("exposes v0.15.8 asserted-business-traversal inputs and promotion integrity on Free MCP", () => {
    const validate = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_validate_business_paths");
    const save = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_save_business_path");
    if (!validate || !save) throw new Error("Expected business-path validation and save tools.");

    const validateSchema = validate.inputSchema as any;
    assert.ok(validateSchema.properties.assertedBusinessPathTables);
    assert.ok(validateSchema.properties.assertedBusinessPathRelationshipSchemaNames);
    assert.match(validate.description, /v0\.15\.8 asserted-business-traversal contract/i);
    assert.match(validate.description, /shorter runtime shortcuts separate/i);
    assert.match(validate.description, /promotionDecision\.eligible=true/i);
    assert.match(validate.description, /saveFollowUp/i);
    assert.match(validate.description, /STOP/i);

    const saveSchema = save.inputSchema as any;
    assert.ok(saveSchema.properties.intendedTables);
    assert.ok(saveSchema.properties.promotionAuthorizationId);
    assert.deepStrictEqual(saveSchema.required, ["confirmSave"]);
    assert.match(save.description, /PREFERRED MODE/i);
    assert.match(save.description, /server-held authorization/i);
    assert.match(save.description, /do NOT reconstruct/i);
    assert.match(save.description, /single-use/i);
  });

  test("publishes focused Managed Business Path MCP management tools with explicit mutation confirmation", () => {
    const list = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_list_business_paths");
    const get = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_get_business_path");
    const save = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_save_business_path");
    const remove = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_remove_business_path");
    const revalidate = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_revalidate_business_path");
    const verifySaved = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_verify_business_path");
    const testSaved = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_test_business_path");
    const probeRelationship = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_probe_relationship_path");

    if (!list || !get || !save || !remove || !revalidate || !verifySaved || !testSaved || !probeRelationship) {
      throw new Error("Expected all Managed Business Path MCP tools and relationship probe tool.");
    }

    assert.strictEqual(list.tier, "free");
    assert.strictEqual(get.tier, "free");
    assert.strictEqual(save.tier, "free");
    assert.strictEqual(remove.tier, "free");
    assert.strictEqual(revalidate.tier, "free");
    assert.strictEqual(verifySaved.tier, "free");
    assert.strictEqual(testSaved.tier, "free");
    assert.strictEqual(probeRelationship.tier, "free");
    assert.match(probeRelationship.description, /SCOPE-BOUNDARY RULE/i);
    assert.match(probeRelationship.description, /new explicit user request/i);

    assert.match(save.description, /MUTATION/i);
    assert.match(save.description, /explicit user/i);
    assert.match(save.description, /promotionAuthorizationId/i);
    assert.deepStrictEqual(
      (save.inputSchema as any).required,
      ["confirmSave"]
    );
    assert.strictEqual((save.inputSchema as any).properties.confirmSave.type, "boolean");

    assert.match(remove.description, /MUTATION/i);
    assert.match(remove.description, /explicit user/i);
    assert.deepStrictEqual((remove.inputSchema as any).required, ["pathId", "confirmDelete"]);

    assert.match(revalidate.description, /CANONICAL METADATA-ONLY REVERIFY/i);
    assert.match(revalidate.description, /Reverify this saved path against the current environment/i);
    assert.match(revalidate.description, /requires only pathId/i);
    assert.match(revalidate.description, /Do NOT ask for sourceRecordId/i);
    assert.match(revalidate.description, /does not query records/i);
    assert.deepStrictEqual((revalidate.inputSchema as any).required, ["pathId"]);
    assert.match(get.description, /does not revalidate current metadata/i);

    assert.match(verifySaved.description, /CANONICAL ONE-CALL RUNTIME VERIFY WORKFLOW/i);
    assert.match(verifySaved.description, /explicitly asks to runtime-verify/i);
    assert.match(verifySaved.description, /requires sourceRecordId/i);
    assert.match(verifySaved.description, /bare request.*Reverify this saved path against the current environment/i);
    assert.match(verifySaved.description, /dvqr_revalidate_business_path/i);
    assert.match(verifySaved.description, /executes the exact saved route once/i);
    assert.match(verifySaved.description, /bounded observation/i);
    assert.match(verifySaved.description, /EMPTY-FRONTIER RULE/i);
    assert.match(verifySaved.description, /dvqr_probe_relationship_path/i);
    assert.match(verifySaved.description, /dvqr_discover_business_paths/i);
    assert.match(verifySaved.description, /new explicit user request/i);
    assert.match(verifySaved.description, /do NOT automatically call dvqr_execute_odata/i);
    assert.match(verifySaved.description, /must not be described as production-ready/i);
    assert.deepStrictEqual(
      (verifySaved.inputSchema as any).required,
      ["pathId", "sourceRecordId"]
    );

    assert.match(testSaved.description, /canonical tool/i);
    assert.match(testSaved.description, /do NOT manually reconstruct/i);
    assert.match(testSaved.description, /exact route first/i);
    assert.match(testSaved.description, /never downgrades an earlier successful verification/i);
    assert.match(testSaved.description, /EMPTY-FRONTIER RULE/i);
    assert.match(testSaved.description, /dvqr_probe_relationship_path/i);
    assert.match(testSaved.description, /dvqr_discover_business_paths/i);
    assert.match(testSaved.description, /new explicit user request/i);
    assert.match(testSaved.description, /do NOT automatically call dvqr_execute_odata/i);
    assert.match(testSaved.description, /alternate entity-set names/i);
    assert.match(testSaved.description, /must not be described as production-ready/i);
    assert.deepStrictEqual(
      (testSaved.inputSchema as any).required,
      ["pathId", "sourceRecordId"]
    );
    assert.strictEqual((testSaved.inputSchema as any).properties.refreshVerification.default, true);
  });


  test("publishes asserted Business Path promotion guidance to MCP hosts", () => {
    const payload = createDvqrMcpCapabilityPayload(false) as any;
    const guidance = payload.toolSelectionGuidance.businessPaths as string[];
    assert.ok(guidance.some((line) => /assertedBusinessPathTables/.test(line) && /Do not replace/i.test(line)));
    assert.ok(guidance.some((line) => /assertedBusinessPathRelationshipSchemaNames/.test(line)));
    assert.ok(guidance.some((line) => /promotionDecision\.eligible=true/.test(line)));
    assert.ok(guidance.some((line) => /saveFollowUp/.test(line) && /STOP/.test(line)));
    assert.ok(guidance.some((line) => /promotionAuthorizationId/.test(line) && /Do not reconstruct/i.test(line)));
    assert.ok(guidance.some((line) => /runtimePreferredPath/.test(line) && /never a substitute/i.test(line)));
    assert.ok(guidance.some((line) => /EMPTY-FRONTIER \/ NO-BROADENING RULE/i.test(line) && /dvqr_execute_odata/i.test(line)));
    assert.ok(guidance.some((line) => /EMPTY-FRONTIER \/ NO-BROADENING RULE/i.test(line) && /dvqr_probe_relationship_path/i.test(line)));
    assert.ok(guidance.some((line) => /EMPTY-FRONTIER \/ NO-BROADENING RULE/i.test(line) && /dvqr_discover_business_paths/i.test(line)));
    assert.ok(guidance.some((line) => /REVERIFY \/ CURRENT-ENVIRONMENT CHECK/i.test(line) && /dvqr_revalidate_business_path/i.test(line) && /does not require sourceRecordId/i.test(line)));
    assert.ok(guidance.some((line) => /RUNTIME VERIFY \/ TEST/i.test(line) && /dvqr_verify_business_path/i.test(line) && /specific source record/i.test(line)));
    assert.ok(guidance.some((line) => /EVIDENCE WORDING/i.test(line) && /production-ready/i.test(line)));
    assert.ok(guidance.some((line) => /Manual dvqr_save_business_path/.test(line) && /not-runtime-verified/i.test(line)));
  });

  test("publishes Pass 10.2 bounded business-path runtime validation", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_validate_business_paths");
    assert.ok(tool);
    assert.strictEqual(tool.tier, "free");
    assert.match(tool.description, /Pass 10\.2 bounded runtime validation/i);
    assert.match(tool.description, /hop-by-hop/i);
    assert.match(tool.description, /(source record only|this source record|this record only)/i);
    const schema = tool.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["sourceTable", "targetTable", "sourceRecordId"]);
    assert.strictEqual(schema.properties.maxCandidates.default, 5);
  });

  test("publishes Pass 10.1.1 depth-diverse metadata-only business-path discovery separately from generic relationship paths", () => {
    const business = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_discover_business_paths");
    const relationship = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_find_relationship_paths");
    if (!business || !relationship) throw new Error("Expected relationship and business-path discovery tools.");
    assert.strictEqual(business.tier, "free");
    assert.match(business.description, /Pass 10\.1\.1 metadata-only business-path discovery/i);
    assert.match(business.description, /does NOT query records/i);
    assert.match(business.description, /do not suppress plausible deeper workflow routes/i);
    assert.match(business.description, /business-preferred/i);
    assert.match(relationship.description, /relationship paths/i);
    const schema = business.inputSchema as any;
    assert.deepStrictEqual(schema.required, ["sourceTable", "targetTable"]);
    assert.strictEqual(schema.properties.maxDepth.default, 5);
  });

});
