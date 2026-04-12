import * as assert from "assert";
import { buildBatchResultViewerBinderSuggestion, buildResultViewerBinderSuggestion } from "../../product/binder/buildBinderSuggestion.js";

suite("binderSuggestion", () => {
  test("prefers continue traversal when next leg is available", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "contacts?$select=fullname",
      rowCount: 10,
      columnCount: 1,
      traversalContext: {
        traversalSessionId: "trv_123",
        legIndex: 0,
        legCount: 2,
        hasNextLeg: true,
        nextLegLabel: "contact → task",
        nextLegEntityName: "task",
        currentEntityName: "contact",
        isFinalLeg: false
      }
    });

    assert.ok(suggestion);
    assert.strictEqual(suggestion?.actionId, "continueTraversal");
    assert.ok(suggestion?.text.includes("continue this traversal"));
  });

  test("suggests traversal batch on final leg when batch is available", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "tasks?$select=subject",
      rowCount: 34,
      columnCount: 1,
      traversalContext: {
        traversalSessionId: "trv_123",
        legIndex: 1,
        legCount: 2,
        hasNextLeg: false,
        currentEntityName: "task",
        isFinalLeg: true,
        canRunBatch: true
      }
    });

    assert.ok(suggestion);
    assert.strictEqual(suggestion?.actionId, "runTraversalBatch");
  });

  test("suggests add top for broad queries without top", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "contacts?$filter=statecode eq 0",
      rowCount: 40,
      columnCount: 3
    });

    assert.ok(suggestion);
    assert.strictEqual(suggestion?.actionId, "previewAddTop");
  });


  test("does not suggest add top when top already exists", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "contacts?$top=50",
      rowCount: 13,
      columnCount: 12
    });

    assert.ok(!suggestion || suggestion.actionId !== "previewAddTop");
  });

  test("suggests optimized batch for traversal-backed batch results", () => {
    const suggestion = buildBatchResultViewerBinderSuggestion({
      traversalSessionId: "trv_123",
      canRunOptimizedBatch: true
    });

    assert.ok(suggestion);
    assert.strictEqual(suggestion?.actionId, "runTraversalOptimizedBatch");
  });
});
