import type {
  OperationalProfileDimension,
  OperationalProfileEvidenceItem,
  OperationalProfileFutureSurface,
  OperationalProfileGuidanceItem,
  OperationalProfileModel,
  OperationalProfileNavigationAction
} from "./operationalProfileTypes.js";
import { renderOperationalContextMarkdown } from "../operationalContext/operationalContextMarkdownRenderer.js";
import type { DvqrScoreModel } from "../../dvqrScore/dvqrScoreTypes.js";

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderEvidenceList(evidence: readonly OperationalProfileEvidenceItem[]): string {
  if (!evidence.length) {
    return "_No evidence was provided for this section._";
  }

  return evidence
    .map((item) => {
      const detail = item.detail ? ` — ${item.detail}` : "";
      return `- **${escapeMarkdown(item.label)}:** ${escapeMarkdown(item.value)}${escapeMarkdown(detail)}`;
    })
    .join("\n");
}

function renderNavigationActions(actions: readonly OperationalProfileNavigationAction[]): string {
  if (!actions.length) {
    return "_No contextual investigation actions were generated for this Profile._";
  }

  return actions
    .map((item) => `- **${escapeMarkdown(item.label)}:** ${escapeMarkdown(item.description)}`)
    .join("\n");
}


function renderFutureSurfaces(surfaces: readonly OperationalProfileFutureSurface[]): string {
  if (!surfaces.length) {
    return "_No future investigation surfaces are currently listed for this Profile._";
  }

  return surfaces
    .map((item) => {
      const availability = item.availability === "proRoadmap" ? "Pro roadmap" : "Free roadmap";
      return `- **${escapeMarkdown(item.label)}** (${availability}): ${escapeMarkdown(item.description)}`;
    })
    .join("\n");
}

function renderGuidanceList(guidance: readonly OperationalProfileGuidanceItem[], fallback: readonly string[]): string {
  if (guidance.length) {
    return guidance
      .map((item) => `- **${escapeMarkdown(item.title)}:** ${escapeMarkdown(item.message)}`)
      .join("\n");
  }

  return fallback.map((item) => `- ${escapeMarkdown(item)}`).join("\n");
}

function renderDvqrScore(score: DvqrScoreModel | undefined): string {
  if (!score) {
    return "_No DVQR Score was generated for this Profile._";
  }

  const factors = score.contributingFactors
    .filter((factor) => factor.weightedContribution > 0)
    .sort((left, right) => right.weightedContribution - left.weightedContribution)
    .map((factor) => `| ${escapeMarkdown(factor.label)} | ${factor.rawValue} | ${factor.rawValue} / ${factor.softCap} | ${factor.weightedContribution} / ${factor.maxContribution} | ${escapeMarkdown(factor.formula)} |`)
    .join("\n");

  return [
    `**DVQR Score:** ${score.displayScore} / 100`,
    "",
    `**Band:** ${escapeMarkdown(score.band)} Operational Density & Complexity`,
    "",
    `> ${escapeMarkdown(score.summary)}`,
    "",
    "### Primary Contributors",
    "",
    factors || "_No contributing factors were observed._",
    "",
    "<details>",
    "<summary><strong>How does the calculation work?</strong></summary>",
    "",
    `- **Normalization profile:** \`${escapeMarkdown(score.normalizationVersion)}\``,
    `- **Explanation version:** \`${escapeMarkdown(score.explanationVersion)}\``,
    `- **Evidence principle:** ${escapeMarkdown(score.evidencePrinciple)}`,
    "- **Primitive formula:** `min(max contribution, max contribution × ln(raw + 1) / ln(soft cap + 1))`",
    "- **Display formula:** `round(low-end damping(100 × sum(weighted contributions) / 80))`",
    "",
    "| Signal | Raw evidence | Raw / soft cap | Contribution | Formula |",
    "|---|---:|---:|---:|---|",
    factors || "| None observed | 0 | 0 | 0 | n/a |",
    "",
    "</details>"
  ].join("\n");
}

function renderDimension(dimension: OperationalProfileDimension): string {
  return [
    "<details open>",
    `<summary><strong>${escapeMarkdown(dimension.label)}</strong> — ${escapeMarkdown(dimension.evidenceStateLabel)}</summary>`,
    "",
    `- **Observed:** ${escapeMarkdown(dimension.valueLabel)}`,
    `- **Meaning:** ${escapeMarkdown(dimension.explanation)}`,
    `- **Why this matters:** ${escapeMarkdown(dimension.whyItMatters)}`,
    "",
    renderEvidenceList(dimension.evidence),
    "",
    "</details>"
  ].join("\n");
}

export function renderOperationalProfileMarkdown(profile: OperationalProfileModel): string {
  const lines: string[] = [
    `# DV Quick Run Profile — ${profile.entityDisplayName}`,
    "",
    `**Entity:** \`${profile.entityLogicalName}\``,
    "",
    `**Profile band:** ${profile.headlineLabel}`,
    "",
    `> ${profile.summary}`,
    "",
    "## DVQR Score",
    "",
    renderDvqrScore(profile.dvqrScore),
    "",
    "## Operational Density",
    "",
    ...profile.dimensions.map(renderDimension).flatMap((section) => [section, ""]),
    ...(profile.operationalContext ? [renderOperationalContextMarkdown(profile.operationalContext), ""] : []),
    "## Suggested Investigation Actions",
    "",
    renderNavigationActions(profile.navigationActions ?? []),
    "",
    "## Investigation Guidance",
    "",
    renderGuidanceList(profile.guidance ?? [], profile.investigationGuidance ?? []),
    "",
    "## Future Investigation Surfaces",
    "",
    renderFutureSurfaces(profile.futureSurfaces ?? []),
    "",
    "## Evidence Summary",
    "",
    renderEvidenceList(profile.evidence),
    "",
    "## Guardrails",
    "",
    "- This Profile is entity-scoped.",
    "- This Profile is explicitly user-triggered.",
    "- This Profile is advisory-only.",
    "- This Profile surfaces evidence and must not imply root cause.",
    "- This Profile does not reconstruct timelines, perform hidden scans, or merge unrelated evidence into a narrative conclusion.",
    "- Operational Context defaults to one-hop context; curated semantic expansions must remain explicit, bounded, and non-causal.",
    "- DVQR Score represents operational density / contextual complexity, not risk, health, quality, security severity, or root cause.",
    "- Bands are explainable labels, not opaque risk scores."
  ];

  return `${lines.join("\n").trim()}\n`;
}


