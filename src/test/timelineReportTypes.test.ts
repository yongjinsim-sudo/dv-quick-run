import assert from "assert";
import test from "node:test";
import type {
  TimelineFindingsSummaryReportModel,
  TimelineInvestigationHandoffReportModel,
  TimelineReconstruction,
  TimelineReportKind,
} from "../pro/timeline/index.js";

test("timeline report contracts expose summary and handoff report kinds", () => {
  const kinds: readonly TimelineReportKind[] = ["TimelineFindingsSummary", "TimelineInvestigationHandoff"];
  assert.deepStrictEqual(kinds, ["TimelineFindingsSummary", "TimelineInvestigationHandoff"]);
});

test("timeline report contracts allow summary and handoff models to share common scope", () => {
  const summary = {
    kind: "TimelineFindingsSummary",
    title: "Timeline Findings Summary",
    generatedAtIso: "2026-06-18T00:00:00.000Z",
    scope: {
      subject: { subjectKey: "entity:account", subjectLabel: "Account", subjectType: "entity", entityLogicalName: "account" },
      environmentLabel: "DEV",
      rangeStartCapturedAtIso: "2026-06-01T00:00:00.000Z",
      rangeEndCapturedAtIso: "2026-06-18T00:00:00.000Z",
      snapshotsAnalysed: 3,
      intervalsCompared: 2,
      timelineEvents: 0,
    },
    trust: {
      state: "Verified",
      verifiedCount: 3,
      modifiedCount: 0,
      legacyOrUnverifiedCount: 0,
      invalidCount: 0,
      totalCount: 3,
      summary: "3 verified snapshots.",
    },
    boundary: {
      title: "Evidence boundary",
      paragraphs: ["Changes are reported as first observed between snapshot captures."],
    },
    warnings: [],
    significanceSummary: { high: 0, medium: 0, low: 0 },
    watermark: { footerText: "DV Quick Run timeline report" },
    findingsSummary: {
      changed: [],
      noChange: [],
      totalChangedProviderCount: 0,
      totalNoChangeProviderCount: 0,
      summary: "No timeline changes were first observed across 2 intervals.",
    },
    changedProviders: [],
    unchangedProviders: [],
    intervals: [],
    topEvents: [],
    reconstructionArtifacts: [],
  } satisfies TimelineFindingsSummaryReportModel;

  const handoff = {
    ...summary,
    kind: "TimelineInvestigationHandoff",
    title: "Timeline Investigation Handoff",
    snapshots: [],
    intervals: [],
    reconstruction: {} as TimelineReconstruction,
  } satisfies TimelineInvestigationHandoffReportModel;

  assert.strictEqual(summary.scope.snapshotsAnalysed, 3);
  assert.strictEqual(handoff.scope.intervalsCompared, 2);
});
