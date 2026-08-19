import * as assert from "assert";
import { RESULT_VIEWER_SCRIPT_UTILITIES } from "../../webview/resultViewer/scriptUtilities.js";
import { RESULT_VIEWER_SCRIPT_BOOTSTRAP } from "../../webview/resultViewer/scriptBootstrap.js";
import { RESULT_VIEWER_SCRIPT_RENDERERS } from "../../webview/resultViewer/scriptRenderers.js";
import { buildResultViewerModel } from "../../services/resultViewModelBuilder.js";

suite("Result Viewer Guided Traversal branch continuity", () => {
  test("offers bounded frontier continuation separately from row-only branch selection", () => {
    assert.match(RESULT_VIEWER_SCRIPT_UTILITIES, /data-traversal-action='continue'/);
    assert.match(RESULT_VIEWER_SCRIPT_UTILITIES, /Continue keeps the landed rows in scope/i);
    assert.match(RESULT_VIEWER_SCRIPT_BOOTSTRAP, /type: "continueTraversal"/);
  });


  test("propagates hasNextLeg into the rendered traversal status model", () => {
    const model = buildResultViewerModel(
      { value: [{ careplanid: "cp-1" }, { careplanid: "cp-2" }] },
      "careplans?$select=careplanid",
      {
        primaryIdField: "careplanid",
        traversalContext: {
          traversalSessionId: "trv_frontier",
          legIndex: 0,
          legCount: 3,
          hasNextLeg: true,
          nextLegEntityName: "careplanactivity",
          currentEntityName: "careplan",
          requiredCarryField: "careplanid",
          isFinalLeg: false,
          canChangeRoute: true
        }
      }
    );

    assert.strictEqual(model.traversal?.hasNextLeg, true);
    assert.strictEqual(model.traversal?.nextLegEntityName, "careplanactivity");
    assert.strictEqual(model.traversal?.requiredCarryField, "careplanid");
  });

  test("describes empty results as branch or bounded-continuation evidence rather than whole-path failure", () => {
    assert.match(RESULT_VIEWER_SCRIPT_RENDERERS, /selected branch or bounded continuation did not return rows/i);
    assert.match(RESULT_VIEWER_SCRIPT_RENDERERS, /then Continue to keep its landed rows in scope/i);
  });
});
