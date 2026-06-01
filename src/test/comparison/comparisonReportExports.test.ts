import * as assert from "assert";
import type { ComparisonViewModel } from "../../core/comparison/index.js";
import { buildComparisonReportModel } from "../../product/comparison/reports/comparisonReportBuilder.js";
import { renderComparisonReportHtml } from "../../product/comparison/reports/comparisonReportHtmlRenderer.js";
import { renderComparisonReportPdf } from "../../product/comparison/reports/comparisonReportPdfRenderer.js";

function buildModel(): ComparisonViewModel {
  return {
    title: "Cross-Environment Diff: DEV → SIT",
    summary: {
      sourceLabel: "DEV",
      targetLabel: "SIT",
      highCount: 1,
      mediumCount: 0,
      lowCount: 0,
      providerCount: 1,
      differenceCount: 1,
      subjectLabel: "Account",
      sourceCapturedAtIso: "2026-05-31T10:00:00.000Z",
      targetCapturedAtIso: "2026-05-31T11:00:00.000Z"
    },
    snapshotTrust: {
      sourceTrustState: "Verified",
      targetTrustState: "Verified"
    },
    groups: [
      {
        id: "plugin-runtime",
        title: "Plugin Step Runtime Behaviour Drift",
        summary: "Plugin step registrations differ between snapshots.",
        significance: "High",
        differences: [
          {
            id: "plugin-state",
            title: "Account Create Validation plugin disabled",
            summary: "Plugin state differs between source and target.",
            kind: "State Drift",
            significance: "High",
            evidence: [
              { label: "Plugin step", value: "Account Create Validation", source: "both" }
            ]
          }
        ]
      }
    ],
    providerResults: []
  };
}

suite("comparison report exports", () => {
  test("renders watermarked diff findings summary html without authority language", () => {
    const report = buildComparisonReportModel("DiffFindingsSummary", buildModel(), {
      generatedAt: new Date("2026-05-31T12:00:00.000Z"),
      watermarkLogoDataUri: "data:image/png;base64,dvqr-logo"
    });

    const html = renderComparisonReportHtml(report);

    assert.match(html, /Diff Findings Summary/);
    assert.match(html, /background-image: url\('data:image\/png;base64,dvqr-logo'\)/);
    assert.match(html, /Account Create Validation plugin disabled/);
    assert.match(html, /Executive Summary/);
    assert.match(html, /Operational significance distribution/);
    assert.match(html, /Provider drift distribution/);
    assert.match(html, /Provider-owned significance classification based on observed operational drift evidence/);
    assert.match(html, /DVQR observes operational drift and supports verification/);
    assert.doesNotMatch(html, /certified|approved|signed off|root cause confirmed/i);
  });

  test("renders investigation handoff with grouped evidence", () => {
    const report = buildComparisonReportModel("InvestigationHandoff", buildModel(), {
      generatedAt: new Date("2026-05-31T12:00:00.000Z")
    });

    const html = renderComparisonReportHtml(report);

    assert.match(html, /Investigation Handoff/);
    assert.match(html, /Executive Handoff Summary/);
    assert.match(html, /Investigation posture/);
    assert.match(html, /Grouped operational evidence/);
    assert.doesNotMatch(html, /Operational significance distribution/);
    assert.match(html, /Plugin Step Runtime Behaviour Drift/);
    assert.match(html, /Account Create Validation/);
  });

  test("renders no-drift summary honestly", () => {
    const noDrift: ComparisonViewModel = {
      title: "Timeline Diff: DEV · Task",
      summary: {
        sourceLabel: "DEV · Task source",
        targetLabel: "DEV · Task target",
        highCount: 0,
        mediumCount: 0,
        lowCount: 0,
        providerCount: 5,
        differenceCount: 0,
        subjectLabel: "Task"
      },
      groups: [],
      providerResults: []
    };

    const html = renderComparisonReportHtml(buildComparisonReportModel("DiffFindingsSummary", noDrift));

    assert.match(html, /No operational drift detected/);
    assert.match(html, /DVQR did not observe evidence-backed operational drift/);
    assert.match(html, /selected providers did not return evidence-backed operational differences/);
  });

  test("renders diff findings summary pdf", async () => {
    const report = buildComparisonReportModel("DiffFindingsSummary", buildModel(), {
      generatedAt: new Date("2026-05-31T12:00:00.000Z")
    });

    const pdf = await renderComparisonReportPdf(report);

    assert.ok(pdf.length > 1000);
    assert.strictEqual(pdf.subarray(0, 4).toString("utf8"), "%PDF");
  });

  test("renders investigation handoff pdf", async () => {
    const report = buildComparisonReportModel("InvestigationHandoff", buildModel(), {
      generatedAt: new Date("2026-05-31T12:00:00.000Z")
    });

    const pdf = await renderComparisonReportPdf(report);

    assert.ok(pdf.length > 1000);
    assert.strictEqual(pdf.subarray(0, 4).toString("utf8"), "%PDF");
  });

});
