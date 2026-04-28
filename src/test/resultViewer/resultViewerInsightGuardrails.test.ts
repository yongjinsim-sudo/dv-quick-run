import * as assert from "assert";
import { buildResultViewerInsightSuggestions } from "../../product/binder/buildBinderSuggestion.js";
import { RESULT_VIEWER_SCRIPT_BOOTSTRAP } from "../../webview/resultViewer/scriptBootstrap.js";
import { RESULT_VIEWER_SCRIPT_UTILITIES } from "../../webview/resultViewer/scriptUtilities.js";

suite("resultViewerInsightGuardrails", () => {
  test("builds multiple insights from query shape and result evidence", () => {
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

    assert.ok(suggestions.length >= 3);
    assert.ok(suggestions.some((suggestion) => suggestion.actionId === "previewAddTop"));
    assert.ok(suggestions.some((suggestion) => suggestion.actionId === "previewAddSelect"));
    assert.ok(suggestions.some((suggestion) =>
      suggestion.actionId === "previewODataFilter" &&
      suggestion.payload?.columnName === "statecode" &&
      suggestion.payload?.displayValue === "Active"
    ));
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

  test("webview insight drawer keeps apply on the preview-first Binder path", () => {
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("executeActiveInsightSuggestion"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes('type: "executeBinderSuggestion"'));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("snoozeInsight(suggestion)"));
    assert.ok(RESULT_VIEWER_SCRIPT_UTILITIES.includes("buildInsightNavigationHtml"));
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
