import * as assert from "assert";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import { DVQR_MCP_TOOL_CATALOGUE, DVQR_MCP_TOOL_NAMES } from "../../mcp/mcpToolCatalogue.js";
import { createDvqrMcpCapabilityPayload } from "../../mcp/mcpCapabilityPayload.js";

suite("investigation orchestration guidance", () => {
  test("routes inferred confirmation and manual edits through their canonical persistence tools", () => {
    const update = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_update_investigation_intent");
    const confirm = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_confirm_investigation_intent");
    assert.ok(update && confirm);
    assert.match(update.description, /edit or manual-capture path only/i);
    assert.match(update.description, /never call this tool to accept an unchanged(?: or cosmetically renamed)? inferred proposal/i);
    assert.match(update.description, /dvqr_confirm_investigation_intent is mandatory/i);
    assert.match(update.description, /editText is required/i);
    assert.match(update.description, /exact latest user message/i);
    assert.match(update.description, /must never be reinterpreted as an edit/i);
    assert.match(confirm.description, /confirmationText/i);
    assert.match(confirm.description, /(?:latest user message|immediately preceding message|host-supplied confirmation text)/i);
    assert.match(confirm.description, /skip confirmation/i);
    assert.match(confirm.description, /host trust boundary/i);
    assert.match(confirm.description, /not independently authenticated/i);
    assert.match(confirm.description, /never fabricate confirmationText/i);
    assert.match(confirm.description, /never (?:fabricate confirmationText or )?substitute a canonical phrase/i);
    const required = (confirm.inputSchema as any).required ?? [];
    assert.deepStrictEqual(required, ["investigationId", "confirmationText"]);
    assert.strictEqual((confirm.inputSchema.properties as any)?.confirmationSource, undefined);
  });


  test("prefers path-aware managed runtime evidence when the investigation has a concrete target", () => {
    const cont = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_continue_investigation");
    const acquire = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_investigation_evidence");
    assert.ok(cont && acquire);
    assert.match(cont.description, /(?:prefer managed business-path-runtime evidence|managed business-path-runtime evidence[^.]*required runtime provider)/i);
    assert.match(cont.description, /concrete target/i);
    assert.match(cont.description, /runtime-relationship only when no concrete target/i);
    const provider = (acquire.inputSchema.properties as any)?.providerId;
    assert.match(provider.description, /business-path-runtime for hop-by-hop validation/i);
  });

  test("publishes bounded post-checkpoint mechanism-context evidence", () => {
    const acquire = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_investigation_evidence");
    assert.ok(acquire);
    const schema = acquire.inputSchema as any;
    assert.ok(schema.properties.providerId.enum.includes("mechanism-context"));
    assert.match(schema.properties.providerId.description, /post-Mini-RCA audit\/execution-history context/i);
    assert.match(schema.properties.fromIso.description, /mechanism-context/i);
    assert.match(schema.properties.toIso.description, /mechanism-context/i);
    assert.match(acquire.description, /Timeline evidence from live queries|never synthesize Timeline/i);
  });


  test("requires immediate rejection of mechanism false premises", () => {
    const payload = createDvqrMcpCapabilityPayload(true);
    const guidance = payload.toolSelectionGuidance.investigations.join(" ");
    assert.match(guidance, /MECHANISM FALSE-PREMISE RESPONSE RULE/i);
    assert.match(guidance, /reject the proposition before explaining/i);
    assert.match(guidance, /No\. That conclusion is not supported/i);
    assert.match(guidance, /Never begin with agreement words/i);
    assert.match(guidance, /Unavailable is not a zero-row result/i);
    assert.match(guidance, /Observed establishes bounded participation only/i);
  });

  test("publishes false-premise hygiene on the live acquisition tool", () => {
    const acquire = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_acquire_investigation_evidence");
    assert.ok(acquire);
    assert.match(acquire.description, /FALSE-PREMISE RESPONSE RULE/i);
    assert.match(acquire.description, /reject that conclusion in the first semantic sentence/i);
    assert.match(acquire.description, /never open with Correct, Yes, Confirmed or Exactly/i);
    assert.match(acquire.description, /Unavailable source.*not successfully read/i);
  });

  test("makes persisted readiness the direct Mini RCA prerequisite", () => {
    const live = DVQR_LIVE_MCP_TOOLS;
    const assess = live.find((item) => item.name === "dvqr_assess_investigation_readiness");
    const mini = live.find((item) => item.name === "dvqr_generate_mini_rca");
    assert.ok(assess && mini);
    assert.ok(
      /required prerequisite before dvqr_generate_mini_rca/i.test(assess.description) ||
      /call this directly before dvqr_generate_mini_rca/i.test(assess.description)
    );
    assert.match(assess.description, /only investigationId/i);
    assert.match(mini.description, /current non-stale managed readiness/i);
    assert.ok(
      /never infer readiness/i.test(mini.description) ||
      /current non-stale managed readiness/i.test(mini.description)
    );
  });

  test("keeps internal catalogue guidance aligned", () => {
    const assess = DVQR_MCP_TOOL_CATALOGUE.find((item) => item.name === DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness);
    const mini = DVQR_MCP_TOOL_CATALOGUE.find((item) => item.name === DVQR_MCP_TOOL_NAMES.generateMiniRca);
    assert.ok(assess && mini);
    assert.match(assess.description, /before dvqr_generate_mini_rca/i);
    assert.match(mini.description, /Requires a current persisted readiness assessment/i);
  });
});
