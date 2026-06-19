import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustSummary,
} from "../pro/timeline/index.js";
import {
  buildTimelineFindingsSummary,
  buildTimelineFindingsSummaryReport,
} from "../pro/timeline/index.js";

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

const trust: TimelineTrustSummary = {
  state: "Verified",
  verifiedCount: 3,
  modifiedCount: 0,
  legacyOrUnverifiedCount: 0,
  invalidCount: 0,
  totalCount: 3,
  summary: "All selected snapshots are verified.",
};

function interval(id: string, index: number, fromSnapshot: TimelineSnapshotRef, toSnapshot: TimelineSnapshotRef): TimelineInterval {
  return {
    id,
    index,
    fromSnapshot,
    toSnapshot,
    fromCapturedAtIso: fromSnapshot.capturedAtIso,
    toCapturedAtIso: toSnapshot.capturedAtIso,
    label: `${fromSnapshot.capturedAtIso} → ${toSnapshot.capturedAtIso}`,
    providerResults: [],
    providerSummaries: [
      {
        providerId: "identity",
        title: "Identity Participation Diff",
        intervalId: id,
        highCount: 0,
        mediumCount: index === 0 ? 2 : 0,
        lowCount: 0,
        eventCount: index === 0 ? 2 : 0,
        summary: index === 0 ? "2 changes first observed in this interval." : "No changes first observed in this interval.",
        groups: [],
      },
      {
        providerId: "plugin",
        title: "Plugin Step Diff",
        intervalId: id,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        eventCount: 0,
        summary: "No changes first observed in this interval.",
        groups: [],
      },
    ],
    events: [],
  };
}

function event(id: string, interval: TimelineInterval, significance: TimelineEvent["significance"]): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId: "identity",
    providerTitle: "Identity Participation Diff",
    category: "Changed",
    significance,
    title: `${id} title`,
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
    evidenceRefs: [
      { id: `${id}-evidence-1`, source: "ComparisonFinding", label: "Evidence 1" },
      { id: `${id}-evidence-2`, source: "ComparisonFinding", label: "Evidence 2" },
    ],
  };
}

function timeline(): TimelineReconstruction {
  const s1 = snapshot("s1", "2026-05-25T05:27:12.000Z");
  const s2 = snapshot("s2", "2026-06-16T07:23:46.000Z");
  const s3 = snapshot("s3", "2026-06-17T02:41:15.000Z");
  const i1 = interval("interval-1", 0, s1, s2);
  const i2 = interval("interval-2", 1, s2, s3);
  const e1 = event("event-1", i1, "High");
  const e2 = event("event-2", i1, "Medium");
  const intervals = [
    { ...i1, events: [e1, e2] },
    i2,
  ];
  const findingsSummary = buildTimelineFindingsSummary(intervals);

  return {
    id: "timeline-account-dev",
    schemaVersion: "timeline-reconstruction-v1",
    generatedAtIso: "2026-06-18T05:00:00.000Z",
    mode: "OperationalTimeline",
    status: "Ready",
    subject: {
      subjectKey: "entity:account",
      subjectLabel: "Account",
      subjectType: "entity",
      entityLogicalName: "account",
      environmentLabel: "DEV",
    },
    summary: {
      title: "Operational Timeline Reconstruction",
      mode: "OperationalTimeline",
      subject: {
        subjectKey: "entity:account",
        subjectLabel: "Account",
        subjectType: "entity",
        entityLogicalName: "account",
        environmentLabel: "DEV",
      },
      rangeStartCapturedAtIso: s1.capturedAtIso,
      rangeEndCapturedAtIso: s3.capturedAtIso,
      snapshotCount: 3,
      intervalCount: 2,
      eventCount: 2,
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      noChangesObserved: false,
    },
    trust,
    snapshots: [s1, s2, s3],
    intervals,
    topEvents: [e1, e2],
    findingsSummary,
    warnings: [],
  };
}

suite("timelineFindingsSummaryBuilder", () => {
  test("builds a timeline findings summary report model from reconstruction evidence", () => {
    const report = buildTimelineFindingsSummaryReport(timeline(), {
      generatedAt: new Date("2026-06-18T06:00:00.000Z"),
      topEventLimit: 1,
      watermarkFooterText: "Custom footer",
    });

    assert.strictEqual(report.kind, "TimelineFindingsSummary");
    assert.strictEqual(report.title, "Timeline Findings Summary");
    assert.strictEqual(report.generatedAtIso, "2026-06-18T06:00:00.000Z");
    assert.strictEqual(report.scope.subject.subjectLabel, "Account");
    assert.strictEqual(report.scope.environmentLabel, "DEV");
    assert.strictEqual(report.scope.snapshotsAnalysed, 3);
    assert.strictEqual(report.scope.intervalsCompared, 2);
    assert.strictEqual(report.scope.timelineEvents, 2);
    assert.deepStrictEqual(report.significanceSummary, { high: 1, medium: 1, low: 0 });
    assert.strictEqual(report.changedProviders.length, 1);
    assert.strictEqual(report.changedProviders[0].providerTitle, "Identity Participation Diff");
    assert.strictEqual(report.changedProviders[0].eventCount, 2);
    assert.strictEqual(report.changedProviders[0].highCount, 1);
    assert.strictEqual(report.changedProviders[0].mediumCount, 1);
    assert.match(report.changedProviders[0].firstObservedBetweenLabel ?? "", /May/);
    assert.strictEqual(report.unchangedProviders.length, 1);
    assert.strictEqual(report.unchangedProviders[0].providerTitle, "Plugin Step Diff");
    assert.strictEqual(report.topEvents.length, 1);
    assert.strictEqual(report.topEvents[0].id, "event-1");
    assert.strictEqual(report.topEvents[0].evidenceCount, 2);
    assert.match(report.boundary.paragraphs.join(" "), /does not prove the exact time/);
    assert.strictEqual(report.watermark.footerText, "Custom footer");
  });
});
