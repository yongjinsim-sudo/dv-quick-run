import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustSummary,
} from "../pro/timeline/index.js";
import { buildMiniRcaReportFromTimeline, buildUnderstandingBundleFromTimeline, renderMiniRcaReportHtml, renderMiniRcaReportMarkdown, withMiniRcaStory } from "../pro/miniRca/index.js";
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
    providerSummaries: [],
    events: [],
  };
}

function event(id: string, providerId: string, providerTitle: string, summary: string, intervalRef: TimelineInterval, significance: TimelineEvent["significance"]): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId,
    providerTitle,
    category: "Changed",
    significance,
    title: `${providerTitle} changed`,
    summary,
    firstObservedBetween: {
      intervalId: intervalRef.id,
      intervalIndex: intervalRef.index,
      fromSnapshotId: intervalRef.fromSnapshot.snapshotId,
      toSnapshotId: intervalRef.toSnapshot.snapshotId,
      fromCapturedAtIso: intervalRef.fromCapturedAtIso,
      toCapturedAtIso: intervalRef.toCapturedAtIso,
      label: intervalRef.label,
    },
    evidenceRefs: [{ id: `${id}-evidence`, source: "ComparisonFinding", label: "Evidence" }],
  };
}

function timeline(): TimelineReconstruction {
  const s1 = snapshot("s1", "2026-07-01T00:00:00.000Z");
  const s2 = snapshot("s2", "2026-07-02T00:00:00.000Z");
  const s3 = snapshot("s3", "2026-07-03T00:00:00.000Z");
  const i1 = interval("interval-1", 0, s1, s2);
  const i2 = interval("interval-2", 1, s2, s3);
  const e1 = event("event-1", "plugin", "Plugin Step Diff", "Plugin step and workflow participation changed.", i1, "High");
  const e2 = event("event-2", "security", "Identity Participation Diff", "Role and team access participation changed.", i2, "Medium");
  const intervals = [{ ...i1, events: [e1] }, { ...i2, events: [e2] }];
  const trust: TimelineTrustSummary = {
    state: "Verified",
    verifiedCount: 3,
    modifiedCount: 0,
    legacyOrUnverifiedCount: 0,
    invalidCount: 0,
    totalCount: 3,
    summary: "All selected snapshots are verified.",
  };

  return {
    id: "timeline-account-dev",
    schemaVersion: "timeline-reconstruction-v1",
    generatedAtIso: "2026-07-03T01:00:00.000Z",
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
    findingsSummary: buildTimelineFindingsSummary(intervals),
    warnings: [],
  };
}

suite("miniRcaEngine", () => {
  test("builds Understanding Bundle v1 with audit unavailable as non-confidence-changing evidence", () => {
    const bundle = buildUnderstandingBundleFromTimeline(timeline());

    assert.strictEqual(bundle.version, "understanding-bundle-v1");
    assert.strictEqual(bundle.timelineUnderstanding.summary.eventCount, 2);
    assert.strictEqual(bundle.auditEvidenceSummary.status, "Unavailable");
    assert.match(bundle.auditEvidenceSummary.summary, /Confidence unchanged/);
  });

  test("builds Mini RCA v2 evidence correlation and confidence analysis", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));

    assert.strictEqual(report.schemaVersion, "mini-rca-v2");
    assert.strictEqual(report.engineVersion, "v2.0");
    assert.ok(report.evidenceCorrelation.supportingEvidenceIds.length > 0);
    assert.ok(report.evidenceCorrelation.missingEvidence.some((item) => /Audit evidence unavailable/.test(item)));
    assert.ok(report.confidenceAnalysis.wouldIncreaseConfidence.some((item) => /audit/i.test(item)));
    assert.ok(report.operationalStory.length > 0);
  });

  test("renders v0.14.5 Mini RCA Markdown and HTML report sections", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    assert.match(markdown, /## Investigation Conclusion/);
    assert.match(markdown, /## Investigation Narrative/);
    assert.match(markdown, /## Investigation Reasoning/);
    assert.match(markdown, /## Evidence Correlation/);
    assert.match(markdown, /## Confidence Analysis/);
    assert.match(markdown, /## Understanding Bundle/);
    assert.match(markdown, /## Experimental Boundary/);
    assert.match(html, /Investigation Conclusion/);
    assert.match(html, /Investigation Narrative/);
    assert.match(html, /Investigation Reasoning/);
    assert.match(html, /Evidence Correlation/);
    assert.match(html, /Confidence Model v2/);
    assert.match(html, /Understanding Bundle v1/);
  });
});
