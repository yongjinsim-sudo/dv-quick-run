import PDFDocument from "pdfkit";
import type { ComparisonDifference } from "../../../core/comparison/index.js";
import type { ComparisonReportFinding, ComparisonReportModel, ComparisonReportProviderDistributionItem } from "./comparisonReportTypes.js";

interface PdfCursor {
  readonly doc: PDFKit.PDFDocument;
  y: number;
}

const pageWidth = 595.28;
const pageHeight = 841.89;
const margin = 42;
const contentWidth = pageWidth - (margin * 2);

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

function stripDataUri(value: string | undefined): Buffer | undefined {
  if (!value) {
    return undefined;
  }

  const marker = ";base64,";
  const markerIndex = value.indexOf(marker);
  const payload = markerIndex >= 0 ? value.slice(markerIndex + marker.length) : value;
  try {
    return Buffer.from(payload, "base64");
  } catch {
    return undefined;
  }
}


function normalizePdfText(value: string): string {
  return value
    .replace(/→/g, "->")
    .replace(/=>/g, "->")
    .replace(/’/g, "'")
    .replace(/“|”/g, '"')
    .replace(/–|—/g, "-");
}

function drawArrowGlyph(doc: PDFKit.PDFDocument, x: number, y: number, size: number, color: string): void {
  const midY = y + (size * 0.43);
  const shaftWidth = Math.max(7, size * 0.7);
  const headSize = Math.max(3, size * 0.22);

  doc.save();
  doc.strokeColor(color).fillColor(color).lineWidth(Math.max(0.9, size * 0.085));
  doc.moveTo(x, midY).lineTo(x + shaftWidth, midY).stroke();
  doc
    .moveTo(x + shaftWidth, midY)
    .lineTo(x + shaftWidth - headSize, midY - headSize)
    .lineTo(x + shaftWidth - headSize, midY + headSize)
    .closePath()
    .fill();
  doc.restore();
}

function pdfText(
  doc: PDFKit.PDFDocument,
  text: string,
  x: number,
  y: number,
  options?: PDFKit.Mixins.TextOptions & { readonly arrowSize?: number; readonly arrowYOffset?: number }
): PDFKit.PDFDocument {
  const normalized = normalizePdfText(text);
  const arrowToken = "->";

  if (!normalized.includes(arrowToken)) {
    return doc.text(normalized, x, y, options);
  }

  const arrowSize = options?.arrowSize ?? 10;
  const arrowYOffset = options?.arrowYOffset ?? 0;
  const arrowAdvance = Math.max(14, arrowSize * 1.12);
  const parts = normalized.split(arrowToken);

  let currentX = x;
  parts.forEach((part, index) => {
    if (part.length > 0) {
      doc.text(part, currentX, y, { lineBreak: false });
      currentX += doc.widthOfString(part);
    }

    if (index < parts.length - 1) {
      drawArrowGlyph(doc, currentX + 4, y + arrowYOffset - 1.25, arrowSize, "#1f2328");
      currentX += arrowAdvance;
    }
  });

  return doc;
}

function pdfTitleText(doc: PDFKit.PDFDocument, text: string, x: number, y: number, options?: PDFKit.Mixins.TextOptions): PDFKit.PDFDocument {
  void options;

  const normalized = normalizePdfText(text);
  const arrowToken = "->";

  if (!normalized.includes(arrowToken)) {
    return doc.text(normalized, x, y, { lineBreak: false });
  }

  const arrowSize = 19;
  const arrowAdvance = 31;
  const parts = normalized.split(arrowToken);

  let currentX = x;
  parts.forEach((part, index) => {
    if (part.length > 0) {
      doc.text(part, currentX, y, { lineBreak: false });
      currentX += doc.widthOfString(part);
    }

    if (index < parts.length - 1) {
      drawArrowGlyph(doc, currentX + 8, y + 0.1, arrowSize, "#1f2328");
      currentX += arrowAdvance;
    }
  });

  return doc;
}

function collectPdf(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function stampPageWatermarkAndFooter(
  doc: PDFKit.PDFDocument,
  pageNumber: number,
  logoBuffer: Buffer | undefined,
  footerText: string
): void {
  if (logoBuffer) {
    doc.save();
    doc.opacity(0.035);
    try {
      doc.image(logoBuffer, (pageWidth - 220) / 2, (pageHeight - 220) / 2, { fit: [220, 220] });
    } catch {
      // Ignore invalid logo data. The footer still identifies the generated report.
    }
    doc.restore();
  }

  doc.save();
  doc.fillColor("#8c959f").font("Helvetica").fontSize(7);
  // Keep footer well above the physical page boundary. PDFKit may create overflow pages if absolute text is too low.
  const footerY = pageHeight - margin - 16;
  pdfText(doc, footerText, margin, footerY, { lineBreak: false, width: contentWidth - 92, height: 10, ellipsis: true });
  pdfText(doc, `Page ${pageNumber}`, margin + contentWidth - 76, footerY, { align: "right", lineBreak: false, width: 76, height: 10 });
  doc.restore();
}

function stampBufferedPages(doc: PDFKit.PDFDocument, logoBuffer: Buffer | undefined, footerText: string): void {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    stampPageWatermarkAndFooter(doc, index - range.start + 1, logoBuffer, footerText);
  }
}

function ensureSpace(cursor: PdfCursor, height: number, logoBuffer: Buffer | undefined, footerText: string): void {
  void logoBuffer;
  void footerText;

  if (cursor.y + height <= pageHeight - margin - 42) {
    return;
  }

  cursor.doc.addPage();
  cursor.y = margin;
}

function section(cursor: PdfCursor, title: string, logoBuffer: Buffer | undefined, footerText: string, minHeight = 64): void {
  ensureSpace(cursor, minHeight, logoBuffer, footerText);
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(14);
  pdfText(cursor.doc, title, margin, cursor.y, { width: contentWidth });
  cursor.y += 20;
}

function paragraph(cursor: PdfCursor, text: string, logoBuffer: Buffer | undefined, footerText: string, options: { readonly color?: string; readonly fontSize?: number; readonly bold?: boolean } = {}): void {
  const fontSize = options.fontSize ?? 10;
  cursor.doc.font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  const height = cursor.doc.heightOfString(normalizePdfText(text), { width: contentWidth, lineGap: 2 });
  ensureSpace(cursor, height + 6, logoBuffer, footerText);
  cursor.doc.fillColor(options.color ?? "#1f2328").font(options.bold ? "Helvetica-Bold" : "Helvetica").fontSize(fontSize);
  pdfText(cursor.doc, text, margin, cursor.y, { width: contentWidth, lineGap: 2 });
  cursor.y += height + 5;
}

function roundedCard(cursor: PdfCursor, height: number, logoBuffer: Buffer | undefined, footerText: string): void {
  ensureSpace(cursor, height, logoBuffer, footerText);
  cursor.doc.roundedRect(margin, cursor.y, contentWidth, height, 10).fillAndStroke("#f6f8fa", "#d0d7de");
}

function metricRow(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  ensureSpace(cursor, 74, logoBuffer, footerText);
  const metrics: ReadonlyArray<readonly [string, string]> = [
    [String(report.highCount), "High significance"],
    [String(report.mediumCount), "Medium significance"],
    [String(report.lowCount), "Low significance"],
    [String(report.differenceCount), "Differences"],
    [String(report.providerCount), "Providers"]
  ];
  const gap = 8;
  const width = (contentWidth - (gap * (metrics.length - 1))) / metrics.length;
  metrics.forEach(([value, label], index) => {
    const x = margin + (index * (width + gap));
    cursor.doc.roundedRect(x, cursor.y, width, 56, 8).fillAndStroke("#f6f8fa", "#d0d7de");
    cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(18);
    pdfText(cursor.doc, value, x + 10, cursor.y + 7, { width: width - 20 });
    cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
    pdfText(cursor.doc, label, x + 10, cursor.y + 29, { width: width - 20 });
  });
  cursor.y += 72;
}

function renderHeader(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined): void {
  const { doc } = cursor;
  doc.roundedRect(margin, cursor.y, contentWidth, 56, 10).fillAndStroke("#ffffff", "#d0d7de");
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, margin + 12, cursor.y + 7, { fit: [34, 34] });
    } catch {
      // Ignore invalid logo data.
    }
  }
  doc.fillColor("#57606a").font("Helvetica").fontSize(9.4);
  pdfText(doc, "DV Quick Run", margin + 54, cursor.y + 12, { width: 160 });
  doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(13);
  pdfText(doc, report.kind === "DiffFindingsSummary" ? "Diff Findings Summary" : "Investigation Handoff", margin + 54, cursor.y + 28, { width: 240 });
  doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
  pdfText(doc, `Generated ${formatDateTime(report.generatedAtIso)}`, margin + 300, cursor.y + 22, { align: "right", width: contentWidth - 312 });
  cursor.y += 78;
}

function renderHero(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  roundedCard(cursor, 122, logoBuffer, footerText);
  cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
  pdfText(cursor.doc, `${report.sourceLabel} -> ${report.targetLabel}`, margin + 12, cursor.y + 15, { width: contentWidth - 24, arrowSize: 8, arrowYOffset: 0.25 });
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(20);
  pdfTitleText(cursor.doc, report.title, margin + 12, cursor.y + 32);
  cursor.doc.fillColor("#1f2328").font("Helvetica").fontSize(10);
  pdfText(cursor.doc, report.subjectLabel ? `Comparison scope: ${report.subjectLabel}` : "Comparison scope not specified", margin + 12, cursor.y + 70, { width: contentWidth - 24 });
  cursor.y += 86;
  metricRow(cursor, report, logoBuffer, footerText);
}

function renderExecutiveSummary(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  section(cursor, report.executiveSummary.heading, logoBuffer, footerText, 96);
  for (const item of report.executiveSummary.paragraphs) {
    paragraph(cursor, item, logoBuffer, footerText);
  }
  for (const item of report.executiveSummary.highlights) {
    paragraph(cursor, `• ${item}`, logoBuffer, footerText, { fontSize: 9 });
  }
  cursor.y += 4;
}

function renderBar(cursor: PdfCursor, label: string, count: number, max: number, color: string): void {
  const x = margin;
  const y = cursor.y;
  const labelWidth = 150;
  const barWidth = contentWidth - labelWidth - 52;
  const fillWidth = max <= 0 ? 0 : Math.max(4, Math.round((count / max) * barWidth));
  cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
  pdfText(cursor.doc, label, x, y, { width: labelWidth, ellipsis: true });
  cursor.doc.roundedRect(x + labelWidth + 8, y + 2, barWidth, 8, 4).fill("#eaeef2");
  cursor.doc.roundedRect(x + labelWidth + 8, y + 2, fillWidth, 8, 4).fill(color);
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.4);
  pdfText(cursor.doc, String(count), x + labelWidth + barWidth + 18, y - 1, { width: 28, align: "right" });
  cursor.y += 19;
}

function renderCharts(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  if (!report.charts) {
    return;
  }
  section(cursor, "Operational drift overview", logoBuffer, footerText, 160);
  paragraph(cursor, "Provider-owned significance classification based on observed operational drift evidence. Use these visuals for investigation orientation, not deployment authority.", logoBuffer, footerText, { color: "#57606a", fontSize: 8 });
  const significance = report.charts.significanceDistribution;
  const significanceMax = Math.max(significance.high, significance.medium, significance.low, 1);
  renderBar(cursor, "High", significance.high, significanceMax, "#cf222e");
  renderBar(cursor, "Medium", significance.medium, significanceMax, "#bf8700");
  renderBar(cursor, "Low", significance.low, significanceMax, "#57606a");
  cursor.y += 8;
  const providerMax = Math.max(...report.charts.providerDistribution.map((item) => item.count), 1);
  for (const item of report.charts.providerDistribution.slice(0, 6)) {
    renderBar(cursor, item.label, item.count, providerMax, "#0969da");
  }
  cursor.y += 8;
}

function renderContext(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  ensureSpace(cursor, 64, logoBuffer, footerText);
  const items: ReadonlyArray<readonly [string, string]> = [
    ["Source captured", formatDateTime(report.sourceCapturedAtIso)],
    ["Target captured", formatDateTime(report.targetCapturedAtIso)],
    ["Source trust", report.snapshotTrust?.sourceTrustState ?? "Not supplied"],
    ["Target trust", report.snapshotTrust?.targetTrustState ?? "Not supplied"]
  ];
  const width = (contentWidth - 24) / 4;
  items.forEach(([label, value], index) => {
    const x = margin + (index * (width + 8));
    cursor.doc.roundedRect(x, cursor.y, width, 44, 8).fillAndStroke("#f6f8fa", "#d0d7de");
    cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.4);
    pdfText(cursor.doc, label, x + 8, cursor.y + 7, { width: width - 16 });
    cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
    pdfText(cursor.doc, value, x + 8, cursor.y + 20, { width: width - 16 });
  });
  cursor.y += 60;
}

function summarizeGroupSignificance(differences: readonly ComparisonDifference[]): string {
  const high = differences.filter((difference) => difference.significance === "High").length;
  const medium = differences.filter((difference) => difference.significance === "Medium").length;
  const low = differences.filter((difference) => difference.significance === "Low").length;
  const parts: string[] = [];

  if (high > 0) {
    parts.push(`${high} high`);
  }

  if (medium > 0) {
    parts.push(`${medium} medium`);
  }

  if (low > 0) {
    parts.push(`${low} low`);
  }

  return parts.length > 0 ? parts.join(", ") : "No classified operational significance";
}

function selectRepresentativeDifferences(differences: readonly ComparisonDifference[]): readonly ComparisonDifference[] {
  const significanceRank = (difference: ComparisonDifference): number => {
    if (difference.significance === "High") {
      return 3;
    }

    if (difference.significance === "Medium") {
      return 2;
    }

    return 1;
  };

  return [...differences]
    .sort((left, right) => significanceRank(right) - significanceRank(left))
    .slice(0, 2);
}

function renderFindings(cursor: PdfCursor, title: string, findings: readonly ComparisonReportFinding[], logoBuffer: Buffer | undefined, footerText: string): void {
  if (title.trim().length > 0) {
    section(cursor, title, logoBuffer, footerText, 96);
  }

  if (findings.length === 0) {
    paragraph(cursor, "No operational drift detected. The selected providers did not return evidence-backed operational differences for the supplied snapshots.", logoBuffer, footerText);
    return;
  }

  for (const finding of findings) {
    cursor.doc.font("Helvetica").fontSize(8.7);
    const summaryHeight = cursor.doc.heightOfString(normalizePdfText(finding.summary), { width: contentWidth - 26, lineGap: 1 });
    const height = Math.max(50, summaryHeight + 34);
    roundedCard(cursor, height, logoBuffer, footerText);

    const color = finding.significance === "High" ? "#cf222e" : finding.significance === "Medium" ? "#bf8700" : "#57606a";
    cursor.doc.rect(margin, cursor.y, 4, height).fill(color);

    cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.5);
    pdfText(cursor.doc, finding.title, margin + 12, cursor.y + 9, { width: contentWidth - 24 });

    cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.4);
    pdfText(cursor.doc, `${finding.groupTitle} · ${finding.kind} · ${finding.significance}`, margin + 12, cursor.y + 23, { width: contentWidth - 24 });

    cursor.doc.fillColor("#1f2328").font("Helvetica").fontSize(8.7);
    pdfText(cursor.doc, finding.summary, margin + 12, cursor.y + 35, { width: contentWidth - 24, lineGap: 1 });

    cursor.y += height + 5;
  }
}

function renderDetailedGroups(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  if (report.kind !== "InvestigationHandoff") {
    return;
  }

  section(cursor, "Grouped operational evidence", logoBuffer, footerText, 96);
  paragraph(
    cursor,
    "This PDF handoff compresses grouped evidence for review readability. Full detailed evidence remains available in the HTML report, JSON export, and Snapshot Library replay.",
    logoBuffer,
    footerText,
    { color: "#57606a", fontSize: 8 }
  );

  for (const group of report.groups) {
    cursor.y += 12;
    paragraph(cursor, group.title, logoBuffer, footerText, { bold: true, fontSize: 12 });
    paragraph(cursor, group.summary, logoBuffer, footerText, { color: "#57606a", fontSize: 9 });
    paragraph(
      cursor,
      `${group.differences.length} observed differences (${summarizeGroupSignificance(group.differences)}). Representative findings shown below.`,
      logoBuffer,
      footerText,
      { color: "#57606a", fontSize: 8 }
    );
    cursor.y += 3;

    for (const difference of selectRepresentativeDifferences(group.differences)) {
      const finding = {
        id: difference.id,
        title: difference.title,
        summary: difference.summary,
        groupTitle: group.title,
        kind: difference.kind,
        significance: difference.significance,
        evidenceCount: difference.evidence.length
      } satisfies ComparisonReportFinding;
      renderFindings(cursor, "", [finding], logoBuffer, footerText);
    }
  }
}

function renderBoundary(cursor: PdfCursor, logoBuffer: Buffer | undefined, footerText: string): void {
  section(cursor, "Verification boundary", logoBuffer, footerText, 104);
  paragraph(cursor, "DVQR observes operational drift and supports verification. This report does not certify root cause, assign blame, approve changes, or perform remediation. Human review remains required before corrective action.", logoBuffer, footerText, { fontSize: 9 });
}

export async function renderComparisonReportPdf(report: ComparisonReportModel): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: true,
    info: {
      Author: "DV Quick Run",
      Creator: "DV Quick Run",
      Subject: report.kind === "DiffFindingsSummary" ? "Diff Findings Summary" : "Investigation Handoff",
      Title: normalizePdfText(report.title)
    },
    layout: "portrait",
    margin,
    size: "A4"
  });
  const output = collectPdf(doc);
  const logoBuffer = stripDataUri(report.watermark.logoDataUri);
  const footerText = report.watermark.footerText;
  const cursor: PdfCursor = { doc, y: margin };
  doc.addPage();
  renderHeader(cursor, report, logoBuffer);
  renderHero(cursor, report, logoBuffer, footerText);
  renderExecutiveSummary(cursor, report, logoBuffer, footerText);
  renderCharts(cursor, report, logoBuffer, footerText);
  renderContext(cursor, report, logoBuffer, footerText);
  renderFindings(cursor, report.kind === "DiffFindingsSummary" ? "Top operational drift findings" : "Outstanding operational verification", report.topFindings, logoBuffer, footerText);
  cursor.y += report.kind === "DiffFindingsSummary" ? 14 : 8;
  renderBoundary(cursor, logoBuffer, footerText);
  renderDetailedGroups(cursor, report, logoBuffer, footerText);
  stampBufferedPages(doc, logoBuffer, footerText);
  doc.end();
  return output;
}
