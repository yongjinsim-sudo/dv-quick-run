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
  renderTimelineFindingsSummaryReportHtml,
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
        highCount: 1,
        mediumCount: 0,
        lowCount: 0,
        eventCount: 1,
        summary: "1 change first observed in this interval.",
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

function event(id: string, interval: TimelineInterval): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId: "identity",
    providerTitle: "Identity Participation Diff",
    category: "Changed",
    significance: "High",
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
    evidenceRefs: [{ id: `${id}-evidence`, source: "ComparisonFinding", label: "Evidence" }],
  };
}

function timeline(): TimelineReconstruction {
  const s1 = snapshot("s1", "2026-05-25T05:27:12.000Z");
  const s2 = snapshot("s2", "2026-06-16T07:23:46.000Z");
  const s3 = snapshot("s3", "2026-06-17T02:41:15.000Z");
  const i1 = interval("interval-1", 0, s1, s2);
  const i2 = { ...interval("interval-2", 1, s2, s3), providerSummaries: interval("interval-2", 1, s2, s3).providerSummaries.map((item) => item.providerId === "identity" ? { ...item, highCount: 0, eventCount: 0, summary: "No changes first observed in this interval." } : item) };
  const e1 = event("event-1", i1);
  const intervals = [
    { ...i1, events: [e1] },
    i2,
  ];

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
      eventCount: 1,
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      noChangesObserved: false,
    },
    trust,
    snapshots: [s1, s2, s3],
    intervals,
    topEvents: [e1],
    findingsSummary: buildTimelineFindingsSummary(intervals),
    warnings: [],
  };
}

suite("timelineFindingsSummaryHtmlRenderer", () => {
  test("renders standalone timeline findings summary HTML", () => {
    const report = buildTimelineFindingsSummaryReport(timeline(), {
      generatedAt: new Date("2026-06-18T06:00:00.000Z"),
      watermarkFooterText: "Timeline footer",
    });
    const html = renderTimelineFindingsSummaryReportHtml(report);

    assert.match(html, /^<!doctype html>/);
    assert.match(html, /Timeline Findings Summary/);
    assert.match(html, /Operational Timeline Reconstruction/);
    assert.match(html, /Timeline visual summary/);
    assert.match(html, /Interval timeline/);
    assert.match(html, /Snapshot-bounded intervals/);
    assert.match(html, /Findings by provider/);
    assert.match(html, /Operational significance mix/);
    assert.match(html, /dvqr-timeline-report-watermark::after/);
    assert.match(html, /Snapshots analysed/);
    assert.match(html, /Intervals compared/);
    assert.match(html, /Timeline trust/);
    assert.match(html, /Identity Participation Diff changed/);
    assert.match(html, /No changes observed/);
    assert.match(html, /Top Timeline Events/);
    assert.match(html, /First observed between/);
    assert.match(html, /does not prove the exact time/);
    assert.match(html, /Timeline footer/);
    assert.doesNotMatch(html, /Timeline Diff/);
    assert.doesNotMatch(html, /Changed at/);
  });

  test("escapes report HTML content", () => {
    const base = timeline();
    const report = buildTimelineFindingsSummaryReport({
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
    });
    const html = renderTimelineFindingsSummaryReportHtml(report);

    assert.match(html, /&lt;Account&gt;/);
    assert.doesNotMatch(html, /<Account>/);
  });
});
