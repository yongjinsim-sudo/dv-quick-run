import type { ExplainResult, ExplainSection } from "./explainEngineTypes.js";

function renderSection(lines: string[], section: ExplainSection, level = "##"): void {
  lines.push(`${level} ${section.heading}`);
  lines.push("");
  lines.push(...section.lines);
  lines.push("");
}

function sectionIn(section: ExplainSection, headings: string[]): boolean {
  return headings.includes(section.heading);
}

function isClauseAnalysisSection(section: ExplainSection): boolean {
  return section.heading === "Raw Query" ||
    section.heading === "Query Intent" ||
    section.heading === "Target" ||
    section.heading.startsWith("$") ||
    section.heading === "Other query options" ||
    section.heading === "Validation" ||
    section.heading === "Diagnostics" ||
    section.heading === "Field Provenance & Relationship Advice";
}

export function renderExplainResultMarkdown(result: ExplainResult): string {
  const lines: string[] = [];

  lines.push(`# ${result.title}`);
  lines.push("");
  lines.push("## Explain Result");
  lines.push("");
  lines.push("- Explain Engine: **v2.1**");
  lines.push(`- Report Schema: \`${result.schemaVersion}\``);
  lines.push(`- Subject: ${result.context.subjectKind}`);
  lines.push(`- Confidence: **${result.confidence.charAt(0).toUpperCase()}${result.confidence.slice(1)}**`);
  if (result.context.entityLogicalName) {
    lines.push(`- Entity: \`${result.context.entityLogicalName}\``);
  } else if (result.context.entitySetName) {
    lines.push(`- Entity set: \`${result.context.entitySetName}\``);
  }
  lines.push("");

  if (result.summaryLines.length) {
    lines.push("## Investigation Summary");
    lines.push("");
    lines.push(...result.summaryLines);
    lines.push("");
  }

  const stageSections = result.sections.filter((section) => section.heading === "Investigation Stage");
  for (const section of stageSections) {
    renderSection(lines, section);
  }

  const profileSections = result.sections.filter((section) => section.heading === "Investigation Profile" || section.heading === "Operational Characteristics");
  for (const section of profileSections) {
    renderSection(lines, {
      ...section,
      heading: "Investigation Profile"
    });
  }

  const confidenceSections = result.sections.filter((section) => section.heading === "Confidence Assessment");
  for (const section of confidenceSections) {
    renderSection(lines, section);
  }

  const operationalSections = result.sections.filter((section) => sectionIn(section, [
    "Potential Observations",
    "Things Worth Verifying"
  ]));

  for (const section of operationalSections) {
    renderSection(lines, {
      ...section,
      heading: section.heading === "Potential Observations" ? "Operational Implications" : section.heading
    });
  }

  const understandingSections = result.sections.filter((section) => section.heading === "Understanding the Pattern" || section.heading === "Understanding the Investigation Pattern" || section.heading === "Investigation Pattern");
  for (const section of understandingSections) {
    renderSection(lines, {
      ...section,
      heading: "Investigation Pattern"
    });
  }

  const clauseSections = result.sections.filter(isClauseAnalysisSection);
  if (clauseSections.length) {
    lines.push("## Clause Analysis");
    lines.push("");
    for (const section of clauseSections) {
      renderSection(lines, section, "###");
    }
  }

  const remainingSections = result.sections.filter((section) => !stageSections.includes(section) &&
    !profileSections.includes(section) &&
    !confidenceSections.includes(section) &&
    !operationalSections.includes(section) &&
    !understandingSections.includes(section) &&
    !clauseSections.includes(section) &&
    !sectionIn(section, ["Design Notes", "Trust Model", "Evidence", "Teaching Notes", "Pattern Trade-offs"]));

  for (const section of remainingSections) {
    renderSection(lines, section);
  }

  const evidenceSections = result.sections.filter((section) => section.heading === "Evidence");
  for (const section of evidenceSections) {
    renderSection(lines, section);
  }

  if (result.recommendations.length) {
    lines.push("## Recommendations");
    lines.push("");
    for (const recommendation of result.recommendations) {
      lines.push(`- ${recommendation.title}`);
      lines.push(`  - Detail: ${recommendation.detail}`);
      lines.push(`  - Confidence: ${recommendation.confidence}`);
      if (recommendation.actionability && recommendation.actionability !== "none") {
        lines.push(`  - Actionability: ${recommendation.actionability}`);
      }
      if (recommendation.previewQuery) {
        lines.push(`  - Preview query: \`${recommendation.previewQuery}\``);
      }
    }
    lines.push("");
  }

  const trustSections = result.sections.filter((section) => sectionIn(section, ["Design Notes", "Trust Model"]));
  for (const section of trustSections) {
    renderSection(lines, section);
  }

  if (result.evidence.length) {
    lines.push("## Evidence References");
    lines.push("");
    for (const evidence of result.evidence) {
      lines.push(`- ${evidence.label}: ${evidence.detail}`);
    }
    lines.push("");
  }

  if (result.unknowns.length) {
    lines.push("## Unknowns");
    lines.push("");
    for (const unknown of result.unknowns) {
      lines.push(`- ${unknown.label}: ${unknown.reason}`);
      if (unknown.impact) {
        lines.push(`  - Impact: ${unknown.impact}`);
      }
    }
    lines.push("");
  }

  lines.push("## Investigation Pipeline");
  lines.push("");
  const pipelineTitles = new Set<string>();
  pipelineTitles.add("Investigation Summary");
  pipelineTitles.add("Confidence Assessment");
  pipelineTitles.add("Investigation Pattern");
  for (const contributor of result.contributors) {
    pipelineTitles.add(contributor.title);
  }
  for (const title of pipelineTitles) {
    lines.push(`- ✓ ${title}`);
  }
  lines.push("");
  lines.push("This report synthesizes parsed query structure into investigation guidance. Recommendations are advisory, evidence-backed, and do not establish operational authority, root cause, or deployment correctness.");
  lines.push("");

  return lines.join("\n");
}
