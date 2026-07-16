import type { AuditEvidenceResult } from "./auditEvidenceTypes.js";

function escapeHtml(value: string | undefined): string {
  return (value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatDate(value: string | undefined): string {
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
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function feedbackUrl(record?: AuditEvidenceResult["records"][number]): string {
  const params = new URLSearchParams({
    version: "0.13.1",
    product: "DV Quick Run",
    area: "Audit Evidence",
    source: "audit-inline",
    subject: "Audit payload edge case"
  });
  if (record?.operation) {
    params.set("operation", record.operation);
  }
  if (record?.action) {
    params.set("action", record.action);
  }
  if (record?.kind) {
    params.set("kind", record.kind);
  }
  return `https://www.dvquickrun.com/feedback?${params.toString()}`;
}

function renderRawChangedData(record: AuditEvidenceResult["records"][number]): string {
  if (!record.changedData) {
    return "";
  }

  return `<details class="dvqr-audit-raw-payload">
          <summary>Raw audit payload</summary>
          <code>${escapeHtml(record.changedData)}</code>
        </details>`;
}

function renderAuditRecord(record: AuditEvidenceResult["records"][number]): string {
  const actor = record.changedBy ?? record.userId ?? "Unknown actor";
  const operation = record.action && record.action !== record.operation
    ? `${record.operation ?? "Not captured"} / ${record.action}`
    : record.operation ?? record.action ?? "Not captured";

  const details = record.kind === "AssociationChange"
    ? `<dl>
          <dt>Operation</dt><dd>${escapeHtml(operation)}</dd>
          <dt>Audit type</dt><dd>Security / relationship association</dd>
          <dt>Interpretation</dt><dd>Partially interpreted from Dataverse association audit payload. Review the raw payload for edge cases.</dd>
          <dt>Relationship</dt><dd>${escapeHtml(record.relationshipName ?? "Not parsed from audit payload")}</dd>
          <dt>Related entity</dt><dd>${escapeHtml(record.relatedEntityLogicalName ?? "Not parsed from audit payload")}</dd>
          <dt>Related record</dt><dd>${escapeHtml(record.relatedRecordId ?? "Not parsed from audit payload")}</dd>
          <dt>Object</dt><dd>${escapeHtml(record.objectTypeCode ?? "Unknown entity")}${record.objectId ? ` · ${escapeHtml(record.objectId)}` : ""}</dd>
        </dl>
        ${renderRawChangedData(record)}`
    : record.kind === "Raw"
      ? `<dl>
          <dt>Operation</dt><dd>${escapeHtml(operation)}</dd>
          <dt>Audit type</dt><dd>Raw / partially interpreted payload</dd>
          <dt>Interpretation</dt><dd>DVQR could not confidently classify this audit payload yet. The raw audit evidence is preserved below.</dd>
          <dt>Attribute mask</dt><dd>${escapeHtml(record.attributeMask ?? "Not captured")}</dd>
          <dt>Object</dt><dd>${escapeHtml(record.objectTypeCode ?? "Unknown entity")}${record.objectId ? ` · ${escapeHtml(record.objectId)}` : ""}</dd>
        </dl>
        ${renderRawChangedData(record)}`
      : `<dl>
          <dt>Operation</dt><dd>${escapeHtml(operation)}</dd>
          <dt>Old value</dt><dd>${escapeHtml(record.oldValue ?? "Not parsed from audit payload")}</dd>
          <dt>New value</dt><dd>${escapeHtml(record.newValue ?? "Not parsed from audit payload")}</dd>
          <dt>Changed attribute</dt><dd>${escapeHtml(record.changedAttributeLogicalName ?? "Not parsed from audit payload")}</dd>
          <dt>Attribute mask</dt><dd>${escapeHtml(record.attributeMask ?? "Not captured")}</dd>
          <dt>Object</dt><dd>${escapeHtml(record.objectTypeCode ?? "Unknown entity")}${record.objectId ? ` · ${escapeHtml(record.objectId)}` : ""}</dd>
        </dl>
        ${(!record.changedAttributeLogicalName || !record.oldValue || !record.newValue) ? renderRawChangedData(record) : ""}`;

  const edgeCaseLink = record.kind === "Raw" || record.kind === "AssociationChange" || !record.changedAttributeLogicalName
    ? `<p class="dvqr-audit-edge-case"><a href="${escapeHtml(feedbackUrl(record))}">Report audit edge case</a></p>`
    : "";

  return `<article class="dvqr-audit-record dvqr-audit-record-${escapeHtml(record.kind ?? "Raw")}">
        <div class="dvqr-audit-record-heading">
          <strong>${escapeHtml(formatDate(record.recordedAtIso))}</strong>
          <span>${escapeHtml(actor)}</span>
        </div>
        ${details}
        ${edgeCaseLink}
      </article>`;
}


function classifyAuditError(message: string): { status: string; summary: string } {
  const normalised = message.toLowerCase();
  if (normalised.includes("403") || normalised.includes("forbidden") || normalised.includes("does not have prvreadrecordaudit") || normalised.includes("missing prvreadrecordaudit")) {
    return {
      status: "403 Forbidden",
      summary: "The current Dataverse identity does not have permission to read Audit records for this lookup."
    };
  }
  if (normalised.includes("401") || normalised.includes("unauthorized")) {
    return {
      status: "401 Unauthorized",
      summary: "Dataverse rejected the audit lookup because the current identity could not be authenticated for this request."
    };
  }
  return {
    status: "Request failed",
    summary: "DVQR could not retrieve Dataverse Audit evidence for this lookup."
  };
}

export function renderAuditEvidenceErrorHtml(error: unknown, capturedEvidenceLabel: string): string {
  const message = error instanceof Error ? error.message : String(error);
  const classification = classifyAuditError(message);
  return `<div class="dvqr-audit-result dvqr-audit-result-error">
    <strong>Audit evidence unavailable</strong>
    <dl class="dvqr-audit-error-summary">
      <dt>Status</dt><dd>${escapeHtml(classification.status)}</dd>
      <dt>Reason</dt><dd>${escapeHtml(classification.summary)}</dd>
    </dl>
    <p class="dvqr-audit-boundary">${escapeHtml(capturedEvidenceLabel)} remains available. Audit evidence enriches findings only when available.</p>
    <details class="dvqr-audit-technical-details">
      <summary>Show technical details</summary>
      <pre><code>${escapeHtml(message)}</code></pre>
    </details>
  </div>`;
}

export function renderAuditEvidenceResultHtml(result: AuditEvidenceResult): string {
  const statusClass = result.status.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const records = result.records.length > 0
    ? `<div class="dvqr-audit-record-list">${result.records.map(renderAuditRecord).join("")}</div>`
    : "";

  return `<div class="dvqr-audit-result dvqr-audit-result-${escapeHtml(statusClass)}">
    <strong>${escapeHtml(result.title)}</strong>
    <p>${escapeHtml(result.summary)}</p>
    <dl class="dvqr-audit-interval">
      <dt>Audit window</dt>
      <dd>${escapeHtml(formatDate(result.interval.fromCapturedAtIso))} → ${escapeHtml(formatDate(result.interval.toCapturedAtIso))}</dd>
    </dl>
    ${records}
    ${result.warning ? `<p class="dvqr-audit-warning">${escapeHtml(result.warning)}</p>` : ""}
    ${result.queryPath ? `<details class="dvqr-audit-query"><summary>Audit query</summary><code>${escapeHtml(result.queryPath)}</code></details>` : ""}
    <p class="dvqr-audit-boundary">Audit evidence enriches this finding. It does not establish causality, deployment correctness, remediation status, or operational authority.</p>
    <div class="dvqr-audit-experimental">
      <strong>Audit payload interpretation is experimental.</strong>
      <p>Dataverse audit payloads vary across entity updates, security operations, relationship associations, ownership changes, platform actions, and system behaviours. DVQR preserves raw evidence when it cannot yet confidently interpret the payload shape.</p>
      <p><a href="${escapeHtml(feedbackUrl())}">Report an audit edge case</a> to help improve audit evidence coverage in future releases.</p>
    </div>
  </div>`;
}
