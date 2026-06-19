import * as assert from "assert";
import type {
  ComparisonProviderContext,
  ComparisonViewModel,
} from "../core/comparison/comparisonTypes.js";
import {
  TimelineReconstructionService,
  buildTimelineIntervalPairs,
} from "../pro/timeline/index.js";
import type { TimelineComparisonExecutor, TimelineSnapshotRef } from "../pro/timeline/index.js";

function snapshot(args: Partial<TimelineSnapshotRef> & { snapshotId: string; capturedAtIso: string }): TimelineSnapshotRef {
  return {
    snapshotId: args.snapshotId,
    label: args.label ?? args.snapshotId,
    environmentLabel: args.environmentLabel ?? "DEV",
    environmentUrl: args.environmentUrl,
    subjectLabel: args.subjectLabel ?? "Account",
    subjectType: args.subjectType ?? "entity",
    entityLogicalName: args.entityLogicalName ?? "account",
    capturedAtIso: args.capturedAtIso,
    trustState: args.trustState ?? "Verified",
    fileUri: args.fileUri ?? `file:///tmp/${args.snapshotId}.json`,
    lineageId: args.lineageId,
    workspaceOwned: args.workspaceOwned ?? true,
  };
}

function comparisonViewModel(context: ComparisonProviderContext, differenceCount: number): ComparisonViewModel {
  return {
    title: `Interval comparison: ${context.source.label} → ${context.target.label}`,
    summary: {
      sourceLabel: context.source.label,
      targetLabel: context.target.label,
      sourceCapturedAtIso: context.source.capturedAtIso,
      targetCapturedAtIso: context.target.capturedAtIso,
      highCount: differenceCount > 0 ? 1 : 0,
      mediumCount: differenceCount > 1 ? 1 : 0,
      lowCount: Math.max(0, differenceCount - 2),
      providerCount: 1,
      differenceCount,
      subjectLabel: context.subjectLabel,
      entityLogicalName: context.entityLogicalName,
    },
    groups: differenceCount === 0 ? [] : [{
      id: "metadata-group",
      title: "Metadata drift",
      summary: "Metadata changes first observed in this interval.",
      significance: "High",
      differences: Array.from({ length: differenceCount }, (_, index) => ({
        id: `diff-${index + 1}`,
        title: `Difference ${index + 1}`,
        summary: "A comparison difference.",
        kind: "Changed",
        significance: index === 0 ? "High" : index === 1 ? "Medium" : "Low",
        evidence: [{ label: "Evidence", value: "Sample", source: "both" }],
      })),
    }],
    providerResults: [{
      providerId: "metadata-provider",
      title: "Metadata Provider",
      groups: differenceCount === 0 ? [] : [{
        id: "metadata-group",
        title: "Metadata drift",
        summary: "Metadata changes first observed in this interval.",
        significance: "High",
        differences: Array.from({ length: differenceCount }, (_, index) => ({
          id: `diff-${index + 1}`,
          title: `Difference ${index + 1}`,
          summary: "A comparison difference.",
          kind: "Changed",
          significance: index === 0 ? "High" : index === 1 ? "Medium" : "Low",
          evidence: [{ label: "Evidence", value: "Sample", source: "both" }],
        })),
      }],
    }],
  };
}

class RecordingExecutor implements TimelineComparisonExecutor {
  public readonly contexts: ComparisonProviderContext[] = [];

  public async compare(context: ComparisonProviderContext): Promise<ComparisonViewModel> {
    this.contexts.push(context);
    return comparisonViewModel(context, this.contexts.length);
  }
}

suite("timelineReconstructionService", () => {
  test("builds adjacent interval pairs for ordered snapshots", () => {
    const pairs = buildTimelineIntervalPairs([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(pairs.length, 2);
    assert.strictEqual(pairs[0].fromSnapshot.snapshotId, "s1");
    assert.strictEqual(pairs[0].toSnapshot.snapshotId, "s2");
    assert.strictEqual(pairs[1].fromSnapshot.snapshotId, "s2");
    assert.strictEqual(pairs[1].toSnapshot.snapshotId, "s3");
  });

  test("reconstructs timeline by comparing adjacent snapshot pairs", async () => {
    const executor = new RecordingExecutor();
    const service = new TimelineReconstructionService(executor);

    const timeline = await service.reconstruct([
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
      snapshot({ snapshotId: "s4", capturedAtIso: "2026-06-18T04:00:00.000Z" }),
    ], {
      generatedAtIso: "2026-06-18T05:00:00.000Z",
      topTimelineEventLimit: 3,
    });

    assert.strictEqual(timeline.status, "Ready");
    assert.strictEqual(timeline.snapshots.length, 4);
    assert.deepStrictEqual(timeline.snapshots.map((item) => item.snapshotId), ["s1", "s2", "s3", "s4"]);
    assert.strictEqual(timeline.intervals.length, 3);
    assert.strictEqual(executor.contexts.length, 3);
    assert.deepStrictEqual(executor.contexts.map((context) => context.snapshots), [
      [timeline.snapshots[0], timeline.snapshots[1]],
      [timeline.snapshots[1], timeline.snapshots[2]],
      [timeline.snapshots[2], timeline.snapshots[3]],
    ]);
    assert.strictEqual(timeline.summary.intervalCount, 3);
    assert.strictEqual(timeline.summary.eventCount, 6);
    assert.strictEqual(timeline.intervals.flatMap((interval) => interval.events).length, 6);
    assert.ok(timeline.intervals[0].events[0].summary.includes("First observed between"));
    assert.strictEqual(timeline.summary.noChangesObserved, false);
    assert.strictEqual(timeline.topEvents.length, 3);
    assert.deepStrictEqual(timeline.topEvents.map((event) => event.significance), ["High", "High", "High"]);
    assert.deepStrictEqual(timeline.topEvents.map((event) => event.firstObservedBetween.intervalIndex), [0, 1, 2]);
  });

  test("returns blocked timeline without running comparisons for invalid selection", async () => {
    const executor = new RecordingExecutor();
    const service = new TimelineReconstructionService(executor);

    const timeline = await service.reconstruct([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
    ]);

    assert.strictEqual(timeline.status, "Blocked");
    assert.strictEqual(timeline.intervals.length, 0);
    assert.strictEqual(executor.contexts.length, 0);
    assert.ok(timeline.warnings.some((warning) => warning.id === "timeline-validation-minimum-snapshots"));
  });

  test("keeps successful intervals when another interval comparison fails", async () => {
    const executor: TimelineComparisonExecutor = {
      async compare(context: ComparisonProviderContext): Promise<ComparisonViewModel> {
        if (context.source.capturedAtIso === "2026-06-18T02:00:00.000Z") {
          throw new Error("provider failed");
        }
        return comparisonViewModel(context, 1);
      },
    };
    const service = new TimelineReconstructionService(executor);

    const timeline = await service.reconstruct([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(timeline.status, "Ready");
    assert.strictEqual(timeline.intervals.length, 2);
    assert.strictEqual(timeline.intervals[0].providerResults.length, 1);
    assert.strictEqual(timeline.intervals[0].events.length, 1);
    assert.strictEqual(timeline.intervals[1].providerResults.length, 0);
    assert.strictEqual(timeline.intervals[1].events.length, 0);
    assert.ok(timeline.warnings.some((warning) => warning.id.startsWith("timeline-interval-comparison-failed")));
  });

  test("marks no changes observed when all interval comparisons are empty", async () => {
    const executor: TimelineComparisonExecutor = {
      async compare(context: ComparisonProviderContext): Promise<ComparisonViewModel> {
        return comparisonViewModel(context, 0);
      },
    };
    const service = new TimelineReconstructionService(executor);

    const timeline = await service.reconstruct([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(timeline.summary.eventCount, 0);
    assert.strictEqual(timeline.summary.noChangesObserved, true);
    assert.strictEqual(timeline.topEvents.length, 0);
  });
});
