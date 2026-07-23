import * as assert from "assert";
import type { ComparisonProviderResult, ComparisonViewModel } from "../../core/comparison/index.js";
import {
  adaptCrossDiffToInvestigationInput,
  buildCrossDiffReadinessRequest,
  buildMiniRcaReportFromInvestigationInput,
  renderMiniRcaReportHtml,
  renderMiniRcaReportMarkdown
} from "../../pro/miniRca/index.js";
import type { CrossDiffReadinessContext } from "../../pro/miniRca/index.js";

const GENERATED_UTC = "2026-07-23T00:00:00.000Z";
const ASSESSMENT_UTC = "2026-07-23T00:00:01.000Z";

function provider(
  providerId: string,
  title: string,
  differenceId: string,
  differenceTitle: string,
  significance: "High" | "Medium" | "Low" = "Medium"
): ComparisonProviderResult {
  return {
    providerId,
    title,
    groups: [{
      id: `${providerId}-group`,
      title,
      summary: `${title} comparison`,
      significance,
      differences: [{
        id: differenceId,
        title: differenceTitle,
        summary: `${differenceTitle} between DEV and TEST.`,
        kind: "Changed",
        significance,
        sourceValue: "DEV value",
        targetValue: "TEST value",
        evidence: [
          { label: "DEV", value: "DEV value", source: "source" },
          { label: "TEST", value: "TEST value", source: "target" }
        ]
      }]
    }]
  };
}

function comparison(providerResults?: readonly ComparisonProviderResult[]): ComparisonViewModel {
  const providers = providerResults ?? [
    provider("relationship-metadata", "Relationship Metadata", "relationship-1", "Relationship definition differs", "High"),
    provider("attribute-metadata", "Attribute Metadata", "attribute-1", "Required level differs", "Medium"),
    provider("environment-variable", "Environment Variables", "variable-1", "Environment variable differs", "Medium"),
    provider("identity-participation", "Identity Participation", "identity-1", "Team participation differs", "Low")
  ];
  const differences = providers.flatMap((item) => item.groups.flatMap((group) => group.differences));
  return {
    title: "Cross-Environment Diff: DEV → TEST",
    summary: {
      sourceLabel: "DEV",
      targetLabel: "TEST",
      sourceCapturedAtIso: "2026-07-22T20:00:00.000Z",
      targetCapturedAtIso: "2026-07-22T20:05:00.000Z",
      highCount: differences.filter((item) => item.significance === "High").length,
      mediumCount: differences.filter((item) => item.significance === "Medium").length,
      lowCount: differences.filter((item) => item.significance === "Low").length,
      providerCount: providers.length,
      differenceCount: differences.length,
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
    groups: providers.flatMap((item) => item.groups),
    providerResults: providers
  };
}

function buildReport(
  model: ComparisonViewModel,
  readiness: CrossDiffReadinessContext = {}
) {
  const input = adaptCrossDiffToInvestigationInput(model, {
    generatedAtIso: GENERATED_UTC,
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

function readinessResult(report: ReturnType<typeof buildMiniRcaReportFromInvestigationInput>) {
  const readiness = report.investigationReadiness;
  if (!readiness || readiness.contractVersion !== "investigation-readiness-v1") {
    throw new Error(readiness?.message ?? "Investigation Readiness result is missing.");
  }
  return readiness;
}

suite("crossDiffReadinessIntegration", () => {
  test("produces a Ready result for aligned qualifying Cross-Diff evidence", () => {
    const { report } = buildReport(comparison());
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Ready");
    assert.strictEqual(readiness.confidenceEffect, "Preserve");
    assert.strictEqual(readiness.gaps.length, 0);
    assert.strictEqual(readiness.profileId, "cross-diff-mini-rca-v1");
    assert.ok(readiness.contributorStates.every((item) => item.contributorId !== "timeline.reconstruction"));
  });

  test("produces Conditional when requested audit evidence is permission-limited", () => {
    const { report } = buildReport(comparison(), {
      intent: {
        auditRequested: true,
        actorOrChangeTimeRequested: true
      },
      auditEvidence: {
        state: "PermissionLimited",
        consultationAttempted: true,
        limitations: ["The current connection cannot retrieve audit evidence."]
      }
    });
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Conditional");
    assert.strictEqual(readiness.confidenceEffect, "Qualify");
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-PERMISSION-002" && gap.contributorIds.includes("audit.evidence")
    ));
  });

  test("produces Limited for an explicitly stale target snapshot", () => {
    const { report } = buildReport(comparison(), {
      targetSnapshot: {
        state: "Stale",
        freshnessRuleId: "cross-diff-target-validity-window",
        limitations: ["The target snapshot is outside the explicit comparison validity window."]
      }
    });
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "Limited");
    assert.strictEqual(readiness.confidenceEffect, "Dampen");
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-FRESHNESS-001"
      && gap.contributorIds.length === 1
      && gap.contributorIds[0] === "crossDiff.targetSnapshot"
    ));
    assert.ok(readiness.contributorStates.find((item) => item.contributorId === "crossDiff.targetSnapshot")?.evidenceRefs.length);
  });

  test("produces NotAssessable when no qualifying comparison findings exist", () => {
    const { report } = buildReport(comparison([]));
    const readiness = readinessResult(report);

    assert.strictEqual(readiness.posture, "NotAssessable");
    assert.strictEqual(readiness.confidenceEffect, "Withhold");
    assert.strictEqual(readiness.effectiveSynthesizedConfidence, "Unknown");
    assert.deepStrictEqual(readiness.gaps.map((gap) => gap.ruleId), ["GAP-COVERAGE-001"]);
    assert.deepStrictEqual(readiness.gaps[0]?.contributorIds, ["crossDiff.comparison"]);
  });

  test("preserves source and target orientation for permission and freshness gaps", () => {
    const { report } = buildReport(comparison(), {
      sourceSnapshot: {
        state: "PermissionLimited",
        consultationAttempted: true
      },
      targetSnapshot: {
        state: "Stale",
        freshnessRuleId: "cross-diff-target-validity-window"
      }
    });
    const readiness = readinessResult(report);

    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-PERMISSION-001"
      && gap.contributorIds.length === 1
      && gap.contributorIds[0] === "crossDiff.sourceSnapshot"
    ));
    assert.ok(readiness.gaps.some((gap) =>
      gap.ruleId === "GAP-FRESHNESS-001"
      && gap.contributorIds.length === 1
      && gap.contributorIds[0] === "crossDiff.targetSnapshot"
    ));
    const source = readiness.contributorStates.find((item) => item.contributorId === "crossDiff.sourceSnapshot");
    const target = readiness.contributorStates.find((item) => item.contributorId === "crossDiff.targetSnapshot");
    assert.strictEqual(source?.state, "PermissionLimited");
    assert.strictEqual(target?.state, "Stale");
    assert.strictEqual(target?.evidenceRefs[0]?.environmentLabel, "TEST");
  });

  test("does not change provider evidence, ranking, correlation, dominance, or numeric confidence", () => {
    const baseline = buildReport(comparison()).report;
    const limited = buildReport(comparison(), {
      targetSnapshot: {
        state: "Stale",
        freshnessRuleId: "cross-diff-target-validity-window"
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
  });

  test("builds byte-equivalent readiness for fixed input and timestamps", () => {
    const first = buildReport(comparison());
    const second = buildReport(comparison());

    assert.deepStrictEqual(first.report.investigationReadiness, second.report.investigationReadiness);
    assert.strictEqual(first.input.investigationId, second.input.investigationId);
    assert.strictEqual(first.input.provenance.sourceArtifactId, second.input.provenance.sourceArtifactId);

    const request = buildCrossDiffReadinessRequest(
      first.input,
      first.report.understandingBundle,
      first.report.outcome
    );
    assert.strictEqual(request.investigationInput.subject.sourceEnvironmentLabel, "DEV");
    assert.strictEqual(request.investigationInput.subject.targetEnvironmentLabel, "TEST");
  });

  test("renders a compact readiness section and complete technical trace", () => {
    const { report } = buildReport(comparison(), {
      targetSnapshot: {
        state: "Stale",
        freshnessRuleId: "cross-diff-target-validity-window"
      }
    });
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    assert.match(markdown, /## Investigation Readiness/);
    assert.match(markdown, /Posture: \*\*Limited\*\*/);
    assert.match(markdown, /Investigation Readiness Technical Trace/);
    assert.match(markdown, /GAP-FRESHNESS-001/);
    assert.match(html, /Investigation Readiness · Advisory/);
    assert.match(html, /Investigation Readiness · technical trace/);
    assert.match(html, /GAP-FRESHNESS-001/);
    assert.match(html, /DV Quick Run v0\.15\.3/);
    assert.doesNotMatch(`${markdown}\n${html}`, /readiness score/i);
  });
});
