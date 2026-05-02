import * as assert from "assert";
import { buildManualResultViewerInsightSuggestions, buildResultViewerInsightSuggestions, sampleResultForInsights } from "../../product/binder/buildBinderSuggestion.js";
import { RESULT_VIEWER_SCRIPT_BOOTSTRAP } from "../../webview/resultViewer/scriptBootstrap.js";
import { RESULT_VIEWER_SCRIPT_UTILITIES } from "../../webview/resultViewer/scriptUtilities.js";

suite("resultViewerInsightGuardrails", () => {
  test("defers result-driven insights when query has no select", () => {
    const suggestions = buildResultViewerInsightSuggestions({
      queryPath: "contacts",
      rowCount: 12,
      columnCount: 12,
      result: {
        value: [
          ...Array.from({ length: 10 }, (_, index) => ({
            contactid: `00000000-0000-0000-0000-0000000000${String(index).padStart(2, "0")}`,
            statecode: 0,
            "statecode@OData.Community.Display.V1.FormattedValue": "Active",
            fullname: `Active ${index}`
          })),
          {
            contactid: "00000000-0000-0000-0000-000000000010",
            statecode: 1,
            "statecode@OData.Community.Display.V1.FormattedValue": "Inactive",
            fullname: "Inactive 1"
          },
          {
            contactid: "00000000-0000-0000-0000-000000000011",
            statecode: 1,
            "statecode@OData.Community.Display.V1.FormattedValue": "Inactive",
            fullname: "Inactive 2"
          }
        ]
      },
      fields: [
        { logicalName: "statecode", displayName: "Status", attributeType: "State" } as never,
        { logicalName: "fullname", displayName: "Full Name", attributeType: "String" } as never
      ]
    });

    assert.ok(suggestions.some((suggestion) => suggestion.actionId === "previewAddTop"));
    assert.ok(suggestions.some((suggestion) => suggestion.actionId === "previewAddSelect"));
    assert.ok(suggestions.some((suggestion) => suggestion.actionId === "requestResultInsights"));
    assert.ok(!suggestions.some((suggestion) => suggestion.actionId === "previewODataFilter"));
  });

  test("manual insight request builds sampled result-driven insights", () => {
    const suggestions = buildManualResultViewerInsightSuggestions({
      queryPath: "contacts?$top=50",
      result: {
        value: [
          ...Array.from({ length: 18 }, (_, index) => ({
            contactid: `00000000-0000-0000-0000-0000000000${String(index).padStart(2, "0")}`,
            statecode: 0,
            "statecode@OData.Community.Display.V1.FormattedValue": "Active",
            fullname: `Active ${index}`
          })),
          {
            contactid: "00000000-0000-0000-0000-000000000018",
            statecode: 1,
            "statecode@OData.Community.Display.V1.FormattedValue": "Inactive",
            fullname: "Inactive 1"
          },
          {
            contactid: "00000000-0000-0000-0000-000000000019",
            statecode: 1,
            "statecode@OData.Community.Display.V1.FormattedValue": "Inactive",
            fullname: "Inactive 2"
          }
        ]
      },
      fields: [
        { logicalName: "statecode", displayName: "Status", attributeType: "State" } as never
      ]
    });

    const statusSuggestion = suggestions.find((suggestion) =>
      suggestion.actionId === "previewODataFilter" &&
      suggestion.payload?.columnName === "statecode" &&
      suggestion.payload?.displayValue === "Active"
    );

    assert.ok(statusSuggestion);
    assert.ok(statusSuggestion.reason.includes("Observed in 20 returned rows"));
    assert.strictEqual(statusSuggestion.payload?.insightBasis, "sampledCurrentResult");
    assert.strictEqual(statusSuggestion.payload?.sampleRowCount, 20);
  });

  test("insight sampling preserves formatted values and caps wide rows", () => {
    const sampled = sampleResultForInsights({
      value: [
        Object.fromEntries([
          ["statecode", 0],
          ["statecode@OData.Community.Display.V1.FormattedValue", "Active"],
          ...Array.from({ length: 80 }, (_, index) => [`field${index}`, index])
        ])
      ]
    });

    const sampledRow = (sampled.result as { value: Record<string, unknown>[] }).value[0];
    assert.strictEqual(sampled.metadata.sampledRowCount, 1);
    assert.strictEqual(sampled.metadata.columnLimited, true);
    assert.strictEqual(sampledRow?.statecode, 0);
    assert.strictEqual(sampledRow?.["statecode@OData.Community.Display.V1.FormattedValue"], "Active");
    assert.ok(Object.keys(sampledRow ?? {}).length <= 41);
  });

  test("does not produce add-top insight when query already has top", () => {
    const suggestions = buildResultViewerInsightSuggestions({
      queryPath: "contacts?$top=50",
      rowCount: 12,
      columnCount: 12,
      result: { value: [] }
    });

    assert.ok(!suggestions.some((suggestion) => suggestion.actionId === "previewAddTop"));
  });

  test("manual insights never crash on large wide input", () => {
    const wideRows = Array.from({ length: 500 }, (_, rowIndex) =>
      Object.fromEntries([
        ["contactid", "00000000-0000-0000-0000-" + String(rowIndex).padStart(12, "0")],
        ["statecode", 0],
        ["statecode@OData.Community.Display.V1.FormattedValue", "Active"],
        ...Array.from({ length: 200 }, (_, columnIndex) => ["field" + columnIndex, "value-" + rowIndex + "-" + columnIndex])
      ])
    );

    const suggestions = buildManualResultViewerInsightSuggestions({
      queryPath: "contacts?$top=500",
      result: { value: wideRows },
      fields: [
        { logicalName: "statecode", displayName: "Status", attributeType: "State" } as never
      ]
    });

    assert.ok(Array.isArray(suggestions));
    assert.ok(suggestions.every((suggestion) => suggestion.tier !== "external"));
  });

  test("webview insight drawer keeps apply on the preview-first Binder path", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("executeActiveInsightSuggestion"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes('type: "executeBinderSuggestion"'));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("snoozeInsight(suggestion)"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("buildInsightNavigationHtml"));
  });

  test("webview execution insights preserve raw trace details behind an explicit viewer", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("buildRawTraceDetailsHtml"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("View raw trace details"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("data-copy-insight-raw-trace"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("copyActiveInsightRawTrace"));
  });

  test("webview suppresses default context menu outside editable fields", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes('document.addEventListener("contextmenu"'));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("HTMLInputElement"));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("HTMLTextAreaElement"));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes('target.closest(".page")'));
    assert.ok(RESULT_VIEWER_SCRIPT_BOOTSTRAP.includes("event.preventDefault()"));
  });

  test("traversal-backed batch labels must not hardcode schema-specific contact fields", () => {
    assert.ok(!RESULT_VIEWER_SCRIPT_UTILITIES.includes("Tighten with chosen contactid"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("Tighten selected-path replay"));
  });
});
