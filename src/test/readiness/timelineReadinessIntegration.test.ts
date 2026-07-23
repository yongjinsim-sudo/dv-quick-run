import * as assert from "assert";
import type { ComparisonProviderResult, ComparisonViewModel } from "../../core/comparison/index.js";
import {
  adaptCrossDiffToInvestigationInput,
  adaptTimelineToInvestigationInput,
  buildMiniRcaReportFromInvestigationInput,
  buildMiniRcaReportFromTimeline,
  buildTimelineReadinessRequest,
  renderMiniRcaReportHtml,
  renderMiniRcaReportMarkdown
} from "../../pro/miniRca/index.js";
import type {
  TimelineEvent,
  TimelineInterval,
  TimelineReconstruction,
  TimelineSnapshotRef,
  TimelineTrustState
} from "../../pro/timeline/index.js";
import { buildTimelineFindingsSummary } from "../../pro/timeline/index.js";
import type { TimelineReadinessContext } from "../../pro/miniRca/index.js";

const GENERATED_UTC = "2026-07-23T00:00:00.000Z";
const ASSESSMENT_UTC = "2026-07-23T00:00:01.000Z";

function snapshot(id: string, capturedAtIso: string): TimelineSnapshotRef {
  return {
    snapshotId: id,
    label: id,
    environmentLabel: "DEV",
    subjectLabel: "Account",
    subjectType: "entity",
    entityLogicalName: "account",
    capturedAtIso,
    trustState: "Verified"
  };
}

function interval(
  id: string,
  index: number,
  fromSnapshot: TimelineSnapshotRef,
  toSnapshot: TimelineSnapshotRef
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
    providerSummaries: [],
    events: []
  };
}

function event(
  id: string,
  providerId: string,
  providerTitle: string,
  intervalRef: TimelineInterval,
  significance: TimelineEvent["significance"]
): TimelineEvent {
  return {
    id,
    subjectKey: "entity:account",
    providerId,
    providerTitle,
    category: "Changed",
    significance,
    title: `${providerTitle} changed`,
    summary: `${providerTitle} changed during the observed interval.`,
    firstObservedBetween: {
      intervalId: intervalRef.id,
      intervalIndex: intervalRef.index,
      fromSnapshotId: intervalRef.fromSnapshot.snapshotId,
      toSnapshotId: intervalRef.toSnapshot.snapshotId,
      fromCapturedAtIso: intervalRef.fromCapturedAtIso,
      toCapturedAtIso: intervalRef.toCapturedAtIso,
      label: intervalRef.label
    },
    evidenceRefs: [{
      id: `${id}-evidence`,
      source: "ComparisonFinding",
      label: `${providerTitle} evidence`,
      providerId
    }]
  };
}

function timeline(options: {
  readonly generatedAtIso?: string;
  readonly trustState?: TimelineTrustState;
  readonly includeEvents?: boolean;
} = {}): TimelineReconstruction {
  const generatedAtIso = options.generatedAtIso ?? GENERATED_UTC;
  const trustState = options.trustState ?? "Verified";
  const includeEvents = options.includeEvents ?? true;
  const s1 = snapshot("s1", "2026-07-20T00:00:00.000Z");
  const s2 = snapshot("s2", "2026-07-21T00:00:00.000Z");
  const s3 = snapshot("s3", "2026-07-22T00:00:00.000Z");
  const i1 = interval("interval-1", 0, s1, s2);
  const i2 = interval("interval-2", 1, s2, s3);
  const e1 = event("event-1", "plugin-step", "Plugin Step Diff", i1, "High");
  const e2 = event("event-2", "identity-participation", "Identity Participation Diff", i2, "Medium");
  const intervals = includeEvents
    ? [{ ...i1, events: [e1] }, { ...i2, events: [e2] }]
    : [i1, i2];
  const topEvents = includeEvents ? [e1, e2] : [];

  return {
    id: "timeline-account-dev",
    schemaVersion: "timeline-reconstruction-v1",
    generatedAtIso,
    mode: "OperationalTimeline",
    status: trustState === "Verified"
      ? "Ready"
      : trustState === "Invalid"
        ? "Blocked"
        : "InspectOnly",
    subject: {
      subjectKey: "entity:account",
      subjectLabel: "Account",
      subjectType: "entity",
      entityLogicalName: "account",
      environmentLabel: "DEV"
    },
    summary: {
      title: "Operational Timeline Reconstruction",
      mode: "OperationalTimeline",
      subject: {
        subjectKey: "entity:account",
        subjectLabel: "Account",
        subjectType: "entity",
        entityLogicalName: "account",
        environmentLabel: "DEV"
      },
      rangeStartCapturedAtIso: s1.capturedAtIso,
      rangeEndCapturedAtIso: s3.capturedAtIso,
      snapshotCount: 3,
      intervalCount: 2,
      eventCount: topEvents.length,
      highCount: topEvents.filter((item) => item.significance === "High").length,
      mediumCount: topEvents.filter((item) => item.significance === "Medium").length,
      lowCount: topEvents.filter((item) => item.significance === "Low").length,
      noChangesObserved: topEvents.length === 0
    },
    trust: {
      state: trustState,
      verifiedCount: trustState === "Verified" ? 3 : 2,
      modifiedCount: trustState === "Partially Verified" ? 1 : 0,
      legacyOrUnverifiedCount: trustState === "Unverified" ? 1 : 0,
      invalidCount: trustState === "Invalid" ? 1 : 0,
      totalCount: 3,
      summary: `Timeline trust is ${trustState}.`
    },
    snapshots: [s1, s2, s3],
    intervals,
    topEvents,
    findingsSummary: buildTimelineFindingsSummary(intervals),
    warnings: []
  };
}

function buildTimelineReport(
  model: TimelineReconstruction,
  readiness: TimelineReadinessContext = {}
) {
  const input = adaptTimelineToInvestigationInput(model, {
    generatedAtIso: model.generatedAtIso,
    readiness: {
      assessmentUtc: ASSESSMENT_UTC,
      generatedUtc: ASSESSMENT_UTC,
      ...readiness
    }
  });
  return {
    input,
    report: buildMiniRcaReportFromInvestigationInput(input)
  };
}

function readinessResult(report: ReturnType<typeof buildMiniRcaReportFromTimeline>) {
  const readiness = report.investigationReadiness;
  if (!readiness || readiness.contractVersion !== "investigation-readiness-v1") {
    throw new Error(readiness?.message ?? "Investigation Readiness result is missing.");
  }
  return readiness;
}

function crossDiffComparison(): ComparisonViewModel {
  const provider: ComparisonProviderResult = {
    providerId: "attribute-metadata",
    title: "Attribute Metadata",
    groups: [{
      id: "metadata-group",
      title: "Attribute Metadata",
      summary: "Attribute comparison",
      significance: "Medium",
      differences: [{
        id: "attribute-1",
        title: "Required level differs",
        summary: "Required level differs between DEV and TEST.",
        kind: "Changed",
        significance: "Medium",
        sourceValue: "Optional",
        targetValue: "Required",
        evidence: [
          { label: "DEV", value: "Optional", source: "source" },
          { label: "TEST", value: "Required", source: "target" }
        ]
      }]
    }]
  };
  return {
    title: "Cross-Environment Diff: DEV → TEST",
    summary: {
      sourceLabel: "DEV",
      targetLabel: "TEST",
      sourceCapturedAtIso: "2026-07-22T20:00:00.000Z",
      targetCapturedAtIso: "2026-07-22T20:05:00.000Z",
      highCount: 0,
      mediumCount: 1,
      lowCount: 0,
      providerCount: 1,
      differenceCount: 1,
      subjectLabel: "Account",
      entityLogicalName: "account"
    },
    snapshotTrust: {
      sourceTrustState: "Verified",
      targetTrustState: "Verified"
    },
    session: {
      generatedAtIso: GENERATED_UTC,
      mode: "Cross-Environment Diff",
      sourceSnapshot: {
        label: "DEV snapshot",
        environmentLabel: "DEV",
        capturedAtIso: "2026-07-22T20:00:00.000Z",
        trustState: "Verified"
      },
      targetSnapshot: {
        label: "TEST snapshot",
        environmentLabel: "TEST",
        capturedAtIso: "2026-07-22T20:05:00.000Z",
        trustState: "Verified"
      }
    },
    groups: provider.groups,
    providerResults: [provider]
  };
}

suite("timelineReadinessIntegration", () => {
  test("produces Ready for verified Timeline evidence without an exact-time request", () => {
    const { input, report } = buildTimelineReport(timeline());
    const readiness = readinessResult(report);
    const request = buildTimelineReadinessRequest(input, report.understandingBundle, report.outcome);

    assert.strictEqual(readiness.posture, "Ready");
    assert.strictEqual(readiness.confidenceEffect, "Preserve");
    assert.strictEqual(readiness.profileId, "timeline-mini-rca-v1");
    assert.strictEqual(readiness.gaps.length, 0);
    assert.strictEqual(request.investigationInput.intent?.actorOrChangeTimeRequested, false);
    assert.strictEqual(request.investigationInput.intent?.temporalProgressionRequested, true);
    assert.strictEqual(readiness.contributorStates.find((item) => item.contributorId === "audit.evidence")?.applicable, false);
  });

  test("produces Conditional when requested audit evidence is permission-limited", () => {
    const { report } = buildTimelineReport(timeline(), {
      intent: {
        auditRequested: true,
        actorOrChangeTimeRequested: true
      },
      auditEvidence: {
        state: "PermissionLimited",
        consultationAttempted: true,
        limitations: ["The current connection cannot retrieve audit evidence for the requested interval."]
      }
    });
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Conditional");
    assert.strictEqual(readiness.confidenceEffect, "Qualify");
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-PERMISSION-002"
      && gap.category === "Permission"
      && gap.priority === "Medium"
      && gap.contributorIds.includes("audit.evidence")
    ));
  });

  test("maps equivalent audit limitations to the same Cross-Diff state, category, and priority", () => {
    const timelineReadiness = readinessResult(buildTimelineReport(timeline(), {
      intent: { auditRequested: true },
      auditEvidence: {
        state: "PermissionLimited",
        consultationAttempted: true
      }
    }).report);
    const crossDiffInput = adaptCrossDiffToInvestigationInput(crossDiffComparison(), {
      generatedAtIso: GENERATED_UTC,
      readiness: {
        assessmentUtc: ASSESSMENT_UTC,
        generatedUtc: ASSESSMENT_UTC,
        intent: { auditRequested: true },
        auditEvidence: {
          state: "PermissionLimited",
          consultationAttempted: true
        }
      }
    });
    const crossDiffReadiness = readinessResult(buildMiniRcaReportFromInvestigationInput(crossDiffInput));
    const timelineAudit = timelineReadiness.contributorStates.find((item) => item.contributorId === "audit.evidence");
    const crossDiffAudit = crossDiffReadiness.contributorStates.find((item) => item.contributorId === "audit.evidence");
    const timelineGap = timelineReadiness.gaps.find((gap) => gap.contributorIds.includes("audit.evidence"));
    const crossDiffGap = crossDiffReadiness.gaps.find((gap) => gap.contributorIds.includes("audit.evidence"));

    assert.strictEqual(timelineAudit?.state, crossDiffAudit?.state);
    assert.strictEqual(timelineGap?.ruleId, crossDiffGap?.ruleId);
    assert.strictEqual(timelineGap?.category, crossDiffGap?.category);
    assert.strictEqual(timelineGap?.priority, crossDiffGap?.priority);
  });

  test("produces Limited for explicitly stale Timeline understanding", () => {
    const { report } = buildTimelineReport(timeline(), {
      understanding: {
        state: "Stale",
        freshnessRuleId: "timeline-derived-input-validity",
        limitations: ["The derived understanding does not correspond to the selected Timeline artifact."]
      }
    });
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Limited");
    assert.strictEqual(readiness.confidenceEffect, "Dampen");
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-FRESHNESS-001"
      && gap.category === "Freshness"
      && gap.priority === "High"
      && gap.contributorIds.includes("timeline.understanding")
    ));
    assert.ok(readiness.contributorStates.find((item) => item.contributorId === "timeline.understanding")?.evidenceRefs.length);
  });

  test("maps equivalent required freshness limitations to the same Cross-Diff category and priority", () => {
    const timelineReadiness = readinessResult(buildTimelineReport(timeline(), {
      understanding: {
        state: "Stale",
        freshnessRuleId: "timeline-derived-input-validity"
      }
    }).report);
    const crossDiffInput = adaptCrossDiffToInvestigationInput(crossDiffComparison(), {
      generatedAtIso: GENERATED_UTC,
      readiness: {
        assessmentUtc: ASSESSMENT_UTC,
        generatedUtc: ASSESSMENT_UTC,
        targetSnapshot: {
          state: "Stale",
          freshnessRuleId: "cross-diff-target-validity-window"
        }
      }
    });
    const crossDiffReadiness = readinessResult(buildMiniRcaReportFromInvestigationInput(crossDiffInput));
    const timelineGap = timelineReadiness.gaps.find((gap) => gap.contributorIds.includes("timeline.understanding"));
    const crossDiffGap = crossDiffReadiness.gaps.find((gap) => gap.contributorIds.includes("crossDiff.targetSnapshot"));

    assert.strictEqual(timelineGap?.ruleId, crossDiffGap?.ruleId);
    assert.strictEqual(timelineGap?.category, crossDiffGap?.category);
    assert.strictEqual(timelineGap?.priority, crossDiffGap?.priority);
    assert.strictEqual(timelineReadiness.posture, crossDiffReadiness.posture);
  });

  test("keeps InspectOnly understanding available while unresolved trust carries the limitation", () => {
    const { report } = buildTimelineReport(timeline({ trustState: "Partially Verified" }));
    const readiness = readinessResult(report);
    const trust = readiness.contributorStates.find((item) => item.contributorId === "timeline.trust");
    const understanding = readiness.contributorStates.find((item) => item.contributorId === "timeline.understanding");

    assert.strictEqual(readiness.posture, "Limited");
    assert.strictEqual(understanding?.state, "Available");
    assert.strictEqual(trust?.state, "Partial");
    assert.ok(trust?.evidenceRefs.length);
    assert.deepStrictEqual(readiness.gaps.map((gap) => gap.ruleId), ["GAP-PROVENANCE-001"]);
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-PROVENANCE-001"
      && gap.category === "Provenance"
      && gap.priority === "High"
      && gap.contributorIds.includes("timeline.trust")
    ));
    assert.ok(!readiness.gaps.some((gap) => gap.contributorIds.includes("timeline.understanding")));
  });

  test("produces NotAssessable when no qualifying Timeline events exist", () => {
    const { report } = buildTimelineReport(timeline({ includeEvents: false }));
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "NotAssessable");
    assert.strictEqual(readiness.confidenceEffect, "Withhold");
    assert.strictEqual(readiness.effectiveSynthesizedConfidence, "Unknown");
    assert.deepStrictEqual(readiness.gaps.map((gap) => gap.ruleId), ["GAP-COVERAGE-001"]);
    assert.deepStrictEqual(readiness.gaps[0]?.contributorIds, ["timeline.reconstruction"]);
  });

  test("does not treat historical Timeline age as staleness without an explicit rule", () => {
    const historical = timeline({ generatedAtIso: "2000-01-01T00:00:00.000Z" });
    const { report } = buildTimelineReport(historical, {
      assessmentUtc: "2026-07-23T00:00:00.000Z",
      generatedUtc: "2026-07-23T00:00:00.000Z"
    });
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Ready");
    assert.strictEqual(readiness.contributorStates.find((item) => item.contributorId === "timeline.reconstruction")?.state, "Available");
    assert.ok(!readiness.gaps.some((gap) => gap.category === "Freshness"));
  });

  test("keeps first-observed intervals independent from exact actor/change-time intent", () => {
    const { report } = buildTimelineReport(timeline());
    const readiness = readinessResult(report);

    assert.ok(report.evidence.every((item) => item.firstObservedBetween));
    assert.strictEqual(readiness.contributorStates.find((item) => item.contributorId === "audit.evidence")?.applicable, false);
    assert.ok(!readiness.gaps.some((gap) => gap.contributorIds.includes("audit.evidence")));
  });

  test("does not change evidence, ranking, correlation, dominance, or numeric confidence", () => {
    const baseline = buildTimelineReport(timeline()).report;
    const limited = buildTimelineReport(timeline(), {
      understanding: {
        state: "Stale",
        freshnessRuleId: "timeline-derived-input-validity"
      }
    }).report;

    assert.deepStrictEqual(limited.evidence, baseline.evidence);
    assert.deepStrictEqual(limited.mostProbableExplanation, baseline.mostProbableExplanation);
    assert.deepStrictEqual(limited.competingExplanations, baseline.competingExplanations);
    assert.deepStrictEqual(limited.correlationGraph.nodes, baseline.correlationGraph.nodes);
    assert.deepStrictEqual(limited.correlationGraph.edges, baseline.correlationGraph.edges);
    assert.deepStrictEqual(limited.correlationGraph.summary, baseline.correlationGraph.summary);
    assert.deepStrictEqual(limited.outcome, baseline.outcome);
    assert.deepStrictEqual(limited.confidence, baseline.confidence);
    assert.strictEqual(baseline.outcome?.kind, "non-dominant");
  });

  test("builds deterministic Timeline readiness for fixed input and timestamps", () => {
    const first = buildTimelineReport(timeline());
    const second = buildTimelineReport(timeline());

    assert.deepStrictEqual(first.report.investigationReadiness, second.report.investigationReadiness);
    assert.strictEqual(first.input.investigationId, second.input.investigationId);
    assert.strictEqual(first.input.provenance.sourceArtifactId, second.input.provenance.sourceArtifactId);
  });

  test("renders additive Timeline readiness and preserves historical report compatibility", () => {
    const report = buildTimelineReport(timeline(), {
      understanding: {
        state: "Stale",
        freshnessRuleId: "timeline-derived-input-validity"
      }
    }).report;
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);
    const { investigationReadiness: ignoredReadiness, ...historicalReport } = report;
    void ignoredReadiness;
    const historicalMarkdown = renderMiniRcaReportMarkdown(historicalReport);
    const historicalHtml = renderMiniRcaReportHtml(historicalReport);

    assert.match(markdown, /## Investigation Readiness/);
    assert.match(markdown, /Posture: \*\*Limited\*\*/);
    assert.match(markdown, /Investigation Input: investigation-input-v1/);
    assert.match(markdown, /Investigation Readiness Technical Trace/);
    assert.match(html, /Timeline Reconstruction input adapted through investigation-input-v1/);
    assert.match(html, /GAP-FRESHNESS-001/);
    assert.doesNotMatch(historicalMarkdown, /## Investigation Readiness/);
    assert.match(historicalMarkdown, /Investigation Input: timeline-native/);
    assert.match(historicalHtml, /existing native path/);
  });
});
