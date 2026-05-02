import * as assert from "assert";
import { buildBatchResultViewerBinderSuggestion, buildResultViewerBinderSuggestion, buildResultViewerInsightSuggestions } from "../../product/binder/buildBinderSuggestion.js";

suite("binderSuggestion", () => {
  test("prefers continue traversal when next leg is available", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "contacts?$select=fullname",
      rowCount: 10,
      columnCount: 1,
      traversalContext: {
        traversalSessionId: "trv_123",
        isBestMatchRoute: true,
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
        isBestMatchRoute: true,
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

  test("falls back to non-traversal binder suggestions for non-best-match routes", () => {
    const suggestion = buildResultViewerBinderSuggestion({
      queryPath: "tasks?$select=subject",
      rowCount: 34,
      columnCount: 1,
      traversalContext: {
        traversalSessionId: "trv_123",
        isBestMatchRoute: false,
        legIndex: 1,
        legCount: 2,
        hasNextLeg: false,
        currentEntityName: "task",
        isFinalLeg: true,
        canRunBatch: true
      }
    });

    assert.ok(suggestion);
    assert.notStrictEqual(suggestion?.actionId, "continueTraversal");
    assert.notStrictEqual(suggestion?.actionId, "runTraversalBatch");
    assert.strictEqual(suggestion?.actionId, "previewAddTop");
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

  test("surfaces execution insights for captured Dataverse request metadata", () => {
    const suggestions = buildResultViewerInsightSuggestions({
      queryPath: "contacts?$top=10",
      rowCount: 10,
      columnCount: 3,
      result: { value: [] },
      executionContext: {
        method: "GET",
        path: "/contacts?$top=10",
        url: "https://example.crm.dynamics.com/api/data/v9.2/contacts?$top=10",
        statusCode: 200,
        durationMs: 123,
        timestamp: "2026-05-01T00:00:00.000Z",
        correlationId: "22222222-2222-2222-2222-222222222222"
      }
    });

    const executionSuggestion = suggestions.find((suggestion) => suggestion.actionId === "requestExecutionInsights");
    assert.ok(executionSuggestion);
    assert.strictEqual(executionSuggestion?.source, "execution");
    assert.strictEqual(executionSuggestion?.payload?.basis, "capturedExecutionContext");
    assert.strictEqual(executionSuggestion?.payload?.correlationId, "22222222-2222-2222-2222-222222222222");
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
