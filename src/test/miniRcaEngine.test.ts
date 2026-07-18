import * as assert from "assert";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustSummary,
} from "../pro/timeline/index.js";
import { buildMiniRcaReportFromTimeline, buildUnderstandingBundleFromTimeline, classifyMiniRcaTimelineEvent, renderMiniRcaReportHtml, renderMiniRcaReportMarkdown, withMiniRcaStory } from "../pro/miniRca/index.js";
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

  test("classifies choice evidence before incidental user-facing wording", () => {
    const t = timeline();
    const choiceEvent = event("event-choice", "choice-option-set", "Choice / Option Set Diff", "Label changes can affect user-facing interpretation while preserving the same stored option value.", t.intervals[0], "Low");
    assert.strictEqual(classifyMiniRcaTimelineEvent(choiceEvent), "Choice Evolution");
  });

  test("builds Understanding Bundle v1 with audit unavailable as non-confidence-changing evidence", () => {
    const bundle = buildUnderstandingBundleFromTimeline(timeline());

    assert.strictEqual(bundle.version, "understanding-bundle-v1");
    assert.strictEqual(bundle.timelineUnderstanding.summary.eventCount, 2);
    assert.strictEqual(bundle.auditEvidenceSummary.status, "Unavailable");
    assert.match(bundle.auditEvidenceSummary.summary, /Timeline evidence confidence is unchanged/i);
    assert.ok(bundle.availability.notApplicable.includes("crossDiff"));
    assert.ok(bundle.availability.notApplicable.includes("query"));
  });

  test("builds Mini RCA v2 evidence correlation and confidence analysis", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));

    assert.strictEqual(report.schemaVersion, "mini-rca-v2");
    assert.strictEqual(report.engineVersion, "v2.2");
    assert.ok(report.evidenceCorrelation.supportingEvidenceIds.length > 0);
    assert.ok(report.evidenceCorrelation.missingEvidence.some((item) => /Audit evidence was not available/i.test(item)));
    assert.ok(report.confidenceAnalysis.wouldIncreaseConfidence.some((item) => /audit/i.test(item)));
    assert.ok(report.operationalStory.length > 0);
  });

  test("builds deterministic Evidence Correlation Graph v1 without mutating evidence", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));

    assert.strictEqual(report.correlationGraph.version, "evidence-correlation-v1");
    assert.strictEqual(report.correlationGraph.metadata.deterministic, true);
    assert.strictEqual(report.correlationGraph.metadata.evidenceImmutable, true);
    assert.ok(report.correlationGraph.nodes.some((node) => node.kind === "evidence" && node.evidenceReferenceId === "timeline-1"));
    assert.ok(report.correlationGraph.edges.some((edge) => edge.relationship === "missing" && /audit/.test(edge.targetNodeId)));
    assert.deepStrictEqual(report.evidence.map((item) => item.id), ["timeline-1", "timeline-2"]);
  });

  test("renders Evidence Correlation Graph v1 in the Mini RCA appendix", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));
    const markdown = renderMiniRcaReportMarkdown(report);

    assert.match(markdown, /### Evidence Correlation Graph v1/);
    assert.match(markdown, /Graph version: evidence-correlation-v1/);
    assert.match(markdown, /Evidence immutable: yes/);
  });

  test("renders versioned Evidence Relationships and two-column Mini RCA report sections", () => {
    const report = withMiniRcaStory(buildMiniRcaReportFromTimeline(timeline()));
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    assert.match(markdown, /## Executive Summary/);
    assert.match(markdown, /## Investigation Story/);
    assert.match(markdown, /## Why DVQR Thinks This/);
    assert.match(markdown, /## Evidence Correlation/);
    assert.match(markdown, /correlation connects existing evidence; it does not create evidence or assert causation/i);
    assert.match(markdown, /## Evidence/);
    assert.match(markdown, /## Recommended Next Steps/);
    assert.match(markdown, /### Contract Metadata/);
    assert.match(markdown, /Understanding Bundle: understanding-bundle-v2|Understanding Bundle: understanding-bundle-v1/);
    assert.match(markdown, /### Evidence Relationships/);
    assert.match(markdown, /Available \(\d+\):/);
    assert.match(markdown, /## Experimental Boundary/);
    assert.match(html, /Executive Summary/);
    assert.match(html, /Investigation Story/);
    assert.match(html, /Why DVQR Thinks This/);
    assert.match(html, /How the available evidence relates/);
    assert.match(html, /correlation-cards/);
    assert.match(html, /grid-template-columns:repeat\(2,minmax\(0,1fr\)\)/);
    assert.match(html, /Supporting, missing, and confidence notes/);
    assert.match(html, /Recommended Next Steps/);
    assert.match(html, /Understanding Bundle · contributor details/);
    assert.match(html, /DV Quick Run v0\.15\.1/);
    assert.doesNotMatch(html, /Understanding Bundle Contract v0\.14\.7/);
    assert.match(html, /Evidence Relationships/);
    assert.match(html, /relationship-flow-grid/);
    assert.doesNotMatch(html, /<h2 style="margin-top:24px">Correlation Summary<\/h2>/);
  });
});

suite("sharedMiniRcaRecommendationEngine", () => {
  test("uses stable shared recommendation IDs and bounded semantics for Timeline", () => {
    const first = buildMiniRcaReportFromTimeline(timeline());
    const second = buildMiniRcaReportFromTimeline(timeline());

    assert.strictEqual(first.engineVersion, "v2.2");
    assert.ok(first.outcome);
    assert.deepStrictEqual(first.recommendations.map((item) => item.id), second.recommendations.map((item) => item.id));
    assert.deepStrictEqual(first.recommendations.map((item) => item.ruleId), second.recommendations.map((item) => item.ruleId));
    assert.ok(first.recommendations.every((item) => item.investigationKind === "timeline"));
    assert.ok(first.recommendations.some((item) => item.kind === "ReviewAdjacentInterval"));
    assert.doesNotMatch(first.recommendations.map((item) => `${item.title} ${item.detail}`).join(" "), /root cause confirmed|must fix|automatically change/i);
  });
});
