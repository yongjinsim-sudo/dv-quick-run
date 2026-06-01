import * as assert from "assert";
import { buildInvestigationSessionKey, clearInvestigationSessionState, readInvestigationSessionState, writeInvestigationSessionState } from "../../product/investigationWorkspace/investigationSessionState.js";
import type { ComparisonViewModel } from "../../core/comparison/index.js";

function createMockContext(): { readonly globalState: { get<T>(key: string, defaultValue: T): T; update(key: string, value: unknown): Promise<void> } } {
  const state = new Map<string, unknown>();
  return {
    globalState: {
      get<T>(key: string, defaultValue: T): T {
        return (state.has(key) ? state.get(key) : defaultValue) as T;
      },
      async update(key: string, value: unknown): Promise<void> {
        state.set(key, value);
      }
    }
  };
}

suite("investigationSessionState", () => {
  test("builds stable session keys from comparison scope and snapshot timestamps", () => {
    const key = buildInvestigationSessionKey({
      title: "Cross-Environment Diff",
      summary: {
        sourceLabel: "DEV",
        targetLabel: "SIT",
        sourceCapturedAtIso: "2026-05-31T00:00:00.000Z",
        targetCapturedAtIso: "2026-05-31T01:00:00.000Z",
        subjectLabel: "account"
      }
    } as ComparisonViewModel);

    assert.strictEqual(key, "Cross-Environment Diff|account|DEV|SIT|2026-05-31T00:00:00.000Z|2026-05-31T01:00:00.000Z");
  });

  test("persists review-state metadata without mutating comparison evidence", async () => {
    const context = createMockContext();
    await writeInvestigationSessionState(context as never, "comparison", {
      activeMode: "verification",
      reviewedSurfaces: ["card-1"],
      verifiedItems: ["check-1"],
      verificationStatusByItem: { "check-1": "reviewed" },
      verificationNotesByItem: { "check-1": "Reviewed with owning team." }
    });

    const state = readInvestigationSessionState(context as never, "comparison");

    assert.strictEqual(state.activeMode, "verification");
    assert.deepStrictEqual(state.reviewedSurfaces, ["card-1"]);
    assert.deepStrictEqual(state.verifiedItems, ["check-1"]);
    assert.strictEqual(state.verificationStatusByItem?.["check-1"], "reviewed");
    assert.strictEqual(state.verificationNotesByItem?.["check-1"], "Reviewed with owning team.");
    assert.ok(state.updatedAtIso);
  });

  test("clears persisted investigation state explicitly", async () => {
    const context = createMockContext();
    await writeInvestigationSessionState(context as never, "comparison", { activeMode: "handoff" });

    await clearInvestigationSessionState(context as never, "comparison");

    assert.deepStrictEqual(readInvestigationSessionState(context as never, "comparison"), {});
  });
});
