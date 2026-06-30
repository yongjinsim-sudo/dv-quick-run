import PDFDocument from "pdfkit";
import type { ComparisonDifference } from "../../../core/comparison/index.js";
import type { ComparisonReportFinding, ComparisonReportModel, ComparisonReportProviderDistributionItem } from "./comparisonReportTypes.js";
import { auditEvidenceCompactReportLines } from "../../audit/auditEvidenceReportSummary.js";
import { reconstructionArtifactIntro, toReconstructionArtifactCandidateViewModel } from "../../reconstruction/reconstructionArtifactReference.js";

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
    // Preserve the DVQR report typography invariant: report-facing direction/change
    // text uses the real arrow glyph. Earlier PDF wrapping work normalized arrows
    // to ASCII `->` to avoid inline glyph drawing in wrapped text, but that leaked
    // into visible report output. Keep ASCII compatibility inputs, but normalize
    // them back to the canonical report arrow.
    .replace(/\s*=>\s*/g, " → ")
    .replace(/\s*->\s*/g, " → ")
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
  const arrowToken = "→";

  if (!normalized.includes(arrowToken)) {
    return doc.text(normalized, x, y, options);
  }

  const arrowSize = options?.arrowSize ?? 10;
  const arrowYOffset = options?.arrowYOffset ?? 0;
  const arrowAdvance = Math.max(14, arrowSize * 1.12);

  // PDFKit's built-in Helvetica encoding does not reliably render the Unicode
  // arrow glyph. Draw arrows as vector glyphs instead of relying on font support.
  // The first implementation only did this for no-width labels; wrapped report
  // cards still fell back to visible ASCII `->`. This lightweight wrapper keeps
  // the arrow typography invariant while still allowing report text to wrap.
  if (options?.width !== undefined && options.lineBreak !== false) {
    const width = options.width;
    const lineGap = options.lineGap ?? 0;
    const lineHeight = doc.currentLineHeight(true) + lineGap;
    const tokens = normalized.split(/(→|\s+)/).filter((token) => token.length > 0);
    let currentX = x;
    let currentY = y;

    const moveToNextLine = () => {
      currentX = x;
      currentY += lineHeight;
    };

    for (const token of tokens) {
      if (token === arrowToken) {
        if (currentX + arrowAdvance > x + width) {
          moveToNextLine();
        }
        drawArrowGlyph(doc, currentX + 4, currentY + arrowYOffset - 1.25, arrowSize, "#1f2328");
        currentX += arrowAdvance;
        continue;
      }

      if (/^\s+$/.test(token)) {
        const spaceWidth = doc.widthOfString(" ");
        if (currentX + spaceWidth <= x + width) {
          currentX += spaceWidth;
        }
        continue;
      }

      const tokenWidth = doc.widthOfString(token);
      if (currentX > x && currentX + tokenWidth > x + width) {
        moveToNextLine();
      }
      doc.text(token, currentX, currentY, { lineBreak: false });
      currentX += tokenWidth;
    }

    return doc;
  }

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
  const normalized = normalizePdfText(text);
  return doc.text(normalized, x, y, {
    width: contentWidth - ((x - margin) * 2),
    lineBreak: true,
    ...options
  });
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
  pdfText(cursor.doc, `${report.sourceLabel} → ${report.targetLabel}`, margin + 12, cursor.y + 15, { width: contentWidth - 24, arrowSize: 8, arrowYOffset: 0.25 });
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(20);
  pdfTitleText(cursor.doc, report.kind === "DiffFindingsSummary" ? "Diff Findings Summary" : "Investigation Handoff", margin + 12, cursor.y + 32, { width: contentWidth - 24 });
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

function parseRelationshipFindingTitle(title: string): { readonly action: string; readonly schemaName: string; readonly direction: string; readonly relationshipType: string } | undefined {
  const match = /^Relationship\s+([^:]+):\s+([^()]+?)\s*\(([^,]+),\s*([^)]+)\)/i.exec(title.trim());
  if (!match) {
    return undefined;
  }

  return {
    action: `Relationship ${match[1].trim()}`,
    schemaName: match[2].trim(),
    direction: match[3].trim(),
    relationshipType: match[4].trim()
  };
}

function compactRelationshipFindingSummary(finding: ComparisonReportFinding): string {
  const kind = finding.kind.toLowerCase();
  if (kind.includes("removed")) {
    return "Observed only in the source snapshot. Missing in the target snapshot. External verification recommended.";
  }

  if (kind.includes("added")) {
    return "Observed only in the target snapshot. Missing in the source snapshot. External verification recommended.";
  }

  return "Relationship metadata differs across snapshots. Review the captured schema evidence externally before drawing deployment or remediation conclusions.";
}

function drawFindingCardBackground(cursor: PdfCursor, height: number, significance: ComparisonReportFinding["significance"], logoBuffer: Buffer | undefined, footerText: string): void {
  roundedCard(cursor, height, logoBuffer, footerText);
  const color = significance === "High" ? "#cf222e" : significance === "Medium" ? "#bf8700" : "#57606a";
  cursor.doc.rect(margin, cursor.y, 4, height).fill(color);
}

function renderRelationshipFinding(cursor: PdfCursor, finding: ComparisonReportFinding, relationship: NonNullable<ReturnType<typeof parseRelationshipFindingTitle>>, logoBuffer: Buffer | undefined, footerText: string): void {
  const innerX = margin + 12;
  const innerWidth = contentWidth - 24;
  const summary = compactRelationshipFindingSummary(finding);

  cursor.doc.font("Helvetica-Bold").fontSize(9.7);
  const actionHeight = cursor.doc.heightOfString(normalizePdfText(relationship.action), { width: innerWidth, lineGap: 1 });
  cursor.doc.font("Helvetica-Bold").fontSize(9.3);
  const schemaHeight = cursor.doc.heightOfString(normalizePdfText(relationship.schemaName), { width: innerWidth, lineGap: 1 });
  cursor.doc.font("Helvetica").fontSize(8.5);
  const metaHeight = cursor.doc.heightOfString(normalizePdfText(`${finding.groupTitle} · ${finding.kind} · ${finding.significance}`), { width: innerWidth, lineGap: 1 });
  const detailGap = 8;
  const detailColumnWidth = (innerWidth - detailGap) / 2;
  cursor.doc.font("Helvetica").fontSize(8.4);
  const directionLabelHeight = cursor.doc.heightOfString("Direction", { width: detailColumnWidth, lineGap: 1 });
  cursor.doc.font("Helvetica-Bold").fontSize(8.5);
  const directionValueHeight = cursor.doc.heightOfString(normalizePdfText(relationship.direction), { width: detailColumnWidth, lineGap: 1 });
  cursor.doc.font("Helvetica").fontSize(8.4);
  const typeLabelHeight = cursor.doc.heightOfString("Type", { width: detailColumnWidth, lineGap: 1 });
  cursor.doc.font("Helvetica-Bold").fontSize(8.5);
  const typeValueHeight = cursor.doc.heightOfString(normalizePdfText(relationship.relationshipType), { width: detailColumnWidth, lineGap: 1 });
  const detailHeight = Math.max(directionLabelHeight + directionValueHeight, typeLabelHeight + typeValueHeight) + 2;
  cursor.doc.font("Helvetica").fontSize(8.7);
  const summaryHeight = cursor.doc.heightOfString(normalizePdfText(summary), { width: innerWidth, lineGap: 1 });
  const height = Math.max(68, actionHeight + schemaHeight + metaHeight + detailHeight + summaryHeight + 30);

  drawFindingCardBackground(cursor, height, finding.significance, logoBuffer, footerText);

  let y = cursor.y + 8;
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.7);
  pdfText(cursor.doc, relationship.action, innerX, y, { width: innerWidth, lineGap: 1 });
  y += actionHeight + 2;

  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.3);
  pdfText(cursor.doc, relationship.schemaName, innerX, y, { width: innerWidth, lineGap: 1 });
  y += schemaHeight + 3;

  cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.5);
  pdfText(cursor.doc, `${finding.groupTitle} · ${finding.kind} · ${finding.significance}`, innerX, y, { width: innerWidth, lineGap: 1 });
  y += metaHeight + 6;

  const detailY = y;
  const details: Array<[string, string]> = [["Direction", relationship.direction], ["Type", relationship.relationshipType]];
  details.forEach(([label, value], index) => {
    const x = innerX + (index * (detailColumnWidth + detailGap));
    cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.0);
    pdfText(cursor.doc, label, x, detailY, { width: detailColumnWidth, lineGap: 1 });
    cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(8.5);
    pdfText(cursor.doc, value, x, detailY + 9, { width: detailColumnWidth, lineGap: 1 });
  });
  y += detailHeight + 5;

  cursor.doc.fillColor("#1f2328").font("Helvetica").fontSize(8.7);
  pdfText(cursor.doc, summary, innerX, y, { width: innerWidth, lineGap: 1 });

  cursor.y += height + 6;
}

function renderGenericFinding(cursor: PdfCursor, finding: ComparisonReportFinding, logoBuffer: Buffer | undefined, footerText: string): void {
  const innerX = margin + 12;
  const innerWidth = contentWidth - 24;

  cursor.doc.font("Helvetica-Bold").fontSize(9.5);
  const titleHeight = cursor.doc.heightOfString(normalizePdfText(finding.title), { width: innerWidth, lineGap: 1 });
  cursor.doc.font("Helvetica").fontSize(8.4);
  const metaHeight = cursor.doc.heightOfString(normalizePdfText(`${finding.groupTitle} · ${finding.kind} · ${finding.significance}`), { width: innerWidth, lineGap: 1 });
  cursor.doc.font("Helvetica").fontSize(8.7);
  const summaryHeight = cursor.doc.heightOfString(normalizePdfText(finding.summary), { width: innerWidth, lineGap: 1 });
  const height = Math.max(58, titleHeight + metaHeight + summaryHeight + 30);

  drawFindingCardBackground(cursor, height, finding.significance, logoBuffer, footerText);

  let y = cursor.y + 9;
  cursor.doc.fillColor("#1f2328").font("Helvetica-Bold").fontSize(9.5);
  pdfText(cursor.doc, finding.title, innerX, y, { width: innerWidth, lineGap: 1 });
  y += titleHeight + 4;

  cursor.doc.fillColor("#57606a").font("Helvetica").fontSize(8.4);
  pdfText(cursor.doc, `${finding.groupTitle} · ${finding.kind} · ${finding.significance}`, innerX, y, { width: innerWidth, lineGap: 1 });
  y += metaHeight + 5;

  cursor.doc.fillColor("#1f2328").font("Helvetica").fontSize(8.7);
  pdfText(cursor.doc, finding.summary, innerX, y, { width: innerWidth, lineGap: 1 });

  cursor.y += height + 6;
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
    const relationship = parseRelationshipFindingTitle(finding.title);
    if (relationship) {
      renderRelationshipFinding(cursor, finding, relationship, logoBuffer, footerText);
      continue;
    }

    renderGenericFinding(cursor, finding, logoBuffer, footerText);
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

function renderAuditEvidenceSummary(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  if ((report.auditEvidenceResults ?? []).length === 0) {
    return;
  }
  section(cursor, "Audit Evidence Summary", logoBuffer, footerText, 104);
  paragraph(cursor, "Audit evidence shown here was explicitly queried in the interactive investigation surface before export. Audit evidence enriches findings; it does not establish causality, deployment correctness, remediation status, or operational authority.", logoBuffer, footerText, { fontSize: 8.7 });
  for (const result of (report.auditEvidenceResults ?? []).slice(0, 6)) {
    cursor.y += 5;
    const lines = auditEvidenceCompactReportLines(result, 2);
    for (const line of lines) {
      paragraph(cursor, line, logoBuffer, footerText, { fontSize: line === result.title || line.startsWith("Record ") ? 8.2 : 7.3, bold: line === result.title || line.startsWith("Record "), color: line === result.title ? "#1f2328" : "#57606a" });
    }
  }
  paragraph(cursor, "Audit payload interpretation is experimental. Raw payloads are preserved in HTML exports and can be submitted through Feedback as edge cases.", logoBuffer, footerText, { fontSize: 7.8, color: "#57606a" });
}


function renderReconstructionArtifacts(cursor: PdfCursor, report: ComparisonReportModel, logoBuffer: Buffer | undefined, footerText: string): void {
  const artifacts = report.reconstructionArtifacts ?? [];
  if (artifacts.length === 0) {
    return;
  }
  section(cursor, "Reconstruction Artifacts", logoBuffer, footerText, 132);
  paragraph(cursor, reconstructionArtifactIntro, logoBuffer, footerText, { fontSize: 8.7, color: "#57606a" });

  const renderField = (label: string, value: string, x: number, y: number, width: number): number => {
    const safeLabel = normalizePdfText(label);
    const safeValue = normalizePdfText(value);
    const labelWidth = Math.min(76, cursor.doc.font("Helvetica-Bold").fontSize(8).widthOfString(`${safeLabel}: `) + 2);
    cursor.doc.font("Helvetica-Bold").fontSize(8).fillColor("#1f2328");
    pdfText(cursor.doc, `${safeLabel}:`, x, y, { lineBreak: false });
    cursor.doc.font("Helvetica").fontSize(8).fillColor("#57606a");
    const valueX = x + labelWidth;
    const valueWidth = Math.max(40, width - labelWidth);
    const height = cursor.doc.heightOfString(safeValue, { width: valueWidth, lineGap: 1 });
    pdfText(cursor.doc, safeValue, valueX, y, { width: valueWidth, lineGap: 1 });
    return Math.max(10, height);
  };

  for (const artifact of artifacts.slice(0, 8)) {
    const candidate = toReconstructionArtifactCandidateViewModel(artifact);
    const operationMatch = candidate.reason.match(/(?:^|·\s*)Operation:\s*(.+)$/);
    const operationLabel = operationMatch?.[1]?.replace(/\s*\(1\)$/, "") ?? "Reconstruction";
    const reasonLabel = candidate.reason.replace(/\s*·\s*Operation:\s*.+$/, "").trim();
    const leftRows: ReadonlyArray<readonly [string, string | undefined]> = [
      ["Component", candidate.utilityId === "DVEVM" ? "Environment Variable" : candidate.entityLabel],
      [candidate.utilityId === "DVEVM" ? "Variable" : "Attribute", candidate.attributeLabel],
      ["Artifact", candidate.artifactFileName]
    ];
    const rightRows: ReadonlyArray<readonly [string, string]> = [
      ["Reason", reasonLabel],
      ["Operation", operationLabel],
      ["Support", candidate.support]
    ];

    const innerWidth = contentWidth - 28;
    const leftWidth = 310;
    const columnGap = 22;
    const rightWidth = innerWidth - leftWidth - columnGap;
    const rowGap = 7;
    const titleHeight = 16;
    const measureRows = (rows: ReadonlyArray<readonly [string, string | undefined]>, width: number): number => rows.reduce((sum, [label, value]) => {
      if (!value) {
        return sum;
      }
      const labelWidth = Math.min(76, cursor.doc.font("Helvetica-Bold").fontSize(8).widthOfString(`${normalizePdfText(label)}: `) + 2);
      const valueWidth = Math.max(40, width - labelWidth);
      const height = cursor.doc.font("Helvetica").fontSize(8).heightOfString(normalizePdfText(value), { width: valueWidth, lineGap: 1 });
      return sum + Math.max(10, height) + rowGap;
    }, 0);

    const bodyHeight = Math.max(measureRows(leftRows, leftWidth), measureRows(rightRows, rightWidth));
    const descriptionHeight = cursor.doc.font("Helvetica").fontSize(7.3).heightOfString(normalizePdfText(candidate.description), { width: innerWidth, lineGap: 1 });
    const cardHeight = Math.max(112, 12 + titleHeight + 12 + bodyHeight + 8 + descriptionHeight + 16);

    roundedCard(cursor, cardHeight, logoBuffer, footerText);
    const cardTop = cursor.y;
    const x = margin + 14;
    const titleY = cardTop + 12;
    cursor.doc.font("Helvetica-Bold").fontSize(10).fillColor("#1f2328");
    pdfText(cursor.doc, normalizePdfText(candidate.candidateTitle), x, titleY, { width: innerWidth });

    let leftY = titleY + titleHeight + 10;
    for (const [label, value] of leftRows) {
      if (!value) {
        continue;
      }
      const height = renderField(label, value, x, leftY, leftWidth);
      leftY += height + rowGap;
    }

    let rightY = titleY + titleHeight + 10;
    const rightX = x + leftWidth + columnGap;
    for (const [label, value] of rightRows) {
      const height = renderField(label, value, rightX, rightY, rightWidth);
      rightY += height + rowGap;
    }

    const descriptionY = cardTop + cardHeight - descriptionHeight - 14;
    cursor.doc.font("Helvetica").fontSize(7.3).fillColor("#57606a");
    pdfText(cursor.doc, normalizePdfText(candidate.description), x, descriptionY, { width: innerWidth, lineGap: 1 });
    cursor.y += cardHeight + 14;
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
  if (report.kind === "DiffFindingsSummary" && report.topFindings.length > 0) {
    cursor.doc.addPage();
    cursor.y = margin;
  }
  renderFindings(cursor, report.kind === "DiffFindingsSummary" ? "Top operational drift findings" : "Outstanding operational verification", report.topFindings, logoBuffer, footerText);
  cursor.y += report.kind === "DiffFindingsSummary" ? 14 : 8;
  renderAuditEvidenceSummary(cursor, report, logoBuffer, footerText);
  renderReconstructionArtifacts(cursor, report, logoBuffer, footerText);
  renderBoundary(cursor, logoBuffer, footerText);
  renderDetailedGroups(cursor, report, logoBuffer, footerText);
  stampBufferedPages(doc, logoBuffer, footerText);
  doc.end();
  return output;
}
