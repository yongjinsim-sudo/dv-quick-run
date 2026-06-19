import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustSummary,
} from "../pro/timeline/index.js";
import { renderStandaloneTimelineSurfaceHtml } from "../webview/timelineSurface/index.js";

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

const s1 = snapshot("s1", "2026-05-25T05:27:12.000Z");
const s2 = snapshot("s2", "2026-06-16T07:18:47.000Z");
const s3 = snapshot("s3", "2026-06-17T02:41:15.000Z");

const trust: TimelineTrustSummary = {
  state: "Verified",
  verifiedCount: 3,
  modifiedCount: 0,
  legacyOrUnverifiedCount: 0,
  invalidCount: 0,
  totalCount: 3,
  summary: "All selected snapshots are verified.",
};

function event(id: string, interval: TimelineInterval, significance: TimelineEvent["significance"]): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId: "metadata",
    providerTitle: "Metadata Drift",
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
    evidenceRefs: [{ id: `${id}-evidence`, source: "ComparisonFinding", label: "Evidence", summary: "provider evidence" }],
  };
}

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
    providerSummaries: [{
      providerId: "metadata",
      title: "Metadata Drift",
      intervalId: id,
      highCount: index === 0 ? 1 : 0,
      mediumCount: index === 1 ? 1 : 0,
      lowCount: 0,
      eventCount: 1,
      summary: "1 change first observed in this interval.",
      groups: [],
    }],
    events: [],
  };
}

function timeline(overrides: Partial<TimelineReconstruction> = {}): TimelineReconstruction {
  const i1 = interval("interval-1", 0, s1, s2);
  const i2 = interval("interval-2", 1, s2, s3);
  const e1 = event("event-1", i1, "High");
  const e2 = event("event-2", i2, "Medium");
  const intervals = [
    { ...i1, events: [e1] },
    { ...i2, events: [e2] },
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
    findingsSummary: {
      changed: [{
        id: "summary-metadata-changed",
        kind: "Changed",
        providerId: "metadata",
        providerTitle: "Metadata Drift",
        title: "Metadata Drift changed",
        summary: "2 findings first observed.",
        eventCount: 2,
        highCount: 1,
        mediumCount: 1,
        lowCount: 0,
        firstObservedBetween: e1.firstObservedBetween,
        anchorId: e1.id,
      }],
      noChange: [{
        id: "summary-plugin-no-change",
        kind: "NoChangesObserved",
        providerId: "plugin",
        providerTitle: "Plugin Step Diff",
        title: "No Plugin Step Diff observed",
        summary: "No changes first observed across 2 intervals.",
        eventCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        anchorId: "interval-1",
      }],
      totalChangedProviderCount: 1,
      totalNoChangeProviderCount: 1,
      summary: "2 timeline events first observed across 1 provider.",
    },
    warnings: [],
    ...overrides,
  };
}

suite("timelineSurfaceRenderer", () => {
  test("renders timeline reconstruction header, top events, intervals and first-observed wording", () => {
    const html = renderStandaloneTimelineSurfaceHtml(timeline());

    assert.match(html, /Operational Timeline Reconstruction/);
    assert.match(html, /Timeline Findings Summary/);
    assert.match(html, /Top Timeline Events/);
    assert.match(html, /Full Operational Timeline/);
    assert.match(html, /Snapshots Analysed/);
    assert.match(html, /Intervals Compared/);
    assert.match(html, /Timeline Trust/);
    assert.match(html, /Verified/);
    assert.match(html, /First observed between/);
    assert.match(html, /href="#event-1"/);
    assert.match(html, /No changes observed for 1 provider/);
    assert.match(html, /Reports ▾/);
    assert.match(html, /Timeline Findings Summary <span>HTML<\/span>/);
    assert.match(html, /Timeline Investigation Handoff <span>PDF<\/span>/);
    assert.match(html, /Timeline Intervals/);
    assert.match(html, /href="#interval-1"/);
    assert.doesNotMatch(html, /Timeline Diff/);
    assert.doesNotMatch(html, /Changed at/);
  });

  test("renders no-changes observed state calmly", () => {
    const base = timeline();
    const html = renderStandaloneTimelineSurfaceHtml(timeline({
      summary: {
        ...base.summary,
        eventCount: 0,
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        noChangesObserved: true,
      },
      intervals: base.intervals.map((item) => ({ ...item, events: [], providerSummaries: [] })),
      topEvents: [],
      findingsSummary: {
        changed: [],
        noChange: base.findingsSummary.noChange,
        totalChangedProviderCount: 0,
        totalNoChangeProviderCount: 1,
        summary: "No timeline changes were first observed across 2 intervals.",
      },
    }));

    assert.match(html, /No changes observed across the selected snapshots and intervals/);
    assert.match(html, /No top timeline events were identified/);
  });

  test("escapes timeline content", () => {
    const html = renderStandaloneTimelineSurfaceHtml(timeline({
      subject: {
        subjectKey: "entity:account",
        subjectLabel: "<Account>",
        subjectType: "entity",
        entityLogicalName: "account",
        environmentLabel: "DEV",
      },
      summary: {
        ...timeline().summary,
        subject: {
          subjectKey: "entity:account",
          subjectLabel: "<Account>",
          subjectType: "entity",
          entityLogicalName: "account",
          environmentLabel: "DEV",
        },
      },
    }));

    assert.match(html, /&lt;Account&gt;/);
    assert.doesNotMatch(html, /<Account>/);
  });
});
