import type { AuditEvidenceRecord, AuditEvidenceResult } from "./auditEvidenceTypes.js";

export function formatAuditEvidenceDate(value: string | undefined): string {
  if (!value) {
    return "Not captured";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function auditEvidenceOperationLabel(record: AuditEvidenceRecord): string {
  if (record.action && record.operation && record.action !== record.operation) {
    return `${record.operation} / ${record.action}`;
  }
  return record.operation ?? record.action ?? "Not captured";
}

export function auditEvidenceRecordSummary(record: AuditEvidenceRecord): readonly string[] {
  const operation = auditEvidenceOperationLabel(record);
  const actor = record.changedBy ?? record.userId ?? "Unknown actor";
  const base = [`${formatAuditEvidenceDate(record.recordedAtIso)} · ${operation} · ${actor}`];
  if (record.kind === "AssociationChange") {
    return [
      ...base,
      `Audit type: Security / relationship association`,
      record.relationshipName ? `Relationship: ${record.relationshipName}` : "Relationship: Not parsed from audit payload",
      record.relatedEntityLogicalName ? `Related entity: ${record.relatedEntityLogicalName}` : "Related entity: Not parsed from audit payload",
      record.relatedRecordId ? `Related record: ${record.relatedRecordId}` : "Related record: Not parsed from audit payload",
      record.objectTypeCode || record.objectId ? `Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}` : "Object: Not captured",
      "Interpretation: Partially interpreted from Dataverse association audit payload.",
    ];
  }
  if (record.kind === "Raw") {
    return [
      ...base,
      "Audit type: Raw / partially interpreted payload",
      record.attributeMask ? `Attribute mask: ${record.attributeMask}` : "Attribute mask: Not captured",
      record.objectTypeCode || record.objectId ? `Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}` : "Object: Not captured",
      "Interpretation: DVQR could not confidently classify this audit payload. Raw evidence is preserved in HTML exports.",
    ];
  }
  return [
    ...base,
    record.changedAttributeLogicalName ? `Changed attribute: ${record.changedAttributeLogicalName}` : "Changed attribute: Not parsed from audit payload",
    `Old value: ${record.oldValue ?? "Not parsed from audit payload"}`,
    `New value: ${record.newValue ?? "Not parsed from audit payload"}`,
    record.attributeMask ? `Attribute mask: ${record.attributeMask}` : "Attribute mask: Not captured",
    record.objectTypeCode || record.objectId ? `Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}` : "Object: Not captured",
  ];
}

export function auditEvidenceResultSummaryLines(result: AuditEvidenceResult): readonly string[] {
  const lines = [
    result.title,
    result.summary,
    `Audit window: ${formatAuditEvidenceDate(result.interval.fromCapturedAtIso)} → ${formatAuditEvidenceDate(result.interval.toCapturedAtIso)}`,
  ];
  const recordLines = result.records.flatMap((record, index) => [
    `Record ${index + 1}:`,
    ...auditEvidenceRecordSummary(record).map((line) => `  ${line}`),
  ]);
  const warningLines = result.warning ? [`Warning: ${result.warning}`] : [];
  return [...lines, ...recordLines, ...warningLines];
}

export function auditEvidenceCompactReportLines(result: AuditEvidenceResult, maxRecords = 2): readonly string[] {
  const lines: string[] = [
    result.title,
    result.summary,
    `Audit window: ${formatAuditEvidenceDate(result.interval.fromCapturedAtIso)} → ${formatAuditEvidenceDate(result.interval.toCapturedAtIso)}`,
  ];
  const records = result.records.slice(0, Math.max(0, maxRecords));
  for (const [index, record] of records.entries()) {
    const operation = auditEvidenceOperationLabel(record);
    const actor = record.changedBy ?? record.userId ?? "Unknown actor";
    lines.push(`Record ${index + 1}: ${formatAuditEvidenceDate(record.recordedAtIso)} · ${operation} · ${actor}`);
    if (record.kind === "AssociationChange") {
      lines.push("Audit type: Security / relationship association");
      if (record.relationshipName) {
        lines.push(`Relationship: ${record.relationshipName}`);
      }
      if (record.relatedEntityLogicalName || record.relatedRecordId) {
        lines.push(`Related: ${[record.relatedEntityLogicalName, record.relatedRecordId].filter(Boolean).join(" · ")}`);
      }
      if (record.objectTypeCode || record.objectId) {
        lines.push(`Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}`);
      }
      lines.push("Interpretation: Partially interpreted association audit payload.");
      continue;
    }
    if (record.kind === "Raw") {
      lines.push("Audit type: Raw / partially interpreted payload");
      if (record.objectTypeCode || record.objectId) {
        lines.push(`Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}`);
      }
      lines.push("Interpretation: Raw evidence preserved in HTML export.");
      continue;
    }
    if (record.changedAttributeLogicalName) {
      lines.push(`Changed attribute: ${record.changedAttributeLogicalName}`);
    }
    if (record.oldValue !== undefined || record.newValue !== undefined) {
      lines.push(`Value: ${record.oldValue ?? "Not parsed"} → ${record.newValue ?? "Not parsed"}`);
    }
    if (record.objectTypeCode || record.objectId) {
      lines.push(`Object: ${[record.objectTypeCode, record.objectId].filter(Boolean).join(" · ")}`);
    }
  }
  if (result.records.length > records.length) {
    lines.push(`${result.records.length - records.length} additional audit record${result.records.length - records.length === 1 ? "" : "s"} omitted from PDF summary; see HTML export for full raw evidence.`);
  }
  if (result.warning) {
    lines.push(`Warning: ${result.warning}`);
  }
  return lines;
}

function escapeHtml(value: string | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderAuditResultHtml(result: AuditEvidenceResult): string {
  const records = result.records.length > 0
    ? `<ol class="dvqr-report-audit-records">${result.records.map((record) => `<li>${auditEvidenceRecordSummary(record).map((line) => `<div>${escapeHtml(line)}</div>`).join("")}${record.changedData ? `<details><summary>Raw audit payload</summary><code>${escapeHtml(record.changedData)}</code></details>` : ""}</li>`).join("")}</ol>`
    : "";
  return `<article class="dvqr-report-audit-result" data-audit-status="${escapeHtml(result.status)}">
    <h3>${escapeHtml(result.title)}</h3>
    <p>${escapeHtml(result.summary)}</p>
    <p><strong>Audit window:</strong> ${escapeHtml(formatAuditEvidenceDate(result.interval.fromCapturedAtIso))} → ${escapeHtml(formatAuditEvidenceDate(result.interval.toCapturedAtIso))}</p>
    ${records}
    ${result.warning ? `<p><strong>Warning:</strong> ${escapeHtml(result.warning)}</p>` : ""}
    ${result.queryPath ? `<details><summary>Audit query</summary><code>${escapeHtml(result.queryPath)}</code></details>` : ""}
  </article>`;
}

export function renderAuditEvidenceReportSectionHtml(results: readonly AuditEvidenceResult[], heading = "Audit Evidence"): string {
  if (results.length === 0) {
    return "";
  }
  return `<section class="dvqr-report-section dvqr-report-audit-section">
    <h2>${escapeHtml(heading)}</h2>
    <p>Audit evidence shown here was explicitly queried in the interactive investigation surface before export. Audit evidence enriches findings; it does not establish causality, deployment correctness, remediation status, or operational authority.</p>
    ${results.map(renderAuditResultHtml).join("")}
    <div class="dvqr-report-audit-experimental">
      <strong>Audit payload interpretation is experimental.</strong>
      <p>Dataverse audit payloads vary across entity updates, security operations, relationship associations, ownership changes, platform actions, and system behaviours. DVQR preserves raw evidence when it cannot confidently interpret the payload shape.</p>
      <p>Report audit edge cases through Feedback to help improve audit evidence coverage in future releases.</p>
    </div>
  </section>`;
}
