import * as assert from "assert";
import {
  buildFetchXmlSliceCondition,
  buildFetchXmlSlicePreviewFromTarget,
  buildODataSliceClause,
  buildODataSlicePreviewFromTarget,
  getSupportedSliceDefinitions
} from "../../providers/resultViewerActions/previewResultViewerSlice.js";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

function buildTarget(text: string): EditorQueryTarget {
  return { text, source: "line", range: {} as never, editor: {} as never };
}

suite("previewResultViewerSlice", () => {
  test("builds OData null slice clause", () => {
    assert.strictEqual(buildODataSliceClause("fullname", "Alice", "isNull"), "fullname eq null");
  });

  test("builds OData before-current slice preview", () => {
    const preview = buildODataSlicePreviewFromTarget(buildTarget("contacts?$select=createdon&$top=5"), "createdon", "2026-04-22", "beforeCurrent");
    assert.strictEqual(preview.previewQuery, "contacts?$select=createdon&$top=5&$filter=createdon lt '2026-04-22'");
  });

  test("builds FetchXML not-null slice condition", () => {
    assert.strictEqual(buildFetchXmlSliceCondition("fullname", "Alice", "isNotNull"), '<condition attribute="fullname" operator="not-null" />');
  });

  test("builds FetchXML after-current slice preview", () => {
    const preview = buildFetchXmlSlicePreviewFromTarget(buildTarget('<fetch><entity name="contact"></entity></fetch>'), "createdon", "2026-04-22", "afterCurrent");
    assert.ok(preview.previewQuery.includes('operator="after" value="2026-04-22"'));
  });

  test("returns boolean slice definitions", () => {
    assert.deepStrictEqual(getSupportedSliceDefinitions("Boolean", "true").map((definition) => definition.operation), ["isTrue", "isFalse", "isNotNull"]);
  });

  test("returns date slice definitions", () => {
    assert.deepStrictEqual(getSupportedSliceDefinitions("DateTime", "2026-04-22").map((definition) => definition.operation), ["equalsCurrent", "isNull", "isNotNull", "beforeCurrent", "afterCurrent"]);
  });
});
