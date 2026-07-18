import * as assert from "assert";
import type { ComparisonViewModel } from "../core/comparison/index.js";
import {
  adaptCrossDiffToInvestigationInput,
  buildMiniRcaReportFromInvestigationInput,
  buildUnderstandingBundleFromInvestigationInput,
  renderMiniRcaReportHtml,
  renderMiniRcaReportMarkdown,
} from "../pro/miniRca/index.js";

function comparison(): ComparisonViewModel {
  return {
    title: "DEV → TEST",
    summary: {
      sourceLabel: "DEV",
      targetLabel: "TEST",
      highCount: 1,
      mediumCount: 1,
      lowCount: 0,
      providerCount: 2,
      differenceCount: 2,
      subjectLabel: "Account",
      entityLogicalName: "account",
    },
    groups: [],
    providerResults: [
      {
        providerId: "attribute-metadata",
        title: "Attribute Metadata",
        groups: [{
          id: "attributes",
          title: "Attributes",
          summary: "Attribute drift",
          significance: "High",
          differences: [{
            id: "name-required-level",
            title: "Required level changed",
            summary: "name changed from None to ApplicationRequired.",
            kind: "Changed",
            significance: "High",
            sourceValue: "None",
            targetValue: "ApplicationRequired",
            evidence: [
              { label: "Source required level", value: "None", source: "source" },
              { label: "Target required level", value: "ApplicationRequired", source: "target" },
            ],
          }],
        }],
      },
      {
        providerId: "workflow",
        title: "Workflow Diff",
        groups: [{
          id: "workflows",
          title: "Workflows",
          summary: "Workflow drift",
          significance: "Medium",
          differences: [{
            id: "workflow-state",
            title: "Workflow state differs",
            summary: "A workflow is active in DEV and inactive in TEST.",
            kind: "State Drift",
            significance: "Medium",
            sourceValue: "Active",
            targetValue: "Inactive",
            evidence: [],
          }],
        }],
      },
    ],
  };
}

suite("miniRcaInvestigationInput", () => {
  test("builds Cross-Diff Understanding through investigation-input-v1", () => {
    const input = adaptCrossDiffToInvestigationInput(comparison());
    const bundle = buildUnderstandingBundleFromInvestigationInput(input);

    assert.strictEqual(bundle.timelineUnderstanding.trustState, "Not Applicable");
    assert.ok(bundle.crossDiffUnderstanding);
    assert.strictEqual(bundle.crossDiffUnderstanding?.evidence.length, 2);
    assert.strictEqual(bundle.availability.available.includes("crossDiff"), true);
    assert.strictEqual(bundle.availability.notApplicable.includes("timeline"), true);
    assert.strictEqual(bundle.availability.unavailable.some((item) => item.type === "audit"), true);
    assert.strictEqual(bundle.availability.available.includes("automation"), true);
  });

  test("builds deterministic Mini RCA directly from Cross-Diff input", () => {
    const input = adaptCrossDiffToInvestigationInput(comparison());
    const first = buildMiniRcaReportFromInvestigationInput(input);
    const second = buildMiniRcaReportFromInvestigationInput(input);

    assert.strictEqual(first.schemaVersion, "mini-rca-v2");
    assert.strictEqual(first.sourceSummary.crossDiff?.sourceLabel, "DEV");
    assert.strictEqual(first.sourceSummary.crossDiff?.targetLabel, "TEST");
    assert.deepStrictEqual(first.evidence.map((item) => item.id), second.evidence.map((item) => item.id));
    assert.deepStrictEqual(first.mostProbableExplanation, second.mostProbableExplanation);
    assert.ok(first.evidence.some((item) => item.source === "Cross Environment"));
    assert.ok(first.correlationGraph.nodes.some((node) => node.kind === "evidence"));
    assert.ok(first.operationalStory.some((line) => /DEV → TEST/.test(line)));
    assert.strictEqual(first.competingExplanations.some((item) => item.category === "Mixed Contributors"), false);
    assert.ok(first.outcome);
    assert.strictEqual(first.engineVersion, "v2.2");
    assert.deepStrictEqual(first.recommendations.map((item) => item.id), second.recommendations.map((item) => item.id));
    assert.ok(first.recommendations.every((item) => item.investigationKind === "cross-environment-diff"));
    assert.strictEqual(new Set(first.recommendations.map((item) => item.id)).size, first.recommendations.length);
  });

  test("calibrates Cross-Diff confidence and correlation", () => {
    const report = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput(comparison()));
    assert.ok((report.mostProbableExplanation?.score ?? 0) <= 72);
    assert.ok(report.confidence.evidence <= 68);
    assert.ok(report.confidence.correlation <= 62);
    assert.ok(report.correlationGraph.edges.length < report.evidence.length * 2 + 8);
    assert.strictEqual(report.understandingBundle.version, "understanding-bundle-v2");
    assert.strictEqual(report.understandingBundle.contributions.find((item) => item.type === "crossDiff")?.evidenceReferenceIds.length, 0);
  });

  test("uses provider-owned contributor mapping", () => {
    const report = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput(comparison()));
    assert.strictEqual(report.evidence.find((item) => item.providerId === "attribute-metadata")?.category, "Metadata Evolution");
    assert.strictEqual(report.evidence.find((item) => item.providerId === "workflow")?.category, "Automation Participation");
  });

  test("renders Cross-Diff Mini RCA without Timeline masquerading", () => {
    const report = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput(comparison()));
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    assert.match(markdown, /Cross-Environment Diff/);
    assert.match(markdown, /Cross Diff Understanding/);
    assert.match(markdown, /Timeline Understanding.*Not Applicable/is);
    assert.match(html, /Cross Diff Understanding/);
    assert.match(markdown, /cross-environment difference/i);
    assert.match(markdown, /DEV → TEST/);
    assert.match(html, /cross-environment difference/i);
    assert.match(html, /DEV → TEST/);
    assert.doesNotMatch(markdown, /timeline event/i);
    assert.doesNotMatch(html, /timeline event/i);
    assert.doesNotMatch(report.operationalStory.join(" "), /snapshot/i);
    assert.match(markdown, /Understanding Bundle: understanding-bundle-v2/);
    assert.match(markdown, /Investigation Input: investigation-input-v1/);
    assert.match(html, /DV Quick Run v0\.15\.1/);
    assert.doesNotMatch(html, /Understanding Bundle Contract v0\.14\.7/);
    assert.doesNotMatch(html.split("Evidence Correlation Graph v1")[0], /cross-diff-approved-category-pair/);
    assert.doesNotMatch(markdown.split("## Appendix")[0], /Limiting evidence:/);
    assert.doesNotMatch(markdown.split("## Appendix")[0], /cross-diff:attribute-metadata/);
  });
  test("deduplicates grouped visible observations outside supporting evidence", () => {
    const base = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput(comparison()));
    const candidates = base.evidence.slice(0, 2);
    assert.strictEqual(candidates.length, 2);

    const duplicateTitle = "Shared identity present only in source (2 identity observations)";
    const duplicateIds = new Set(candidates.map((item) => item.id));
    const report = {
      ...base,
      evidence: base.evidence.map((item) => duplicateIds.has(item.id) ? { ...item, title: duplicateTitle } : item),
      evidenceCorrelation: {
        ...base.evidenceCorrelation,
        supportingEvidenceIds: base.evidenceCorrelation.supportingEvidenceIds.filter((id) => !duplicateIds.has(id)),
      },
    };

    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);
    const markdownOtherSection = markdown.split("### Other Relevant Evidence")[1] ?? "";
    const markdownOther = markdownOtherSection
      .split("### Cross-Cutting Environment Context")[0]
      .split("### Confidence Notes")[0];

    const htmlOtherSection = html.split("Show other relevant evidence")[1] ?? "";
    const htmlOther = htmlOtherSection
      .split("Cross-Cutting Environment Context")[0]
      .split("Show confidence notes")[0];

    assert.strictEqual((markdownOther.match(/Shared identity present only in source/g) ?? []).length, 1);
    assert.strictEqual((htmlOther.match(/Shared identity present only in source/g) ?? []).length, 1);
    assert.match(markdown, /Leading-candidate evidence: \d+ observations?/i);
    assert.match(html, /Leading-Candidate Evidence<\/span><strong>\d+ observations?/i);
  });

  test("classifies subject-local and cross-cutting Cross-Diff evidence", () => {
    const report = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput(comparison()));
    assert.strictEqual(report.evidence.find((item) => item.providerId === "attribute-metadata")?.scope, "subject-local");
    assert.strictEqual(report.evidence.find((item) => item.providerId === "workflow")?.scope, "cross-cutting");

    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    // The fixture has one cross-cutting observation and it is selected as
    // supporting evidence. The renderer must not duplicate it in an empty
    // Cross-Cutting Environment Context section.
    assert.doesNotMatch(markdown, /### Cross-Cutting Environment Context/);
    assert.doesNotMatch(html, />Cross-Cutting Environment Context(?:\s|<)/);
  });

  test("renders remaining cross-cutting evidence outside supporting evidence", () => {
    const input = adaptCrossDiffToInvestigationInput(comparison());
    const workflowEvidence = input.evidence.find((item) => item.providerId === "workflow");
    assert.ok(workflowEvidence);

    const additionalEvidence = {
      ...workflowEvidence,
      id: `${workflowEvidence.id}:additional`,
      title: "Additional environment-wide workflow difference",
    };
    const modifiedInput = {
      ...input,
      evidence: [...input.evidence, additionalEvidence],
    };

    const report = buildMiniRcaReportFromInvestigationInput(modifiedInput);
    const markdown = renderMiniRcaReportMarkdown(report);
    const html = renderMiniRcaReportHtml(report);

    assert.match(markdown, /### Cross-Cutting Environment Context/);
    assert.match(html, /Cross-Cutting Environment Context/);
    assert.match(markdown, /Additional environment-wide workflow difference/);
    assert.match(html, /Additional environment-wide workflow difference/);
  });

  test("down-weights relationship presentation drift", () => {
    const base = comparison();
    const relationshipProvider = {
      providerId: "relationship-metadata",
      title: "Relationship Metadata",
      groups: [{
        id: "relationships",
        title: "Relationships",
        summary: "Relationship drift",
        significance: "High" as const,
        differences: Array.from({ length: 40 }, (_, index) => ({
          id: `menu-${index}`,
          title: `Relationship ${index} Associated Menu Configuration changed`,
          summary: "Navigation-only relationship presentation drift.",
          kind: "Changed" as const,
          significance: "High" as const,
          evidence: [],
        })),
      }],
    };
    const report = buildMiniRcaReportFromInvestigationInput(adaptCrossDiffToInvestigationInput({
      ...base,
      providerResults: [...base.providerResults, relationshipProvider],
      summary: { ...base.summary, providerCount: base.summary.providerCount + 1, differenceCount: base.summary.differenceCount + 40, highCount: base.summary.highCount + 40 },
    }));
    const relationship = report.competingExplanations.find((item) => item.category === "Relationship Behaviour");
    assert.ok((relationship?.score ?? 0) < 50);
    assert.ok(report.evidence.filter((item) => item.signalClass === "presentation").length >= 40);
    assert.match(renderMiniRcaReportMarkdown(report), /High-Volume Noise Clusters/);
  });

});
