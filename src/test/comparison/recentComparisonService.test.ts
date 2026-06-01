import * as assert from "assert";
import { getRecentComparisons, getVisibleRecentComparisons, recordRecentComparison, removeRecentComparison } from "../../product/comparison/snapshotLibrary/recentComparisonService.js";
import type { ComparisonSnapshotRegistryEntry } from "../../product/comparison/index.js";

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

suite("recentComparisonService", () => {
  test("records recent comparisons without duplicating the same source target pair", async () => {
    const context = createMockContext();

    await recordRecentComparison(context as never, {
      comparisonId: "first",
      sourceSnapshotId: "source",
      targetSnapshotId: "target",
      sourceLabel: "DEV",
      targetLabel: "SIT",
      sourceEnvironmentLabel: "DEV",
      targetEnvironmentLabel: "SIT",
      subjectLabel: "account",
      generatedAtIso: "2026-05-31T00:00:00.000Z",
      differenceCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0
    });

    await recordRecentComparison(context as never, {
      comparisonId: "second",
      sourceSnapshotId: "source",
      targetSnapshotId: "target",
      sourceLabel: "DEV",
      targetLabel: "SIT",
      sourceEnvironmentLabel: "DEV",
      targetEnvironmentLabel: "SIT",
      subjectLabel: "account",
      generatedAtIso: "2026-05-31T01:00:00.000Z",
      differenceCount: 2,
      highCount: 0,
      mediumCount: 2,
      lowCount: 0
    });

    const recent = getRecentComparisons(context as never);
    assert.strictEqual(recent.length, 1);
    assert.strictEqual(recent[0].comparisonId, "second");
  });

  test("removes recent comparisons by comparison id", async () => {
    const context = createMockContext();
    await recordRecentComparison(context as never, {
      comparisonId: "to-remove",
      sourceSnapshotId: "source-a",
      targetSnapshotId: "target-a",
      sourceLabel: "DEV",
      targetLabel: "SIT",
      sourceEnvironmentLabel: "DEV",
      targetEnvironmentLabel: "SIT",
      subjectLabel: "account",
      generatedAtIso: "2026-05-31T00:00:00.000Z",
      differenceCount: 1,
      highCount: 0,
      mediumCount: 1,
      lowCount: 0
    });

    await removeRecentComparison(context as never, "to-remove");

    assert.strictEqual(getRecentComparisons(context as never).length, 0);
  });

  test("filters recent comparisons to visible snapshot ids in preview mode", () => {
    const visible = getVisibleRecentComparisons([
      {
        comparisonId: "visible",
        sourceSnapshotId: "source-visible",
        targetSnapshotId: "target-visible",
        sourceLabel: "DEV",
        targetLabel: "SIT",
        sourceEnvironmentLabel: "DEV",
        targetEnvironmentLabel: "SIT",
        subjectLabel: "account",
        generatedAtIso: "2026-05-31T00:00:00.000Z",
        differenceCount: 1,
        highCount: 0,
        mediumCount: 1,
        lowCount: 0
      },
      {
        comparisonId: "hidden",
        sourceSnapshotId: "source-hidden",
        targetSnapshotId: "target-hidden",
        sourceLabel: "DEV",
        targetLabel: "SIT",
        sourceEnvironmentLabel: "DEV",
        targetEnvironmentLabel: "SIT",
        subjectLabel: "contact",
        generatedAtIso: "2026-05-31T00:00:00.000Z",
        differenceCount: 1,
        highCount: 0,
        mediumCount: 1,
        lowCount: 0
      }
    ], [
      { snapshotId: "source-visible" },
      { snapshotId: "target-visible" }
    ] as unknown as readonly ComparisonSnapshotRegistryEntry[], true);

    assert.deepStrictEqual(visible.map((entry) => entry.comparisonId), ["visible"]);
  });
});
