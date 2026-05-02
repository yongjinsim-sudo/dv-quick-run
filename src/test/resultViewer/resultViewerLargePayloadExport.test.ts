import * as assert from "assert";
import { buildResultViewerInsightSuggestions } from "../../product/binder/buildBinderSuggestion.js";
import { ResultViewerSessionStore } from "../../providers/resultViewerSessionStore.js";
import { RESULT_VIEWER_SCRIPT_BOOTSTRAP } from "../../webview/resultViewer/scriptBootstrap.js";

const largePluginTracePayload = {
  "@odata.context": "https://example.crm.dynamics.com/api/data/v9.2/$metadata#plugintracelogs(configuration)",
  "@odata.nextLink": "https://example.crm.dynamics.com/api/data/v9.2/plugintracelogs?$skiptoken=page2",
  value: [
    { plugintracelogid: "5e152662-8a91-4e87-8c16-000000131819", configuration: null },
    { plugintracelogid: "60ab1b96-1309-4d90-879c-000006dde512", configuration: "[{\"sample_contact_type\":935000000,\"team_name\":\"REDACTED - Patient Team\"}]" },
    {
      plugintracelogid: "8c808d57-e76a-494a-b24d-00001d58853f",
      configuration: JSON.stringify({
        systemusers: Array.from({ length: 120 }, (_, index) => ({
          username: `# svc-user-${index}`,
          userid: `00000000-0000-0000-0000-${String(index).padStart(12, "0")}`
        }))
      })
    }
  ]
};

suite("resultViewerLargePayloadExport", () => {
  test("session-backed JSON preserves large plugin trace payload and nextLink", () => {
    const model = ResultViewerSessionStore.createInitialModel(
      largePluginTracePayload,
      "plugintracelogs?$select=configuration",
      {
        entitySetName: "plugintracelogs",
        entityLogicalName: "plugintracelog",
        primaryIdField: "plugintracelogid"
      }
    );

    const sessionId = model.session?.id;
    assert.ok(sessionId);
    const rawJson = ResultViewerSessionStore.getRawJson(sessionId);

    assert.ok(rawJson?.includes("@odata.nextLink"));
    assert.ok(rawJson?.includes("systemusers"));
    assert.ok(rawJson?.includes("plugintracelogid"));

    ResultViewerSessionStore.dispose(sessionId);
  });

  test("session-backed CSV uses raw rows and preserves large string fields", () => {
    const model = ResultViewerSessionStore.createInitialModel(
      largePluginTracePayload,
      "plugintracelogs?$select=configuration",
      {
        entitySetName: "plugintracelogs",
        entityLogicalName: "plugintracelog",
        primaryIdField: "plugintracelogid"
      }
    );

    const sessionId = model.session?.id;
    assert.ok(sessionId);
    const csv = ResultViewerSessionStore.buildCsv(sessionId);

    assert.ok(csv?.startsWith("plugintracelogid,configuration"));
    assert.ok(csv?.includes("systemusers"));
    assert.ok(csv?.includes("REDACTED - Patient Team"));

    ResultViewerSessionStore.dispose(sessionId);
  });

  test("plugintracelogs query gets an explicit execution insight request seam", () => {
    const suggestions = buildResultViewerInsightSuggestions({
      queryPath: "plugintracelogs?$select=configuration",
      rowCount: 3,
      columnCount: 2,
      result: largePluginTracePayload
    });

    const executionSuggestion = suggestions.find((suggestion) => suggestion.actionId === "requestExecutionInsights");

    assert.ok(executionSuggestion);
    assert.strictEqual(executionSuggestion?.source, "execution");
    assert.strictEqual(executionSuggestion?.tier, "external");
    assert.strictEqual(executionSuggestion?.canApply, true);
  });

  test("webview supports large JSON fallback without blocking Save JSON", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("jsonDataTooLarge"));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("JSON payload is too large to render interactively."));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("sessionJsonState.terminal"));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("return false;"));
  });

  test("webview export actions include session id for session-backed payloads", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("sessionId: model.session && model.session.id ? model.session.id : undefined"));
  });
});
