import * as assert from "assert";
import { formatDvqrMcpToolResponse } from "../../mcp/mcpToolResponseFormatter.js";

suite("mcpToolResponseFormatter", () => {
  test("keeps the human summary and structured content together", () => {
    const response = formatDvqrMcpToolResponse(
      "Completed.",
      { ok: true, value: 42 },
      { enabled: false, maxCharacters: 32768 }
    );

    assert.deepStrictEqual(response.content, [{ type: "text", text: "Completed." }]);
    assert.deepStrictEqual(response.structuredContent, { ok: true, value: 42 });
    assert.strictEqual(response.isError, undefined);
  });

  test("marks only explicit error responses as MCP errors", () => {
    const response = formatDvqrMcpToolResponse(
      "Failed.",
      { code: "ExecutionFailed" },
      { enabled: false, maxCharacters: 32768 },
      true
    );

    assert.strictEqual(response.isError, true);
  });
});
