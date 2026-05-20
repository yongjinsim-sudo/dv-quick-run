import type {
  OperationalContextEvidence,
  OperationalContextSectionViewModel,
  OperationalContextViewModel
} from "./operationalContextTypes.js";

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function renderRawEvidence(item: OperationalContextEvidence): string {
  if (typeof item.raw === "undefined" && typeof item.query === "undefined") {
    return "";
  }

  const rawLines: string[] = ["", "  <details>", "  <summary>Raw evidence</summary>", ""];

  if (item.query) {
    rawLines.push(`  - Query: \`${escapeMarkdown(item.query)}\``);
  }

  if (typeof item.raw !== "undefined") {
    rawLines.push("", "  ```json", JSON.stringify(item.raw, null, 2), "  ```");
  }

  rawLines.push("", "  </details>");
  return rawLines.join("\n");
}

function renderEvidence(item: OperationalContextEvidence): string {
  const emphasis = item.emphasis ? ` — ${item.emphasis}` : "";
  return [
    `- **${escapeMarkdown(item.title)}**${escapeMarkdown(emphasis)}`,
    `  - ${escapeMarkdown(item.summary)}`,
    `  - Evidence: ${item.evidenceType}; confidence: ${item.confidence}; scope: ${item.scope}; source: ${item.source}`,
    renderRawEvidence(item)
  ].filter((line) => line.length > 0).join("\n");
}

function renderSection(section: OperationalContextSectionViewModel): string {
  const evidence = section.evidence.length > 0
    ? section.evidence.map(renderEvidence).join("\n")
    : "_No operational context evidence was returned for this provider._";

  return [
    "<details open>",
    `<summary><strong>${escapeMarkdown(section.label)}</strong></summary>`,
    "",
    `_${escapeMarkdown(section.summary)}_`,
    "",
    evidence,
    "",
    "</details>"
  ].join("\n");
}

export function renderOperationalContextMarkdown(context: OperationalContextViewModel): string {
  const subject = context.subject.displayName ?? context.subject.logicalName ?? context.subject.id ?? context.subject.type;

  return [
    "## Operational Context",
    "",
    `**Subject:** ${escapeMarkdown(subject)}`,
    "",
    ...context.sections.map(renderSection).flatMap((section) => [section, ""]),
    "### Operational Context Guardrails",
    "",
    ...context.guardrails.map((item) => `- ${escapeMarkdown(item)}`)
  ].join("\n").trimEnd();
}
