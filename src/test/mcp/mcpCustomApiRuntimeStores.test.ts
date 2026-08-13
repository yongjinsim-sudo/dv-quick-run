import * as assert from "assert";
import type { McpCustomApiExecutionPreviewContract } from "../../mcp/mcpCustomApiExecutionPreviewApplicationService.js";
import { McpCustomApiExecutionEvidenceStore } from "../../mcp/mcpCustomApiExecutionEvidenceStore.js";
import { McpCustomApiExecutionPreviewSessionStore } from "../../mcp/mcpCustomApiExecutionPreviewSessionStore.js";

function plan(uniqueName: string): McpCustomApiExecutionPreviewContract {
  return {
    contractVersion: "dvqr-mcp-custom-api-execution-preview-v1",
    environmentUrl: "https://example.crm.dynamics.com",
    uniqueName,
    found: true,
    operationKind: "Action",
    bindingKind: "Global",
    sideEffectPosture: "generate-only",
    readiness: "ready",
    issues: [],
    warnings: [],
    preview: {
      method: "POST",
      route: `/api/data/v9.2/${uniqueName}`,
      body: {},
      expectedOutputs: []
    },
    executionPlanFingerprint: `fingerprint-${uniqueName}`,
    evidenceBoundary: "test",
    noExecutionPerformed: true
  };
}

suite("mcpCustomApiRuntimeStores", () => {
  test("preview sessions retain terminal replay diagnostics briefly, then prune", () => {
    let now = 0;
    let sequence = 0;
    const store = new McpCustomApiExecutionPreviewSessionStore(100, () => now, () => `p-${++sequence}`, {
      terminalRetentionMs: 200,
      maxEntries: 10
    });
    const created = store.create(plan("AIReply"));
    assert.strictEqual(store.consume(created.previewId).ok, true);
    assert.strictEqual(store.consume(created.previewId).ok, false);
    now = 301;
    assert.strictEqual(store.get(created.previewId), undefined);
  });

  test("preview sessions are defensively cloned and bounded", () => {
    let sequence = 0;
    const store = new McpCustomApiExecutionPreviewSessionStore(1000, () => 0, () => `p-${++sequence}`, { maxEntries: 2 });
    const first = store.create(plan("One"));
    (first.plan as any).uniqueName = "mutated";
    assert.strictEqual(store.get(first.previewId)?.plan.uniqueName, "One");
    store.create(plan("Two"));
    store.create(plan("Three"));
    assert.strictEqual(store.size, 2);
  });

  test("execution evidence is bounded, cloned and scope-aware", () => {
    let now = 0;
    let sequence = 0;
    const store = new McpCustomApiExecutionEvidenceStore(() => now, () => `e-${++sequence}`, { maxEntries: 2, retentionMs: 1000 });
    const first = store.record({ uniqueName: "One", environmentUrl: "https://A.example/", executed: true, response: { value: 1 } });
    (first.response as any).value = 99;
    now = 1;
    store.record({ uniqueName: "Two", environmentUrl: "https://b.example", executed: true });
    now = 2;
    store.record({ uniqueName: "Three", environmentUrl: "https://a.example", executed: true });
    assert.strictEqual(store.get("e-1"), undefined);
    assert.strictEqual(store.getLatest({ environmentUrl: "https://A.example/" })?.uniqueName, "Three");
    assert.strictEqual(store.getLatest({ uniqueName: "Two" })?.environmentUrl, "https://b.example");
  });

  test("execution evidence expires after configured retention", () => {
    let now = 0;
    const store = new McpCustomApiExecutionEvidenceStore(() => now, () => "e-1", { retentionMs: 100 });
    store.record({ uniqueName: "One", executed: true });
    now = 101;
    assert.strictEqual(store.get("e-1"), undefined);
  });
});
