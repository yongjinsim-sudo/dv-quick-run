import type { ComparisonDifference, ComparisonEvidenceRef } from "../../../core/comparison/index.js";
import type { ComparisonReportFinding, ComparisonReportModel } from "./comparisonReportTypes.js";

function escapeHtml(value: string | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDateTime(value: string | undefined): string {
  if (!value) {
    return "Not captured";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString();
}

function renderMetric(value: number | string, label: string): string {
  return `<div class="dvqr-report-metric"><strong>${escapeHtml(String(value))}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderFindingItem(finding: ComparisonReportFinding): string {
  return `<li class="dvqr-report-finding" data-significance="${escapeHtml(finding.significance)}">
    <div><strong>${escapeHtml(finding.title)}</strong><span>${escapeHtml(finding.groupTitle)} · ${escapeHtml(finding.kind)} · ${escapeHtml(finding.significance)}</span></div>
    <p>${escapeHtml(finding.summary)}</p>
  </li>`;
}

function renderEvidence(evidence: readonly ComparisonEvidenceRef[]): string {
  if (evidence.length === 0) {
    return "";
  }

  return `<ul class="dvqr-report-evidence">${evidence.slice(0, 8).map((item) => `<li><strong>${escapeHtml(item.label)}:</strong> ${escapeHtml(item.value ?? "Observed")} ${item.source ? `<em>${escapeHtml(item.source)}</em>` : ""}</li>`).join("")}</ul>`;
}

function renderDifference(difference: ComparisonDifference): string {
  return `<article class="dvqr-report-difference" data-significance="${escapeHtml(difference.significance)}">
    <h4>${escapeHtml(difference.title)}</h4>
    <p>${escapeHtml(difference.summary)}</p>
    <div class="dvqr-report-difference-meta">${escapeHtml(difference.kind)} · ${escapeHtml(difference.significance)} · ${difference.evidence.length} evidence item${difference.evidence.length === 1 ? "" : "s"}</div>
    ${renderEvidence(difference.evidence)}
  </article>`;
}

function renderExecutiveSummary(report: ComparisonReportModel): string {
  return `<section class="dvqr-report-section dvqr-report-executive-summary">
    <h2>${escapeHtml(report.executiveSummary.heading)}</h2>
    <div class="dvqr-report-executive-copy">
      ${report.executiveSummary.paragraphs.map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`).join("")}
    </div>
    ${report.executiveSummary.highlights.length > 0
      ? `<ul class="dvqr-report-executive-highlights">${report.executiveSummary.highlights.map((highlight) => `<li>${escapeHtml(highlight)}</li>`).join("")}</ul>`
      : ""}
  </section>`;
}

function renderBar(label: string, count: number, max: number, className = ""): string {
  const width = max <= 0 ? 0 : Math.max(4, Math.round((count / max) * 100));
  return `<div class="dvqr-report-bar ${escapeHtml(className)}">
    <span class="dvqr-report-bar-label">${escapeHtml(label)}</span>
    <div class="dvqr-report-bar-track"><div class="dvqr-report-bar-fill" style="width: ${width}%"></div></div>
    <strong>${escapeHtml(String(count))}</strong>
  </div>`;
}

function renderSummaryCharts(report: ComparisonReportModel): string {
  if (!report.charts) {
    return "";
  }

  const significance = report.charts.significanceDistribution;
  const significanceMax = Math.max(significance.high, significance.medium, significance.low, 1);
  const providerMax = Math.max(...report.charts.providerDistribution.map((item) => item.count), 1);

  return `<section class="dvqr-report-section dvqr-report-chart-section">
    <h2>Operational drift orientation</h2>
    <p class="dvqr-report-chart-helper">Provider-owned significance classification based on observed operational drift evidence. Use these visuals for investigation orientation, not deployment authority.</p>
    <div class="dvqr-report-chart-grid">
      <article class="dvqr-report-chart-card">
        <h3>Operational significance distribution</h3>
        ${renderBar("High", significance.high, significanceMax, "is-high")}
        ${renderBar("Medium", significance.medium, significanceMax, "is-medium")}
        ${renderBar("Low", significance.low, significanceMax, "is-low")}
      </article>
      <article class="dvqr-report-chart-card">
        <h3>Provider drift distribution</h3>
        ${report.charts.providerDistribution.length > 0
          ? report.charts.providerDistribution.slice(0, 6).map((item) => renderBar(item.label, item.count, providerMax, "is-provider")).join("")
          : `<p class="dvqr-report-muted">No provider drift distribution to render.</p>`}
      </article>
    </div>
  </section>`;
}

function renderHandoffPosture(report: ComparisonReportModel): string {
  if (report.kind !== "InvestigationHandoff") {
    return "";
  }

  const unresolvedHigh = report.highCount;
  const posture = report.differenceCount === 0
    ? "Quiet comparison result"
    : unresolvedHigh > 0
      ? "External verification required"
      : "Review continuity ready";

  return `<section class="dvqr-report-section dvqr-report-handoff-posture">
    <h2>Investigation posture</h2>
    <div class="dvqr-report-posture-grid">
      <div><strong>${escapeHtml(posture)}</strong><span>Verification posture</span></div>
      <div><strong>${escapeHtml(report.snapshotTrust?.sourceTrustState ?? "Not supplied")}</strong><span>Source trust</span></div>
      <div><strong>${escapeHtml(report.snapshotTrust?.targetTrustState ?? "Not supplied")}</strong><span>Target trust</span></div>
      <div><strong>${escapeHtml(String(report.highCount))}</strong><span>High-significance items for review</span></div>
    </div>
  </section>`;
}

function renderReportBody(report: ComparisonReportModel): string {
  const isSummary = report.kind === "DiffFindingsSummary";
  const noDrift = report.differenceCount === 0;
  const topFindingList = report.topFindings.length > 0
    ? `<ol class="dvqr-report-findings">${report.topFindings.map(renderFindingItem).join("")}</ol>`
    : `<div class="dvqr-report-empty"><strong>No operational drift detected</strong><span>The selected providers did not return evidence-backed operational differences for the supplied snapshots.</span></div>`;

  const detailedGroups = isSummary
    ? ""
    : `<section class="dvqr-report-section">
        <h2>Grouped operational evidence</h2>
        ${report.groups.map((group) => `<section class="dvqr-report-group" data-significance="${escapeHtml(group.significance)}">
          <h3>${escapeHtml(group.title)}</h3>
          <p>${escapeHtml(group.summary)}</p>
          <div class="dvqr-report-difference-list">${group.differences.map(renderDifference).join("")}</div>
        </section>`).join("")}
      </section>`;

  return `<div class="dvqr-report-watermark" aria-hidden="true"></div>
  <main class="dvqr-report-content ${isSummary ? "dvqr-report-summary" : "dvqr-report-handoff"}">
    <header class="dvqr-report-header">
      <div class="dvqr-report-brand">
        ${report.watermark.logoDataUri ? `<img src="${escapeHtml(report.watermark.logoDataUri)}" alt="DV Quick Run logo" />` : ""}
        <div class="dvqr-report-brand-copy"><span>DV Quick Run</span><strong>${escapeHtml(isSummary ? "Diff Findings Summary" : "Investigation Handoff")}</strong></div>
      </div>
      <div class="dvqr-report-generated">Generated ${escapeHtml(formatDateTime(report.generatedAtIso))}</div>
    </header>

    <section class="dvqr-report-hero">
      <p class="dvqr-report-eyebrow">${escapeHtml(report.sourceLabel)} → ${escapeHtml(report.targetLabel)}</p>
      <h1>${escapeHtml(report.title)}</h1>
      <p>${escapeHtml(report.subjectLabel ? `Comparison scope: ${report.subjectLabel}` : "Comparison scope not specified")}</p>
      <div class="dvqr-report-metrics">
        ${renderMetric(report.highCount, "High significance")}
        ${renderMetric(report.mediumCount, "Medium significance")}
        ${renderMetric(report.lowCount, "Low significance")}
        ${renderMetric(report.differenceCount, "Differences")}
        ${renderMetric(report.providerCount, "Providers")}
      </div>
    </section>

    ${renderExecutiveSummary(report)}
    ${renderSummaryCharts(report)}
    ${renderHandoffPosture(report)}

    <section class="dvqr-report-section dvqr-report-context-grid">
      <div><strong>Source captured</strong><span>${escapeHtml(formatDateTime(report.sourceCapturedAtIso))}</span></div>
      <div><strong>Target captured</strong><span>${escapeHtml(formatDateTime(report.targetCapturedAtIso))}</span></div>
      <div><strong>Source trust</strong><span>${escapeHtml(report.snapshotTrust?.sourceTrustState ?? "Not supplied")}</span></div>
      <div><strong>Target trust</strong><span>${escapeHtml(report.snapshotTrust?.targetTrustState ?? "Not supplied")}</span></div>
    </section>

    <section class="dvqr-report-section">
      <h2>${escapeHtml(noDrift ? "Observed result" : isSummary ? "Top operational drift findings" : "Outstanding operational verification")}</h2>
      ${topFindingList}
    </section>

    <section class="dvqr-report-section dvqr-report-boundary">
      <h2>Verification boundary</h2>
      <p>DVQR observes operational drift and supports verification. This report does not certify root cause, assign blame, approve changes, or perform remediation. Human review remains required before corrective action.</p>
    </section>

    ${detailedGroups}

    <footer class="dvqr-report-footer">${escapeHtml(report.watermark.footerText)}</footer>
  </main>`;
}

function renderReportStyles(report: ComparisonReportModel): string {
  const watermarkLogo = report.watermark.logoDataUri ? `background-image: url('${report.watermark.logoDataUri.replace(/'/g, "%27")}');` : "";
  return `:root { color-scheme: light; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color: #1f2328; background: #f7f8fa; }
body { margin: 0; background: #f7f8fa; }
.dvqr-report-watermark { ${watermarkLogo} background-position: center 48%; background-repeat: no-repeat; background-size: 420px auto; inset: 0; opacity: 0.04; pointer-events: none; position: fixed; z-index: 0; }
.dvqr-report-content { box-sizing: border-box; margin: 0 auto; max-width: 980px; min-height: 100vh; padding: 18px 32px 32px; position: relative; z-index: 1; }
.dvqr-report-header, .dvqr-report-hero, .dvqr-report-section { background: rgba(255,255,255,0.94); border: 1px solid #d0d7de; border-radius: 14px; box-shadow: 0 8px 28px rgba(31,35,40,0.06); margin-bottom: 18px; padding: 18px; }
.dvqr-report-header { align-items: center; display: flex; gap: 16px; justify-content: space-between; min-height: 48px; padding: 12px 18px; }
.dvqr-report-brand { align-items: center; display: flex; gap: 12px; }
.dvqr-report-brand img { border-radius: 9px; height: 40px; width: 40px; }
.dvqr-report-brand-copy { display: grid; gap: 2px; line-height: 1.15; }
.dvqr-report-brand-copy strong { font-size: 16px; }
.dvqr-report-brand span, .dvqr-report-eyebrow, .dvqr-report-generated, .dvqr-report-metric span, .dvqr-report-context-grid span, .dvqr-report-difference-meta, .dvqr-report-evidence em, .dvqr-report-empty span, .dvqr-report-muted { color: #57606a; font-size: 12px; }
h1 { font-size: 28px; line-height: 1.15; margin: 6px 0 8px; }
h2 { font-size: 18px; margin: 0 0 12px; }
h3 { font-size: 16px; margin: 0 0 10px; }
h4 { font-size: 14px; margin: 0 0 6px; }
p { line-height: 1.5; margin: 0; }
.dvqr-report-metrics, .dvqr-report-context-grid, .dvqr-report-posture-grid { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); margin-top: 16px; }
.dvqr-report-metric, .dvqr-report-context-grid div, .dvqr-report-posture-grid div { background: #f6f8fa; border: 1px solid #d8dee4; border-radius: 10px; display: grid; gap: 4px; padding: 12px; }
.dvqr-report-metric strong { font-size: 24px; }
.dvqr-report-executive-summary { border-left: 4px solid #0969da; }
.dvqr-report-executive-copy { display: grid; gap: 10px; }
.dvqr-report-executive-highlights { display: grid; gap: 6px; margin: 14px 0 0; padding-left: 20px; }
.dvqr-report-chart-helper { color: #57606a; font-size: 12px; line-height: 1.45; margin: -4px 0 14px; }
.dvqr-report-chart-grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); }
.dvqr-report-chart-card { background: #f6f8fa; border: 1px solid #d8dee4; border-radius: 10px; padding: 14px; }
.dvqr-report-bar { align-items: center; display: grid; gap: 10px; grid-template-columns: minmax(100px, 170px) minmax(120px, 1fr) 36px; margin: 9px 0; }
.dvqr-report-bar-label { color: #57606a; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dvqr-report-bar-track { background: #eaeef2; border-radius: 999px; height: 10px; overflow: hidden; }
.dvqr-report-bar-fill { background: #8c959f; border-radius: 999px; height: 100%; }
.dvqr-report-bar.is-high .dvqr-report-bar-fill { background: #cf222e; }
.dvqr-report-bar.is-medium .dvqr-report-bar-fill { background: #bf8700; }
.dvqr-report-bar.is-low .dvqr-report-bar-fill { background: #57606a; }
.dvqr-report-bar.is-provider .dvqr-report-bar-fill { background: #0969da; }
.dvqr-report-findings, .dvqr-report-difference-list { display: grid; gap: 10px; margin: 0; padding: 0; }
.dvqr-report-finding, .dvqr-report-difference, .dvqr-report-group, .dvqr-report-empty { background: #f6f8fa; border: 1px solid #d8dee4; border-left: 4px solid #8c959f; border-radius: 10px; display: grid; gap: 6px; list-style: none; padding: 12px; }
[data-significance="High"] { border-left-color: #cf222e; }
[data-significance="Medium"] { border-left-color: #bf8700; }
[data-significance="Low"] { border-left-color: #57606a; }
.dvqr-report-finding span { color: #57606a; display: block; font-size: 12px; margin-top: 2px; }
.dvqr-report-group { margin-bottom: 14px; }
.dvqr-report-evidence { color: #57606a; display: grid; font-size: 12px; gap: 4px; margin: 4px 0 0; padding-left: 18px; }
.dvqr-report-boundary { border-left: 4px solid #0969da; }
.dvqr-report-handoff .dvqr-report-chart-section { display: none; }
.dvqr-report-footer { color: #57606a; font-size: 11px; line-height: 1.45; padding: 12px 4px 0; text-align: center; }
@media print { body { background: #fff; } .dvqr-report-content { max-width: none; padding: 12mm 18mm 18mm; } .dvqr-report-header, .dvqr-report-hero, .dvqr-report-section { break-inside: avoid; box-shadow: none; } .dvqr-report-summary .dvqr-report-section { margin-bottom: 10px; padding: 14px; } @page { margin: 12mm; } }`;
}

export function renderComparisonReportHtml(report: ComparisonReportModel): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(report.title)}</title>
  <style>${renderReportStyles(report)}</style>
</head>
<body>
  ${renderReportBody(report)}
</body>
</html>`;
}
