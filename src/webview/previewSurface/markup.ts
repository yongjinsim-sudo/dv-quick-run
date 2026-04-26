import type { PreviewSurfaceModel, PreviewSurfaceAction } from "../../services/previewSurfaceTypes.js";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderRiskBlock(model: PreviewSurfaceModel): string {
  const riskLevel = model.riskLevel ?? "normal";
  const environment = model.environmentName ?? "Not specified";

  if (riskLevel === "red") {
    return `<div class="risk-red"><strong>RED environment warning</strong><br/>Environment: ${escapeHtml(environment)}<br/>This PATCH will update data in this environment. Review the payload before applying.</div>`;
  }

  if (riskLevel === "amber") {
    return `<div class="risk-amber"><strong>Amber environment caution</strong><br/>Environment: ${escapeHtml(environment)}<br/>Review carefully before applying.</div>`;
  }

  if (model.environmentName) {
    return `<div class="risk-normal"><strong>Environment:</strong> ${escapeHtml(environment)}</div>`;
  }

  return "";
}

function renderAction(action: PreviewSurfaceAction, isPrimary: boolean): string {
  const classes = isPrimary ? "" : "secondary";
  const disabled = action.enabled ? "" : " disabled";
  const description = action.description ? ` title="${escapeHtml(action.description)}"` : "";

  return `<button class="${classes}" data-action-id="${escapeHtml(action.id)}" data-action-kind="${escapeHtml(action.kind)}"${disabled}${description}>${escapeHtml(action.label)}</button>`;
}

export function getPreviewSurfaceMarkup(model: PreviewSurfaceModel): string {
  const secondaryActions = model.secondaryActions ?? [];
  const actions = [
    ...secondaryActions.map((action) => renderAction(action, false)),
    model.primaryAction ? renderAction(model.primaryAction, true) : ""
  ].filter(Boolean).join("\n");

  const sections = model.sections.map((section) => `
    <section class="preview-section">
      <h2>${escapeHtml(section.title)}</h2>
      <pre data-language="${escapeHtml(section.language ?? "text")}">${escapeHtml(section.content)}</pre>
    </section>
  `).join("\n");

  return `
    <main class="preview-shell" data-preview-id="${escapeHtml(model.previewId)}">
      <header class="preview-header">
        <div class="preview-title-row">
          <h1 class="preview-title">${escapeHtml(model.title)}</h1>
          <span class="preview-pill">${escapeHtml(model.kind)}</span>
        </div>
        <div class="preview-meta">
          <div><strong>Previewing:</strong> ${escapeHtml(model.sourceAction)}</div>
          <div><strong>Source:</strong> ${escapeHtml(model.source)}</div>
          <div><strong>Created:</strong> ${escapeHtml(model.createdAt)}</div>
          ${model.environmentName ? `<div><strong>Environment:</strong> ${escapeHtml(model.environmentName)}</div>` : ""}
        </div>
      </header>
      ${renderRiskBlock(model)}
      ${model.summary ? `<p class="preview-summary">${escapeHtml(model.summary)}</p>` : ""}
      ${sections}
      <footer class="preview-actions">
        ${actions}
      </footer>
    </main>
  `;
}
