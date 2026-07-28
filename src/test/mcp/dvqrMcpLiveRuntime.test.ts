import * as assert from "assert";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import { loadDvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

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

  test("guides callers to relationshipHint and forbids guessed pathIds", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_generate_relationship_query");
    assert.ok(tool);
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
