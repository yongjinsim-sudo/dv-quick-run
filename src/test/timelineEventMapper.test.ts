import * as assert from "assert";
import type { ComparisonProviderResult } from "../core/comparison/comparisonTypes.js";
import {
  buildTimelineEventSummary,
  mapProviderResultsToTimelineEvents,
} from "../pro/timeline/index.js";
import type { TimelineEventMapperIntervalPair, TimelineSnapshotRef } from "../pro/timeline/index.js";

function snapshot(args: Partial<TimelineSnapshotRef> & { snapshotId: string; capturedAtIso: string }): TimelineSnapshotRef {
  return {
    snapshotId: args.snapshotId,
    label: args.label ?? args.snapshotId,
    environmentLabel: args.environmentLabel ?? "DEV",
    subjectLabel: args.subjectLabel ?? "Account",
    subjectType: args.subjectType ?? "entity",
    entityLogicalName: args.entityLogicalName ?? "account",
    capturedAtIso: args.capturedAtIso,
    trustState: args.trustState ?? "Verified",
    fileUri: args.fileUri ?? `file:///tmp/${args.snapshotId}.json`,
    workspaceOwned: args.workspaceOwned ?? true,
  };
}

function pair(): TimelineEventMapperIntervalPair {
  const fromSnapshot = snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" });
  const toSnapshot = snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" });
  return {
    id: "interval-1-s1-to-s2",
    index: 0,
    fromSnapshot,
    toSnapshot,
    ref: {
      intervalId: "interval-1-s1-to-s2",
      intervalIndex: 0,
      fromSnapshotId: "s1",
      toSnapshotId: "s2",
      fromCapturedAtIso: fromSnapshot.capturedAtIso,
      toCapturedAtIso: toSnapshot.capturedAtIso,
      label: "2026-06-18T01:00:00.000Z → 2026-06-18T02:00:00.000Z",
    },
  };
}

function providerResult(): ComparisonProviderResult {
  return {
    providerId: "metadata-provider",
    title: "Metadata Provider",
    groups: [{
      id: "metadata-group",
      title: "Metadata drift",
      summary: "Metadata drift first observed.",
      significance: "High",
      differences: [{
        id: "required-level-change",
        title: "Required level changed",
        summary: "Required level changed from Optional to Required.",
        kind: "Changed",
        significance: "High",
        sourceValue: "Optional",
        targetValue: "Required",
        evidence: [
          { label: "Source", value: "Optional", source: "source" },
          { label: "Target", value: "Required", source: "target" },
        ],
      }],
    }],
  };
}

suite("timelineEventMapper", () => {
  test("maps comparison differences into timeline events", () => {
    const events = mapProviderResultsToTimelineEvents(pair(), [providerResult()], { subjectKey: "entity:account" });

    assert.strictEqual(events.length, 1);
    assert.strictEqual(events[0].subjectKey, "entity:account");
    assert.strictEqual(events[0].providerId, "metadata-provider");
    assert.strictEqual(events[0].category, "Changed");
    assert.strictEqual(events[0].significance, "High");
    assert.strictEqual(events[0].firstObservedBetween.intervalId, "interval-1-s1-to-s2");
    assert.ok(events[0].summary.includes("First observed between"));
    assert.strictEqual(events[0].sourceGroupId, "metadata-group");
    assert.strictEqual(events[0].sourceDifferenceId, "required-level-change");
  });

  test("preserves comparison evidence references", () => {
    const events = mapProviderResultsToTimelineEvents(pair(), [providerResult()], { subjectKey: "entity:account" });

    assert.strictEqual(events[0].evidenceRefs.length, 3);
    assert.ok(events[0].evidenceRefs.some((evidence) => evidence.label === "Required level changed"));
    assert.ok(events[0].evidenceRefs.some((evidence) => evidence.label === "Source" && evidence.value === "Optional"));
    assert.ok(events[0].evidenceRefs.some((evidence) => evidence.label === "Target" && evidence.value === "Required"));
  });

  test("does not duplicate first-observed wording", () => {
    const summary = buildTimelineEventSummary({
      id: "diff-1",
      title: "Already timeline aware",
      summary: "First observed between A and B.",
      kind: "Changed",
      significance: "Medium",
      evidence: [],
    }, "A → B");

    assert.strictEqual(summary, "First observed between A and B.");
  });
});
