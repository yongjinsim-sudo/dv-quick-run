import type {
  OperationalProfileDimension,
  OperationalProfileEvidenceItem,
  OperationalProfileGuidanceItem,
  OperationalProfileModel
} from "./operationalProfileTypes.js";

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

function renderGuidanceList(guidance: readonly OperationalProfileGuidanceItem[], fallback: readonly string[]): string {
  if (guidance.length) {
    return guidance
      .map((item) => `- **${escapeMarkdown(item.title)}:** ${escapeMarkdown(item.message)}`)
      .join("\n");
  }

  return fallback.map((item) => `- ${escapeMarkdown(item)}`).join("\n");
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
    "## Operational Density",
    "",
    ...profile.dimensions.map(renderDimension).flatMap((section) => [section, ""]),
    "## Investigation Guidance",
    "",
    renderGuidanceList(profile.guidance ?? [], profile.investigationGuidance ?? []),
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
    "- Bands are explainable labels, not opaque numeric scores."
  ];

  return `${lines.join("\n").trim()}\n`;
}
