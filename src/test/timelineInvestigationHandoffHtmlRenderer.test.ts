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
  renderTimelineInvestigationHandoffReportHtml,
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

suite("timelineInvestigationHandoffHtmlRenderer", () => {
  test("renders standalone timeline investigation handoff HTML", () => {
    const report = buildTimelineInvestigationHandoffReport(timeline(), {
      generatedAt: new Date("2026-06-18T06:00:00.000Z"),
      watermarkFooterText: "Timeline handoff footer",
    });
    const html = renderTimelineInvestigationHandoffReportHtml(report);

    assert.match(html, /^<!doctype html>/);
    assert.match(html, /Timeline Investigation Handoff/);
    assert.match(html, /Operational Timeline Reconstruction/);
    assert.match(html, /Snapshot evidence set/);
    assert.match(html, /Timeline Findings Summary/);
    assert.match(html, /Top Timeline Events/);
    assert.match(html, /Full Operational Timeline/);
    assert.match(html, /Timeline visual summary/);
    assert.match(html, /Interval timeline/);
    assert.match(html, /Snapshot-bounded intervals/);
    assert.match(html, /Events by interval/);
    assert.match(html, /Timeline interval index/);
    assert.match(html, /dvqr-timeline-report-watermark::after/);
    assert.match(html, /Interval 1/);
    assert.match(html, /Interval 2/);
    assert.match(html, /Identity Participation Diff changed/);
    assert.match(html, /No changes observed/);
    assert.match(html, /Timeline is inspect-only/);
    assert.match(html, /Interval warning/);
    assert.match(html, /First observed between/);
    assert.match(html, /does not prove the exact time/);
    assert.match(html, /Timeline handoff footer/);
    assert.doesNotMatch(html, /Timeline Diff/);
    assert.doesNotMatch(html, /Changed at/);
  });

  test("escapes handoff report HTML content", () => {
    const base = timeline();
    const report = buildTimelineInvestigationHandoffReport({
      ...base,
      subject: {
        ...base.subject,
        subjectLabel: "<Account>",
      },
      summary: {
        ...base.summary,
        subject: {
          ...base.summary.subject,
          subjectLabel: "<Account>",
        },
      },
      snapshots: base.snapshots.map((item) => ({ ...item, subjectLabel: "<Account>" })),
    });
    const html = renderTimelineInvestigationHandoffReportHtml(report);

    assert.match(html, /&lt;Account&gt;/);
    assert.doesNotMatch(html, /<Account>/);
  });
});
