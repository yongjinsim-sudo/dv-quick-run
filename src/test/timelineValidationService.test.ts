import * as assert from "assert";
import {
  buildTimelineTrustSummary,
  orderTimelineSnapshots,
  resolveTimelineSubject,
  validateTimelineSnapshotSelection,
} from "../pro/timeline/index.js";
import type { TimelineSnapshotRef } from "../pro/timeline/index.js";

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

suite("timelineValidationService", () => {
  test("validates compatible snapshots and orders by capture timestamp", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
    ]);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.status, "Ready");
    assert.deepStrictEqual(result.snapshots.map((item) => item.snapshotId), ["s1", "s2", "s3"]);
    assert.strictEqual(result.subject?.subjectKey, "entity:account");
  });

  test("blocks fewer than three snapshots", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
    ]);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.status, "Blocked");
    assert.match(result.reason ?? "", /Select 3 or more snapshots/);
  });

  test("blocks mixed subjects", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z", entityLogicalName: "account" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", entityLogicalName: "contact" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z", entityLogicalName: "account" }),
    ]);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.status, "Blocked");
    assert.ok(result.warnings.some((warning) => warning.id === "timeline-validation-mixed-subjects"));
  });

  test("blocks mixed environments by default", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z", environmentLabel: "DEV" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", environmentLabel: "SIT" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z", environmentLabel: "DEV" }),
    ]);

    assert.strictEqual(result.valid, false);
    assert.ok(result.warnings.some((warning) => warning.id === "timeline-validation-mixed-environments"));
  });

  test("uses deterministic snapshot id tie-break for shared timestamps", () => {
    const result = orderTimelineSnapshots([
      snapshot({ snapshotId: "b", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "a", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "c", capturedAtIso: "2026-06-18T02:00:00.000Z" }),
    ]);

    assert.deepStrictEqual(result.snapshots.map((item) => item.snapshotId), ["a", "b", "c"]);
    assert.ok(result.warnings.some((warning) => warning.id.startsWith("timeline-ordering-shared-timestamp")));
  });

  test("marks modified snapshots as inspect-only", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", trustState: "Modified" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(result.valid, true);
    assert.strictEqual(result.status, "InspectOnly");
    assert.ok(result.warnings.some((warning) => warning.id === "timeline-validation-inspect-only-trust"));
  });

  test("blocks invalid snapshots", () => {
    const result = validateTimelineSnapshotSelection([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", trustState: "Invalid" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(result.valid, false);
    assert.strictEqual(result.status, "Blocked");
    assert.ok(result.warnings.some((warning) => warning.id.startsWith("timeline-validation-invalid-snapshot")));
  });

  test("builds trust summary with unverified state for legacy snapshots", () => {
    const trust = buildTimelineTrustSummary([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", trustState: "Legacy / Unverified" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z" }),
    ]);

    assert.strictEqual(trust.state, "Unverified");
    assert.strictEqual(trust.legacyOrUnverifiedCount, 1);
  });

  test("resolves timeline subject case-insensitively", () => {
    const subject = resolveTimelineSubject([
      snapshot({ snapshotId: "s1", capturedAtIso: "2026-06-18T01:00:00.000Z", entityLogicalName: "Account" }),
      snapshot({ snapshotId: "s2", capturedAtIso: "2026-06-18T02:00:00.000Z", entityLogicalName: "account" }),
      snapshot({ snapshotId: "s3", capturedAtIso: "2026-06-18T03:00:00.000Z", entityLogicalName: "ACCOUNT" }),
    ]);

    assert.strictEqual(subject?.subjectKey, "entity:account");
  });
});
