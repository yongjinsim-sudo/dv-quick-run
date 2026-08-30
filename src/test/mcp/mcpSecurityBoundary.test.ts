import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { redactMcpOutput } from "../../mcp/mcpOutputRedaction.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

function createDispatcher() {
  let executeCalls = 0;
  const freeAdapter = {
    executeOData: async () => {
      executeCalls += 1;
      return { ok: true, summary: "ok", structuredContent: { value: [{ contactid: "00000000-0000-0000-0000-000000000001" }] } };
    }
  };
  return {
    dispatcher: new DvqrMcpLiveToolDispatcher(config, freeAdapter as any),
    getExecuteCalls: () => executeCalls
  };
}

suite("MCP server security boundary", () => {
  test("rejects fabricated control and entitlement fields before application execution", async () => {
    for (const extra of ["bypassPolicy", "isPro", "skipValidation", "force", "entitlement", "license"]) {
      const { dispatcher, getExecuteCalls } = createDispatcher();
      const response = await dispatcher.dispatch({
        name: "dvqr_execute_odata",
        arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1, [extra]: true }
      });
      assert.strictEqual(response.isError, true, extra);
      assert.strictEqual((response.structuredContent as any).code, "InvalidArguments", extra);
      assert.ok((response.structuredContent as any).issues.some((issue: string) => issue.includes(extra)), extra);
      assert.strictEqual(getExecuteCalls(), 0, extra);
      assert.match(response.content[0].text, /could not run this request because one or more MCP arguments are invalid/i);
      assert.doesNotMatch(response.content[0].text, /attack|malicious|prompt injection/i);
    }
  });

  test("fake entitlement arguments cannot bypass the server-side Pro capability boundary", async () => {
    const dispatcher = new DvqrMcpLiveToolDispatcher(config);
    const response = await dispatcher.dispatch({
      name: "dvqr_assess_investigation_readiness",
      arguments: { investigationId: "inv-test", entitlement: "pro", license: "pro" }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).status, "capability_required");
    assert.strictEqual((response.structuredContent as any).availableIn, "pro");
  });

  test("rejects oversized execution bounds before application execution", async () => {
    const { dispatcher, getExecuteCalls } = createDispatcher();
    const response = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$select=contactid", maxRecords: 100000 }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "InvalidArguments");
    assert.ok((response.structuredContent as any).issues.some((issue: string) => /500/.test(issue)));
    assert.strictEqual(getExecuteCalls(), 0);
  });

  test("rejects insecure credential-bearing and non-Dataverse environment URLs before execution", async () => {
    const invalidUrls = [
      "http://example.crm.dynamics.com",
      "https://user:password@example.crm.dynamics.com",
      "https://example.com"
    ];
    for (const environmentUrl of invalidUrls) {
      const { dispatcher, getExecuteCalls } = createDispatcher();
      const response = await dispatcher.dispatch({
        name: "dvqr_execute_odata",
        arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1, environmentUrl }
      });
      assert.strictEqual(response.isError, true, environmentUrl);
      assert.strictEqual((response.structuredContent as any).code, "InvalidArguments", environmentUrl);
      assert.strictEqual(getExecuteCalls(), 0, environmentUrl);
    }
  });

  test("accepts the configured Dataverse environment and rejects a different supported environment before execution", async () => {
    const matching = createDispatcher();
    const allowed = await matching.dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1, environmentUrl: "https://example.crm.dynamics.com/" }
    });
    assert.strictEqual(allowed.isError, undefined);
    assert.strictEqual(matching.getExecuteCalls(), 1);

    for (const environmentUrl of [
      "https://org.crm6.dynamics.com",
      "https://org.crm.dynamics.cn",
      "https://org.crm.microsoftdynamics.us",
      "https://org.crm.microsoftdynamics.de",
      "https://org.crm.appsplatform.us"
    ]) {
      const { dispatcher, getExecuteCalls } = createDispatcher();
      const response = await dispatcher.dispatch({
        name: "dvqr_execute_odata",
        arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1, environmentUrl }
      });
      assert.strictEqual(response.isError, true, environmentUrl);
      assert.strictEqual((response.structuredContent as any).code, "EnvironmentAuthorityMismatch", environmentUrl);
      assert.strictEqual(getExecuteCalls(), 0, environmentUrl);
    }
  });

  test("rejects malformed record identifiers without invoking application execution", async () => {
    let called = false;
    const freeAdapter = {
      testBusinessPath: async () => { called = true; return { ok: true, structuredContent: {} }; }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(config, freeAdapter as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_test_business_path",
      arguments: { pathId: "bp_2f4d19cc", sourceRecordId: "12345" }
    });
    assert.strictEqual(response.isError, true);
    assert.match(response.content[0].text, /not a canonical Dataverse GUID/i);
    assert.strictEqual(called, false);
  });

  test("rejects unsafe Business Path identifiers before repository access", async () => {
    let called = false;
    const freeAdapter = {
      getBusinessPath: async () => { called = true; return { ok: true, structuredContent: {} }; }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(config, freeAdapter as any);
    for (const pathId of ["../../outside-dvqr/test", "C:\\Users\\Public\\bp_test.json", "bp_nothex!!"]) {
      const response = await dispatcher.dispatch({ name: "dvqr_get_business_path", arguments: { pathId } });
      assert.strictEqual(response.isError, true, pathId);
      assert.strictEqual((response.structuredContent as any).code, "InvalidArguments", pathId);
      assert.strictEqual(called, false, pathId);
    }
  });

  test("redacts secrets on the actual dispatcher response boundary", async () => {
    const freeAdapter = {
      executeOData: async () => ({
        ok: true,
        summary: "Authorization: Bearer abc123 ClientSecret=hidden",
        structuredContent: {
          authorization: "Bearer rawtoken",
          message: "ApiKey=topsecret SharedAccessKey:queue-secret",
          safe: "contact"
        }
      })
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(config, freeAdapter as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1 }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual((response.structuredContent as any).authorization, "[REDACTED]");
    assert.strictEqual((response.structuredContent as any).safe, "contact");
    assert.doesNotMatch((response.structuredContent as any).message, /topsecret|queue-secret/);
    assert.doesNotMatch(response.content[0].text, /abc123|hidden/);
  });

  test("redacts secret-like keys and inline secret assignments from model-facing output", () => {
    const redacted = redactMcpOutput({
      authorization: "Bearer abc.def.ghi",
      nested: {
        message: "Authorization: Bearer abc123 ClientSecret=shh ApiKey:topsecret SharedAccessKey=xyz",
        access_token: "token-value",
        safe: "contact"
      }
    }) as any;
    assert.strictEqual(redacted.authorization, "[REDACTED]");
    assert.strictEqual(redacted.nested.access_token, "[REDACTED]");
    assert.strictEqual(redacted.nested.safe, "contact");
    assert.doesNotMatch(redacted.nested.message, /abc123|shh|topsecret|xyz/);
    assert.match(redacted.nested.message, /\[REDACTED\]/);
  });

  test("a rejected request does not poison a later valid bounded call", async () => {
    const { dispatcher, getExecuteCalls } = createDispatcher();
    const rejected = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$select=contactid", maxRecords: 100000 }
    });
    assert.strictEqual(rejected.isError, true);
    assert.strictEqual(getExecuteCalls(), 0);

    const valid = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: { query: "contacts?$select=contactid,fullname&$top=5", maxRecords: 5 }
    });
    assert.strictEqual(valid.isError, undefined);
    assert.strictEqual(getExecuteCalls(), 1);
  });
});
