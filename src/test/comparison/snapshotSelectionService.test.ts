import * as assert from "assert";
import { resolveSnapshotSelection } from "../../product/comparison/index.js";
import type { ComparisonSnapshotRegistryEntry } from "../../product/comparison/index.js";

function entry(snapshotId: string, environmentLabel: string): ComparisonSnapshotRegistryEntry {
  return {
    snapshotId,
    label: `${environmentLabel} snapshot`,
    environmentLabel,
    capturedAtIso: "2026-06-17T00:00:00.000Z",
    sourceFeature: "Operational Profile",
    evidenceTypes: ["OperationalProfile"],
    fileUri: `file:///tmp/${snapshotId}.json`,
    isFavourite: false,
    entityLogicalName: "account",
    entityDisplayName: "Account"
  };
}

suite("snapshotSelectionService", () => {
  test("enables comparison for exactly two snapshots", () => {
    const result = resolveSnapshotSelection([entry("a", "DEV"), entry("b", "SIT")], ["a", "b"]);

    assert.strictEqual(result.canCompare, true);
    assert.strictEqual(result.canBuildTimeline, false);
    assert.strictEqual(result.mode, "compare");
    assert.match(result.message, /Cross-Environment Diff/);
  });

  test("describes same-environment comparison as timeline diff", () => {
    const result = resolveSnapshotSelection([entry("a", "DEV"), entry("b", "DEV")], ["a", "b"]);

    assert.strictEqual(result.canCompare, true);
    assert.match(result.message, /Timeline Diff/);
  });

  test("treats three or more snapshots as timeline-ready placeholder", () => {
    const result = resolveSnapshotSelection([entry("a", "DEV"), entry("b", "DEV"), entry("c", "DEV")], ["a", "b", "c"]);

    assert.strictEqual(result.canCompare, false);
    assert.strictEqual(result.canBuildTimeline, true);
    assert.strictEqual(result.mode, "timelineReady");
  });
});
