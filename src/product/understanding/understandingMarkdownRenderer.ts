import type { UnderstandingDocument, UnderstandingReturnedShapeNode, UnderstandingTechnicalSection, UnderstandingTraversalNode } from "./understandingTypes.js";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pushSection(lines: string[], heading: string, body: string[], level = "##"): void {
  if (!body.length) {
    return;
  }
  lines.push(`${level} ${heading}`);
  lines.push("");
  lines.push(...body);
  lines.push("");
}

function renderTechnicalSection(section: UnderstandingTechnicalSection): string[] {
  return [...section.lines];
}

function renderTreePrefix(depth: number): string {
  if (depth <= 0) {
    return "";
  }
  return `${"  ".repeat(Math.max(0, depth - 1))}└── `;
}

function renderTraversal(nodes: UnderstandingTraversalNode[]): string[] {
  if (!nodes.length) {
    return [];
  }

  return nodes.map((node) => {
    const details = [node.relationship, node.joinType].filter(Boolean).join("; ");
    const label = node.technicalName && node.technicalName !== node.label ? `${node.label} (${node.technicalName})` : node.label;
    return `- ${renderTreePrefix(node.depth)}${label}${details ? ` — ${details}` : ""}`;
  });
}

function renderReturnedShape(nodes: UnderstandingReturnedShapeNode[]): string[] {
  if (!nodes.length) {
    return [];
  }

  const lines: string[] = [];
  for (const node of nodes) {
    const label = node.technicalName && node.technicalName !== node.label ? `${node.label} (${node.technicalName})` : node.label;
    lines.push(`- ${renderTreePrefix(node.depth)}${label}`);
    if (node.fields.length) {
      for (const field of node.fields) {
        lines.push(`  ${"  ".repeat(node.depth)}- ${field}`);
      }
    } else {
      lines.push(`  ${"  ".repeat(node.depth)}- *(no explicit fields selected)*`);
    }
  }
  return lines;
}

export function renderUnderstandingDocumentMarkdown(document: UnderstandingDocument): string {
  const lines: string[] = [];

  lines.push(`# ${document.title}`);
  lines.push("");
  lines.push("## Understanding Result");
  lines.push("");
  lines.push(`- Understanding Engine: **${document.engineVersion}**`);
  lines.push(`- Document Schema: \`${document.schemaVersion}\``);
  lines.push(`- Subject: ${document.subject.kind}`);
  lines.push(`- Overall Confidence: **${titleCase(document.confidence)}**`);
  if (document.subject.entityLogicalName) {
    lines.push(`- Entity: \`${document.subject.entityLogicalName}\``);
  } else if (document.subject.entitySetName) {
    lines.push(`- Entity set: \`${document.subject.entitySetName}\``);
  }
  lines.push(`- Audience: ${document.audience.map(titleCase).join(", ")}`);
  lines.push("");

  lines.push(`> **Invariant:** ${document.invariant} Plain-English interpretation is provided first, and the technical breakdown remains available underneath.`);
  lines.push("");

  lines.push("---");
  lines.push("");
  pushSection(lines, "Investigation Narrative", [document.narrative.overview]);
  pushSection(lines, "What this query is trying to accomplish", document.narrative.intent);

  const profileLines: string[] = [];
  if (document.narrative.investigationStage) {
    profileLines.push(`- Stage: **${document.narrative.investigationStage}**`);
  }
  if (document.narrative.investigationPattern) {
    profileLines.push(`- Pattern: **${document.narrative.investigationPattern}**`);
  }
  profileLines.push(`- Complexity: **${document.complexity.level}** (${document.complexity.score}/100)`);
  pushSection(lines, "Investigation Profile", profileLines);

  pushSection(lines, "Investigation Complexity", [
    `- Level: **${document.complexity.level}**`,
    `- Score: ${document.complexity.score}/100`,
    ...document.complexity.reasons.map((reason) => `- ${reason}`)
  ]);

  lines.push("---");
  lines.push("");

  const mechanics = document.mechanics;
  const mechanicLines: string[] = [];
  if (mechanics.rootTarget) {
    mechanicLines.push(`- Root target: \`${mechanics.rootTarget}\``);
  }
  mechanicLines.push(`- Operation: ${mechanics.operation}`);
  mechanicLines.push(`- Projection: ${mechanics.projection.length ? mechanics.projection.map((item) => `\`${item}\``).join(", ") : "*(not specified)*"}`);
  mechanicLines.push(`- Filters: ${mechanics.filters.length ? mechanics.filters.map((item) => `\`${item}\``).join("; ") : "*(none)*"}`);
  mechanicLines.push(`- Ordering: ${mechanics.ordering.length ? mechanics.ordering.map((item) => `\`${item}\``).join(", ") : "*(none)*"}`);
  if (typeof mechanics.rowLimit === "number") {
    mechanicLines.push(`- Row limit: \`${mechanics.rowLimit}\``);
  }
  if (mechanics.expands.length) {
    mechanicLines.push("- Expands:");
    for (const expand of mechanics.expands) {
      mechanicLines.push(`  - \`${expand.navigationProperty}\`${expand.nestedProjection.length ? ` with nested projection ${expand.nestedProjection.map((item) => `\`${item}\``).join(", ")}` : " without nested projection"}`);
      if (expand.explanation) {
        mechanicLines.push(`    - ${expand.explanation}`);
      }
    }
  } else {
    mechanicLines.push("- Expands: *(none)*");
  }
  if (mechanics.unknownOptions.length) {
    mechanicLines.push(`- Unknown options: ${mechanics.unknownOptions.map((item) => `\`${item}\``).join(", ")}`);
  }
  pushSection(lines, "Query Mechanics", mechanicLines);
  pushSection(lines, "Traversal", renderTraversal(document.traversal));
  pushSection(lines, "Returned Shape", renderReturnedShape(document.returnedShape));

  if (document.signals.length) {
    const positives = document.signals.filter((signal) => signal.kind === "positive");
    const smells = document.signals.filter((signal) => signal.kind === "smell" || signal.kind === "risk" || signal.kind === "unknown");
    pushSection(lines, "Positive Findings", positives.map((signal) => `- **${signal.title}:** ${signal.detail}`));
    pushSection(lines, "Investigation Smells & Risks", smells.map((signal) => `- **${signal.title}:** ${signal.detail}`));
  }

  lines.push("---");
  lines.push("");

  pushSection(lines, "Technical Breakdown", document.technical.summary);
  for (const section of document.technical.sections) {
    pushSection(lines, section.heading, renderTechnicalSection(section), "###");
  }

  if (document.recommendations.length) {
    lines.push("## Recommendations");
    lines.push("");
    for (const recommendation of document.recommendations) {
      lines.push(`- **${recommendation.title}**`);
      lines.push(`  - Detail: ${recommendation.detail}`);
      if (recommendation.rationale) {
        lines.push(`  - Rationale: ${recommendation.rationale}`);
      }
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

  if (document.evidence.length) {
    lines.push("## Evidence References");
    lines.push("");
    for (const evidence of document.evidence) {
      lines.push(`- ${evidence.label}: ${evidence.detail}`);
    }
    lines.push("");
  }

  lines.push("## Raw Query Reference");
  lines.push("");
  lines.push(`\`\`\`${document.rawReference.language}`);
  lines.push(document.rawReference.text);
  lines.push("```");
  lines.push("");

  lines.push("## Investigation Pipeline");
  lines.push("");
  lines.push("- ✓ Investigation Narrative");
  lines.push("- ✓ Query Mechanics");
  lines.push("- ✓ Traversal");
  lines.push("- ✓ Returned Shape");
  lines.push("- ✓ Technical Breakdown");
  if (document.recommendations.length) {
    lines.push("- ✓ Recommendations");
  }
  for (const contributor of document.sourceContributors) {
    lines.push(`- ✓ ${contributor.title}`);
  }
  lines.push("");
  lines.push("This understanding document is advisory and evidence-backed. It explains query shape and investigation posture, but does not establish operational authority, root cause, or deployment correctness.");
  lines.push("");

  return lines.join("\n");
}
