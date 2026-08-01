import * as assert from "node:assert";
import { environmentUrl, stringArg, validateEnvironmentUrl } from "../../mcp/mcpRequestArguments.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://configured.crm6.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: true,
  textMirrorMaxCharacters: 32768
};

suite("mcpRequestArguments", () => {
  test("normalises non-empty string arguments", () => {
    assert.strictEqual(stringArg({ query: "  contacts?$top=5  " }, "query"), "contacts?$top=5");
    assert.strictEqual(stringArg({ query: "   " }, "query"), undefined);
    assert.strictEqual(stringArg({ query: 42 }, "query"), undefined);
  });

  test("prefers and normalises a call-specific environment URL", () => {
    assert.strictEqual(
      environmentUrl({ environmentUrl: "https://override.crm6.dynamics.com///" }, config),
      "https://override.crm6.dynamics.com"
    );
  });

  test("validates configured and missing environment URLs", () => {
    assert.deepStrictEqual(validateEnvironmentUrl({}, config), {
      ok: true,
      environmentUrl: "https://configured.crm6.dynamics.com"
    });

    assert.deepStrictEqual(validateEnvironmentUrl({}, { ...config, environmentUrl: undefined }), {
      ok: false,
      code: "EnvironmentRequired",
      message: "Set DVQR_MCP_ENVIRONMENT_URL or provide environmentUrl for this call."
    });
  });

  test("rejects non-HTTPS environment URLs", () => {
    assert.deepStrictEqual(validateEnvironmentUrl({ environmentUrl: "http://example.test" }, config), {
      ok: false,
      code: "InvalidArguments",
      message: "environmentUrl must use HTTPS."
    });
  });
});
