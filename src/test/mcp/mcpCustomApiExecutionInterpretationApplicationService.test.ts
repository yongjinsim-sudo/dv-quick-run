import * as assert from "assert";
import { McpCustomApiExecutionEvidenceStore } from "../../mcp/mcpCustomApiExecutionEvidenceStore.js";
import { McpCustomApiExecutionInterpretationApplicationService } from "../../mcp/mcpCustomApiExecutionInterpretationApplicationService.js";

suite("mcpCustomApiExecutionInterpretationApplicationService", () => {
  test("classifies success and analyses returned outputs without execution", () => {
    const store = new McpCustomApiExecutionEvidenceStore(() => Date.parse("2026-08-01T00:00:00.000Z"), () => "dvqr-execution-1");
    store.record({
      uniqueName: "AIReply",
      executed: true,
      response: { PreparedResponse: "Thank you" },
      expectedOutputs: [{ uniqueName: "PreparedResponse", type: "Edm.String" }],
      executionContext: { statusCode: 200, durationMs: 12 },
      transport: "node-fetch"
    });
    const result = new McpCustomApiExecutionInterpretationApplicationService(store).interpret({});
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.classification, "ExecutionSuccessful");
    assert.strictEqual(content.noExecutionPerformed, true);
    assert.strictEqual(content.outputs[0].uniqueName, "PreparedResponse");
    assert.strictEqual(content.outputs[0].type, "Edm.String");
    assert.strictEqual(content.outputs[0].length, 9);
  });

  test("classifies Dataverse input validation failures without guessing accepted values", () => {
    const store = new McpCustomApiExecutionEvidenceStore(undefined, () => "dvqr-execution-2");
    store.record({
      uniqueName: "AITranslate",
      executed: false,
      message: "Culture is not supported. Please enter a valid Target Language value",
      structuredError: { http: { status: 400 }, summary: "Culture is not supported." }
    });
    const result = new McpCustomApiExecutionInterpretationApplicationService(store).interpret({ executionId: "dvqr-execution-2" });
    assert.strictEqual(result.ok, true);
    if (!result.ok) return;
    const content = result.structuredContent as any;
    assert.strictEqual(content.classification, "InputValidationFailure");
    assert.ok(content.recommendations.some((item: string) => /do not assume accepted values/i.test(item)));
    assert.doesNotMatch(JSON.stringify(content), /en-US/);
  });

  test("classifies authentication, authorization, transport and generic Dataverse failures", () => {
    const cases = [
      [401, "AuthenticationFailure"],
      [403, "AuthorizationFailure"],
      [404, "DataverseFailure"],
      [500, "DataverseFailure"]
    ] as const;
    for (const [status, expected] of cases) {
      const store = new McpCustomApiExecutionEvidenceStore();
      store.record({ uniqueName: "Test", executed: false, structuredError: { http: { status } } });
      const result = new McpCustomApiExecutionInterpretationApplicationService(store).interpret({});
      assert.strictEqual(result.ok, true);
      if (result.ok) assert.strictEqual((result.structuredContent as any).classification, expected);
    }
    const transportStore = new McpCustomApiExecutionEvidenceStore();
    transportStore.record({ uniqueName: "Test", executed: false, message: "fetch failed SELF_SIGNED_CERT_IN_CHAIN" });
    const transport = new McpCustomApiExecutionInterpretationApplicationService(transportStore).interpret({});
    assert.strictEqual(transport.ok, true);
    if (transport.ok) assert.strictEqual((transport.structuredContent as any).classification, "TransportFailure");
  });

  test("returns a bounded error when no execution evidence exists", () => {
    const result = new McpCustomApiExecutionInterpretationApplicationService(new McpCustomApiExecutionEvidenceStore()).interpret({});
    assert.strictEqual(result.ok, false);
    if (!result.ok) assert.match(result.message, /no completed custom api execution/i);
  });
  test("renders a professional execution intelligence report", () => {
    const store = new McpCustomApiExecutionEvidenceStore(() => Date.parse("2026-08-01T00:00:00.000Z"), () => "dvqr-execution-report");
    store.record({
      uniqueName: "AIReply",
      executed: true,
      response: { PreparedResponse: "Thank you" },
      expectedOutputs: [{ uniqueName: "PreparedResponse", type: "Edm.String" }],
      executionContext: { statusCode: 200, durationMs: 12 },
      transport: "node-fetch"
    });
    const result = new McpCustomApiExecutionInterpretationApplicationService(store).interpret({});
    if (!result.ok) throw new Error(result.message);
    assert.match(result.displayText ?? "", /Execution Intelligence Report/);
    assert.match(result.displayText ?? "", /HTTP: 200 OK/);
    assert.match(result.displayText ?? "", /Primary transport: Node Fetch/);
    assert.match(result.displayText ?? "", /Length: 9 characters/);
    assert.match(result.displayText ?? "", /No execution was performed while generating this report/);
    assert.strictEqual((result.structuredContent as any).reportTitle, "Execution Intelligence Report");
  });

});
