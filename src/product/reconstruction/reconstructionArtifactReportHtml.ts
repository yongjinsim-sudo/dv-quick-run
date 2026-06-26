import {
  reconstructionArtifactIntro,
  toReconstructionArtifactCandidateViewModel,
  type ReconstructionArtifactReference
} from "./reconstructionArtifactReference.js";

export function escapeReconstructionArtifactHtml(value: string | number | undefined): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface ReconstructionArtifactHtmlOptions {
  readonly sectionClassName: string;
  readonly cardClassName: string;
  readonly listClassName: string;
  readonly useDefinitionList?: boolean;
  readonly includeSectionHeaderCount?: boolean;
}

export function renderReconstructionArtifactsHtml(
  artifacts: readonly ReconstructionArtifactReference[] | undefined,
  options: ReconstructionArtifactHtmlOptions
): string {
  if (!artifacts || artifacts.length === 0) {
    return "";
  }
  const safeCount = escapeReconstructionArtifactHtml(artifacts.length);
  const heading = options.includeSectionHeaderCount
    ? `<div class="dvqr-timeline-report-section-head"><h2>Reconstruction Artifacts</h2><span>${safeCount} exported candidate${artifacts.length === 1 ? "" : "s"}</span></div>`
    : "<h2>Reconstruction Artifacts</h2>";
  return `<section class="${options.sectionClassName}">
    ${heading}
    <p${options.useDefinitionList ? "" : " class=\"dvqr-report-muted\""}>${escapeReconstructionArtifactHtml(reconstructionArtifactIntro)}</p>
    <div class="${options.listClassName}">
      ${artifacts.map((artifact) => renderReconstructionArtifactCardHtml(artifact, options)).join("")}
    </div>
  </section>`;
}

function renderReconstructionArtifactCardHtml(artifact: ReconstructionArtifactReference, options: ReconstructionArtifactHtmlOptions): string {
  const candidate = toReconstructionArtifactCandidateViewModel(artifact);
  if (options.useDefinitionList) {
    return `<article class="${options.cardClassName}" data-utility="${escapeReconstructionArtifactHtml(candidate.utilityId.toLowerCase())}">
      <strong>${escapeReconstructionArtifactHtml(candidate.candidateTitle)}</strong>
      <dl>
        <div><dt>Entity</dt><dd>${escapeReconstructionArtifactHtml(candidate.entityLabel)}</dd></div>
        ${candidate.attributeLabel ? `<div><dt>Attribute</dt><dd>${escapeReconstructionArtifactHtml(candidate.attributeLabel)}</dd></div>` : ""}
        <div><dt>Reason</dt><dd>${escapeReconstructionArtifactHtml(candidate.reason)}</dd></div>
        <div><dt>Support</dt><dd>${escapeReconstructionArtifactHtml(candidate.support)}</dd></div>
        <div><dt>Artifact</dt><dd>${escapeReconstructionArtifactHtml(candidate.artifactFileName)}</dd></div>
        ${candidate.sourceProvider ? `<div><dt>Source</dt><dd>${escapeReconstructionArtifactHtml(candidate.sourceProvider)}</dd></div>` : ""}
      </dl>
      <p>${escapeReconstructionArtifactHtml(candidate.description)}</p>
      ${candidate.notes.slice(0, 1).map((note) => `<p>${escapeReconstructionArtifactHtml(note)}</p>`).join("")}
    </article>`;
  }
  return `<article class="${options.cardClassName}" data-utility="${escapeReconstructionArtifactHtml(candidate.utilityId.toLowerCase())}">
    <h3>${escapeReconstructionArtifactHtml(candidate.candidateTitle)}</h3>
    <div class="dvqr-report-reconstruction-grid">
      <div><strong>Entity</strong><span>${escapeReconstructionArtifactHtml(candidate.entityLabel)}</span></div>
      ${candidate.attributeLabel ? `<div><strong>Attribute</strong><span>${escapeReconstructionArtifactHtml(candidate.attributeLabel)}</span></div>` : ""}
      <div><strong>Reason</strong><span>${escapeReconstructionArtifactHtml(candidate.reason)}</span></div>
      <div><strong>Support</strong><span>${escapeReconstructionArtifactHtml(candidate.support)}</span></div>
      <div><strong>Artifact</strong><span>${escapeReconstructionArtifactHtml(candidate.artifactFileName)}</span></div>
      ${candidate.sourceProvider ? `<div><strong>Source</strong><span>${escapeReconstructionArtifactHtml(candidate.sourceProvider)}</span></div>` : ""}
    </div>
    <p>${escapeReconstructionArtifactHtml(candidate.description)}</p>
    ${candidate.notes.slice(0, 1).map((note) => `<p>${escapeReconstructionArtifactHtml(note)}</p>`).join("")}
  </article>`;
}
