import * as assert from "assert";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";

suite("DV Quick Run Hub MCP tool counts", () => {
  test("derives Free, Pro-only, and Pro total counts from the live catalogue", () => {
    const free = DVQR_LIVE_MCP_TOOLS.filter((tool) => tool.tier === "free").length;
    const proOnly = DVQR_LIVE_MCP_TOOLS.filter((tool) => tool.tier === "pro").length;
    assert.strictEqual(free, 23);
    assert.strictEqual(proOnly, 32);
    assert.strictEqual(DVQR_LIVE_MCP_TOOLS.length, 55);
    assert.strictEqual(free + proOnly, DVQR_LIVE_MCP_TOOLS.length);
  });
});
