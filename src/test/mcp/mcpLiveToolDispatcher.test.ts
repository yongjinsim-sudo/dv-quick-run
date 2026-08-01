import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

suite("mcpLiveToolDispatcher", () => {
  test("returns capabilities without invoking Dataverse", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({ name: "dvqr_list_capabilities" });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual((response.structuredContent as any).contractVersion, "dvqr-mcp-capabilities-v1");
    assert.strictEqual((response.structuredContent as any).proEnabled, false);
  });

  test("centralises unknown tool handling", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({ name: "dvqr_unknown" });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "ToolNotFound");
  });

  test("centralises the Pro capability boundary", async () => {
    const response = await new DvqrMcpLiveToolDispatcher(config).dispatch({
      name: "dvqr_assess_investigation_readiness",
      arguments: {}
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).status, "capability_required");
    assert.strictEqual((response.structuredContent as any).availableIn, "pro");
  });
});
