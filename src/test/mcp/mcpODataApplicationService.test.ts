import * as assert from "node:assert";
import { DvqrMcpFreeApplicationAdapter } from "../../mcp/mcpFreeApplicationAdapter.js";
import { McpODataApplicationService } from "../../mcp/mcpODataApplicationService.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: true,
  textMirrorMaxCharacters: 32768
};

suite("mcpODataApplicationService", () => {
  test("preserves the public adapter explanation contract", () => {
    const service = new McpODataApplicationService(config);
    const adapter = new DvqrMcpFreeApplicationAdapter(config);
    const args = { query: "contacts?$select=fullname&$top=5" };

    assert.deepStrictEqual(adapter.explainOData(args), service.explain(args));
  });

  test("returns the established validation failure when query is missing", () => {
    const service = new McpODataApplicationService(config);
    assert.deepStrictEqual(service.explain({}), {
      ok: false,
      code: "InvalidArguments",
      message: "query is required."
    });
  });
});
