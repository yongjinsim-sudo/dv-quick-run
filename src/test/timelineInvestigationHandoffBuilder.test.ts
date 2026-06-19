import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustSummary,
  TimelineWarning,
} from "../pro/timeline/index.js";
import {
  buildTimelineFindingsSummary,
  buildTimelineInvestigationHandoffReport,
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
  state: "Partially Verified",
  verifiedCount: 2,
  modifiedCount: 1,
  legacyOrUnverifiedCount: 0,
  invalidCount: 0,
  totalCount: 3,
  summary: "1 of 3 selected snapshots is modified. Timeline reconstruction can continue only as inspect-only evidence.",
};

function interval(
  id: string,
  index: number,
  fromSnapshot: TimelineSnapshotRef,
  toSnapshot: TimelineSnapshotRef,
  identityEventCount: number,
): TimelineInterval {
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
        mediumCount: identityEventCount,
        lowCount: 0,
        eventCount: identityEventCount,
        summary: identityEventCount > 0
          ? `${identityEventCount} changes first observed in this interval.`
          : "No changes first observed in this interval.",
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
  const i1Base = interval("interval-1", 0, s1, s2, 2);
  const i2Base = interval("interval-2", 1, s2, s3, 1);
  const e1 = event("event-1", i1Base, "High");
  const e2 = event("event-2", i1Base, "Medium");
  const e3 = event("event-3", i2Base, "Low");
  const intervalWarning: TimelineWarning = {
    id: "interval-warning-1",
    severity: "Warning",
    title: "Interval warning",
    message: "One provider failed during interval comparison.",
    intervalId: i2Base.id,
  };
  const intervals: TimelineInterval[] = [
    { ...i1Base, events: [e1, e2] },
    { ...i2Base, events: [e3], warnings: [intervalWarning] },
  ];
  const findingsSummary = buildTimelineFindingsSummary(intervals);
  const warnings: TimelineWarning[] = [
    {
      id: "timeline-warning-1",
      severity: "Warning",
      title: "Timeline is inspect-only",
      message: trust.summary,
    },
  ];

  return {
    id: "timeline-account-dev",
    schemaVersion: "timeline-reconstruction-v1",
    generatedAtIso: "2026-06-18T05:00:00.000Z",
    mode: "OperationalTimeline",
    status: "InspectOnly",
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
      eventCount: 3,
      highCount: 1,
      mediumCount: 1,
      lowCount: 1,
      noChangesObserved: false,
    },
    trust,
    snapshots: [s1, s2, s3],
    intervals,
    topEvents: [e1, e2, e3],
    findingsSummary,
    warnings,
  };
}

suite("timelineInvestigationHandoffBuilder", () => {
  test("builds a handoff report model with snapshots, intervals, events, warnings, and boundaries", () => {
    const source = timeline();
    const report = buildTimelineInvestigationHandoffReport(source, {
      generatedAt: new Date("2026-06-18T06:00:00.000Z"),
      topEventLimit: 2,
      watermarkFooterText: "Custom handoff footer",
    });

    assert.strictEqual(report.kind, "TimelineInvestigationHandoff");
    assert.strictEqual(report.title, "Timeline Investigation Handoff");
    assert.strictEqual(report.generatedAtIso, "2026-06-18T06:00:00.000Z");
    assert.strictEqual(report.scope.subject.subjectLabel, "Account");
    assert.strictEqual(report.scope.environmentLabel, "DEV");
    assert.strictEqual(report.scope.snapshotsAnalysed, 3);
    assert.strictEqual(report.scope.intervalsCompared, 2);
    assert.strictEqual(report.scope.timelineEvents, 3);
    assert.deepStrictEqual(report.significanceSummary, { high: 1, medium: 1, low: 1 });
    assert.strictEqual(report.trust.state, "Partially Verified");
    assert.strictEqual(report.warnings.length, 1);
    assert.strictEqual(report.snapshots.length, 3);
    assert.strictEqual(report.changedProviders.length, 1);
    assert.strictEqual(report.unchangedProviders.length, 1);
    assert.strictEqual(report.topEvents.length, 2);
    assert.strictEqual(report.intervals.length, 2);
    assert.strictEqual(report.intervals[0].label, "Interval 1");
    assert.strictEqual(report.intervals[0].eventCount, 2);
    assert.strictEqual(report.intervals[0].events.length, 2);
    assert.strictEqual(report.intervals[0].providerSummaries.length, 2);
    assert.match(report.intervals[0].rangeLabel, /May/);
    assert.strictEqual(report.intervals[1].warnings.length, 1);
    assert.match(report.boundary.paragraphs.join(" "), /first observed between snapshot captures/);
    assert.strictEqual(report.watermark.footerText, "Custom handoff footer");
    assert.strictEqual(report.reconstruction.id, source.id);
  });
});
