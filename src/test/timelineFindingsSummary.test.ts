import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineProviderSummary,
  TimelineSnapshotRef,
} from "../pro/timeline/index.js";
import { buildTimelineFindingsSummary } from "../pro/timeline/index.js";

function snapshot(id: string, capturedAtIso: string): TimelineSnapshotRef {
  return {
    snapshotId: id,
    label: id,
    environmentLabel: "DEV",
    subjectLabel: "Account",
    subjectType: "entity",
    entityLogicalName: "account",
    capturedAtIso,
    trustState: "Verified",
  };
}

function providerSummary(intervalId: string, providerId: string, title: string, eventCount: number): TimelineProviderSummary {
  return {
    providerId,
    title,
    intervalId,
    highCount: 0,
    mediumCount: eventCount,
    lowCount: 0,
    eventCount,
    summary: `${eventCount} changes first observed in this interval.`,
    groups: [],
  };
}

function interval(id: string, index: number, from: TimelineSnapshotRef, to: TimelineSnapshotRef, providerSummaries: readonly TimelineProviderSummary[], events: readonly TimelineEvent[] = []): TimelineInterval {
  return {
    id,
    index,
    fromSnapshot: from,
    toSnapshot: to,
    fromCapturedAtIso: from.capturedAtIso,
    toCapturedAtIso: to.capturedAtIso,
    label: `${from.capturedAtIso} → ${to.capturedAtIso}`,
    providerResults: [],
    providerSummaries,
    events,
  };
}

function event(id: string, providerId: string, providerTitle: string, interval: TimelineInterval, significance: TimelineEvent["significance"]): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId,
    providerTitle,
    category: "Changed",
    significance,
    title: `${providerTitle} changed`,
    summary: "First observed between selected evidence snapshots.",
    firstObservedBetween: {
      intervalId: interval.id,
      intervalIndex: interval.index,
      fromSnapshotId: interval.fromSnapshot.snapshotId,
      toSnapshotId: interval.toSnapshot.snapshotId,
      fromCapturedAtIso: interval.fromCapturedAtIso,
      toCapturedAtIso: interval.toCapturedAtIso,
      label: interval.label,
    },
    evidenceRefs: [],
  };
}

suite("timelineFindingsSummary", () => {
  test("builds changed and no-change provider summary bullets with anchors", () => {
    const s1 = snapshot("s1", "2026-06-18T01:00:00.000Z");
    const s2 = snapshot("s2", "2026-06-18T02:00:00.000Z");
    const s3 = snapshot("s3", "2026-06-18T03:00:00.000Z");
    const i1 = interval("interval-1", 0, s1, s2, [
      providerSummary("interval-1", "identity", "Identity Participation Diff", 2),
      providerSummary("interval-1", "plugin", "Plugin Step Diff", 0),
    ]);
    const i2 = interval("interval-2", 1, s2, s3, [
      providerSummary("interval-2", "identity", "Identity Participation Diff", 0),
      providerSummary("interval-2", "plugin", "Plugin Step Diff", 0),
    ]);
    const e1 = event("event-identity-1", "identity", "Identity Participation Diff", i1, "Medium");
    const e2 = event("event-identity-2", "identity", "Identity Participation Diff", i1, "Medium");

    const summary = buildTimelineFindingsSummary([
      { ...i1, events: [e1, e2] },
      i2,
    ]);

    assert.strictEqual(summary.changed.length, 1);
    assert.strictEqual(summary.changed[0].providerId, "identity");
    assert.strictEqual(summary.changed[0].eventCount, 2);
    assert.strictEqual(summary.changed[0].anchorId, "event-identity-1");
    assert.strictEqual(summary.noChange.length, 1);
    assert.strictEqual(summary.noChange[0].providerId, "plugin");
    assert.strictEqual(summary.noChange[0].anchorId, "interval-1");
    assert.match(summary.summary, /2 timeline events first observed across 1 provider/);
  });
});
