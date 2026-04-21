import * as assert from "assert";
import type { EditorQueryTarget } from "../../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import { buildAddSelectPreviewFromColumnTarget } from "../../providers/resultViewerActions/previewAddSelectFromColumn.js";

suite("previewAddSelectFromColumn", () => {
  function buildTarget(text: string): EditorQueryTarget {
    return { text, source: "line" } as EditorQueryTarget;
  }

  test("adds a root column into root $select", () => {
    const preview = buildAddSelectPreviewFromColumnTarget(
      buildTarget("contacts?$select=contactid&$top=10"),
      "fullname"
    );

    assert.strictEqual(preview.selectToken, "fullname");
    assert.deepStrictEqual(preview.relationshipPath, []);
    assert.strictEqual(preview.previewQuery, "contacts?$select=contactid,fullname&$top=10");
    assert.strictEqual(preview.wasAlreadySelected, false);
  });

  test("adds a flattened expanded column into nested $select", () => {
    const preview = buildAddSelectPreviewFromColumnTarget(
      buildTarget("contacts?$expand=parentcustomerid_account($select=accountid)"),
      "parentcustomerid_account.accountnumber"
    );

    assert.strictEqual(preview.selectToken, "accountnumber");
    assert.deepStrictEqual(preview.relationshipPath, ["parentcustomerid_account"]);
    assert.strictEqual(preview.previewQuery, "contacts?$expand=parentcustomerid_account($select=accountid,accountnumber)");
    assert.strictEqual(preview.wasAlreadySelected, false);
  });

  test("reports already selected columns without changing query text", () => {
    const preview = buildAddSelectPreviewFromColumnTarget(
      buildTarget("contacts?$select=contactid,fullname"),
      "fullname"
    );

    assert.strictEqual(preview.previewQuery, "contacts?$select=contactid,fullname");
    assert.strictEqual(preview.wasAlreadySelected, true);
  });
});
