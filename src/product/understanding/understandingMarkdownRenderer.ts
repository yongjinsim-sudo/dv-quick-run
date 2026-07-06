import type {
  UnderstandingDocument,
  UnderstandingReturnedShapeNode,
  UnderstandingTechnicalSection,
  UnderstandingTraversalNode,
} from "./understandingTypes.js";

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function pushSection(
  lines: string[],
  heading: string,
  body: string[],
  level = "##",
): void {
  if (!body.length) {
    return;
  }
  lines.push(`${level} ${heading}`);
  lines.push("");
  lines.push(...body);
  lines.push("");
}

function renderTechnicalSection(
  section: UnderstandingTechnicalSection,
): string[] {
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
    const details = [node.relationship, node.joinType]
      .filter(Boolean)
      .join("; ");
    const label =
      node.technicalName && node.technicalName !== node.label
        ? `${node.label} (${node.technicalName})`
        : node.label;
    return `- ${renderTreePrefix(node.depth)}${label}${details ? ` — ${details}` : ""}`;
  });
}

function renderReturnedShape(
  nodes: UnderstandingReturnedShapeNode[],
): string[] {
  if (!nodes.length) {
    return [];
  }

  const lines: string[] = [];
  for (const node of nodes) {
    const label =
      node.technicalName && node.technicalName !== node.label
        ? `${node.label} (${node.technicalName})`
        : node.label;
    lines.push(`- ${renderTreePrefix(node.depth)}${label}`);
    if (node.fields.length) {
      for (const field of node.fields) {
        lines.push(`  ${"  ".repeat(node.depth)}- ${field}`);
      }
    } else {
      lines.push(
        `  ${"  ".repeat(node.depth)}- *(no explicit fields selected)*`,
      );
    }
  }
  return lines;
}

function getUnderstandingLabels(document: UnderstandingDocument): {
  intentHeading: string;
  mechanicsHeading: string;
  traversalHeading: string;
  returnedShapeHeading: string;
  rawReferenceHeading: string;
  mechanicsPipelineLabel: string;
  traversalPipelineLabel: string;
  returnedShapePipelineLabel: string;
  footerSubject: string;
  expandsLabel: string;
} {
  if (
    document.subject.kind === "crossDiff" ||
    document.subject.kind === "timelineDiff"
  ) {
    return {
      intentHeading: "Investigation Objective",
      mechanicsHeading: "Investigation Method",
      traversalHeading: "Evidence Coverage",
      returnedShapeHeading: "Key Operational Changes",
      rawReferenceHeading: "Raw Comparison Reference",
      mechanicsPipelineLabel: "Investigation Method",
      traversalPipelineLabel: "Evidence Coverage",
      returnedShapePipelineLabel: "Key Operational Changes",
      footerSubject: "comparison evidence",
      expandsLabel: "Provider contributors",
    };
  }

  return {
    intentHeading: "What this query is trying to accomplish",
    mechanicsHeading: "Query Mechanics",
    traversalHeading: "Traversal",
    returnedShapeHeading: "Returned Shape",
    rawReferenceHeading: "Raw Query Reference",
    mechanicsPipelineLabel: "Query Mechanics",
    traversalPipelineLabel: "Traversal",
    returnedShapePipelineLabel: "Returned Shape",
    footerSubject: "query shape",
    expandsLabel: "Expands",
  };
}

type UnderstandingLabels = ReturnType<typeof getUnderstandingLabels>;

function renderMechanics(
  document: UnderstandingDocument,
  labels: UnderstandingLabels,
): string[] {
  const mechanics = document.mechanics;
  const mechanicLines: string[] = [];
  if (mechanics.rootTarget) {
    mechanicLines.push(`- Root target: \`${mechanics.rootTarget}\``);
  }
  mechanicLines.push(`- Operation: ${mechanics.operation}`);
  mechanicLines.push(
    `- Projection: ${mechanics.projection.length ? mechanics.projection.map((item) => `\`${item}\``).join(", ") : "*(not specified)*"}`,
  );
  mechanicLines.push(
    `- Filters: ${mechanics.filters.length ? mechanics.filters.map((item) => `\`${item}\``).join("; ") : "*(none)*"}`,
  );
  mechanicLines.push(
    `- Ordering: ${mechanics.ordering.length ? mechanics.ordering.map((item) => `\`${item}\``).join(", ") : "*(none)*"}`,
  );
  if (typeof mechanics.rowLimit === "number") {
    mechanicLines.push(`- Row limit: \`${mechanics.rowLimit}\``);
  }
  if (mechanics.expands.length) {
    mechanicLines.push(`- ${labels.expandsLabel}:`);
    for (const expand of mechanics.expands) {
      mechanicLines.push(
        `  - \`${expand.navigationProperty}\`${expand.nestedProjection.length ? ` with nested projection ${expand.nestedProjection.map((item) => `\`${item}\``).join(", ")}` : " without nested projection"}`,
      );
      if (expand.explanation) {
        mechanicLines.push(`    - ${expand.explanation}`);
      }
    }
  } else {
    mechanicLines.push(`- ${labels.expandsLabel}: *(none)*`);
  }
  if (mechanics.unknownOptions.length) {
    mechanicLines.push(
      `- Unknown options: ${mechanics.unknownOptions.map((item) => `\`${item}\``).join(", ")}`,
    );
  }
  return mechanicLines;
}

function renderRecommendations(
  lines: string[],
  heading: string,
  document: UnderstandingDocument,
): void {
  if (!document.recommendations.length) {
    return;
  }

  lines.push(`## ${heading}`);
  lines.push("");
  for (const recommendation of document.recommendations) {
    lines.push(`- **${recommendation.title}**`);
    lines.push(`  - Detail: ${recommendation.detail}`);
    if (recommendation.rationale) {
      lines.push(`  - Rationale: ${recommendation.rationale}`);
    }
    lines.push(`  - Confidence: ${recommendation.confidence}`);
    if (
      recommendation.actionability &&
      recommendation.actionability !== "none"
    ) {
      lines.push(`  - Actionability: ${recommendation.actionability}`);
    }
    if (recommendation.previewQuery) {
      lines.push(`  - Preview query: \`${recommendation.previewQuery}\``);
    }
  }
  lines.push("");
}

function pushSignals(
  lines: string[],
  document: UnderstandingDocument,
  positiveHeading = "Positive Findings",
  riskHeading = "Investigation Smells & Risks",
): void {
  if (!document.signals.length) {
    return;
  }

  const positives = document.signals.filter(
    (signal) => signal.kind === "positive",
  );
  const smells = document.signals.filter(
    (signal) =>
      signal.kind === "smell" ||
      signal.kind === "risk" ||
      signal.kind === "unknown",
  );
  pushSection(
    lines,
    positiveHeading,
    positives.map((signal) => `- **${signal.title}:** ${signal.detail}`),
  );
  pushSection(
    lines,
    riskHeading,
    smells.map((signal) => `- **${signal.title}:** ${signal.detail}`),
  );
}


function renderComparisonExplainSurface(): string[] {
  return [
    "**Cross Diff Explain** helps investigators understand a comparison before reviewing the underlying evidence.",
    "It summarises the most significant operational changes, highlights investigation priorities, and explains what DV Quick Run observed while preserving the complete technical evidence underneath.",
    "This explanation is advisory. It assists investigation, but does not replace provider evidence, raw comparison data, audit evidence, or reconstruction review.",
    "",
    "> This report is generated as Markdown so it can be previewed in VS Code, versioned alongside investigation evidence, shared during handoffs, and retained as part of the investigation record.",
  ];
}

function extractSnapshotEvidence(document: UnderstandingDocument, label: string): string | undefined {
  const found = document.evidence.find((evidence) => evidence.label.toLowerCase().startsWith(label.toLowerCase()));
  return found?.detail;
}

function providerDomainLabel(title: string): string {
  const normalized = title.toLowerCase();
  if (normalized.includes("comparison view")) {
    return "";
  }
  if (normalized.includes("plugin")) {
    return "Plugin Runtime";
  }
  if (normalized.includes("workflow") || normalized.includes("automation")) {
    return "Workflow & Automation";
  }
  if (normalized.includes("solution")) {
    return "Solution Participation";
  }
  if (normalized.includes("identity") || normalized.includes("security") || normalized.includes("role") || normalized.includes("team")) {
    return "Security & Identity";
  }
  if (normalized.includes("column") || normalized.includes("entity configuration")) {
    return "Entity Metadata";
  }
  if (normalized.includes("relationship")) {
    return "Relationship Metadata";
  }
  if (normalized.includes("choice") || normalized.includes("option")) {
    return "Choice Metadata";
  }
  if (normalized.includes("environment variable")) {
    return "Environment Variables";
  }
  if (normalized.includes("operational profile")) {
    return "Operational Profile";
  }
  return title;
}

function uniqueProviderDomains(document: UnderstandingDocument): string[] {
  const seen = new Set<string>();
  const domains: string[] = [];
  for (const contributor of document.sourceContributors) {
    const domain = providerDomainLabel(contributor.title);
    if (!domain) {
      continue;
    }
    if (!seen.has(domain)) {
      seen.add(domain);
      domains.push(domain);
    }
  }
  return domains;
}

function comparisonEvidenceProviderCount(document: UnderstandingDocument): number {
  return document.sourceContributors.filter((contributor) =>
    contributor.title.toLowerCase() !== "comparison view model"
  ).length;
}

function renderInvestigationConfidenceBasis(document: UnderstandingDocument): string[] {
  const sourceTrust = document.technical.sections
    .flatMap((section) => section.lines)
    .find((line) => line.toLowerCase().startsWith("- source trust:"));
  const targetTrust = document.technical.sections
    .flatMap((section) => section.lines)
    .find((line) => line.toLowerCase().startsWith("- target trust:"));
  const lines: string[] = [];

  if (sourceTrust?.toLowerCase().includes("verified")) {
    lines.push("- ✓ Verified source snapshot");
  }
  if (targetTrust?.toLowerCase().includes("verified")) {
    lines.push("- ✓ Verified target snapshot");
  }
  const evidenceProviderCount = comparisonEvidenceProviderCount(document);
  if (evidenceProviderCount) {
    lines.push(`- ✓ ${evidenceProviderCount} evidence providers completed`);
  }
  if (document.returnedShape.length) {
    lines.push("- ✓ Provider-owned significance available");
  }
  if (document.mechanics.ordering.length) {
    lines.push("- ✓ Evidence ordering preserved");
  }
  if (document.evidence.length) {
    lines.push("- ✓ Evidence references retained");
  }

  return lines;
}

function renderInvestigationSummary(document: UnderstandingDocument): string[] {
  const lines: string[] = [
    document.narrative.overview,
    "",
    `- Overall confidence: **${titleCase(document.confidence)}**`,
    `- Investigation complexity: **${document.complexity.level}** (${document.complexity.score}/100)`,
    ...document.complexity.reasons.map((reason) => `- ${reason}`),
  ];

  const confidenceBasis = renderInvestigationConfidenceBasis(document);
  if (confidenceBasis.length) {
    lines.push("", "Confidence is based on:", ...confidenceBasis);
  }

  return lines;
}

function renderComparisonProfile(document: UnderstandingDocument): string[] {
  const sourceSnapshot = extractSnapshotEvidence(document, "Source snapshot");
  const targetSnapshot = extractSnapshotEvidence(document, "Target snapshot");
  const profileLines: string[] = [];

  profileLines.push(`- Comparison type: **${document.mechanics.operation}**`);
  if (document.mechanics.rootTarget) {
    profileLines.push(`- Entity: **${document.mechanics.rootTarget}**`);
  } else if (document.subject.entityLogicalName) {
    profileLines.push(`- Entity: \`${document.subject.entityLogicalName}\``);
  }
  if (sourceSnapshot && targetSnapshot) {
    profileLines.push(`- Snapshots compared: **${sourceSnapshot}** → **${targetSnapshot}**`);
  }
  return profileLines;
}

function renderCriticalOperationalChanges(document: UnderstandingDocument): string[] {
  const highChanges: string[] = [];
  const otherChanges: string[] = [];

  for (const node of document.returnedShape) {
    for (const field of node.fields) {
      const parts = field.split(" · ");
      const significance = parts.length >= 3 ? parts[1]?.trim().toLowerCase() : "";
      const description = parts.length >= 3 ? parts.slice(2).join(" · ").trim() : field.trim();
      if (!description) {
        continue;
      }
      if (significance === "high") {
        highChanges.push(description);
      } else {
        otherChanges.push(description);
      }
    }
  }

  const lines: string[] = [];
  if (highChanges.length || otherChanges.length) {
    lines.push("### Critical operational changes");
    lines.push("");
    if (highChanges.length) {
      lines.push("#### High significance");
      lines.push("");
      for (const change of highChanges.slice(0, 8)) {
        lines.push(`- ${change}`);
      }
      lines.push("");
    }
    if (otherChanges.length) {
      lines.push("#### Other notable changes");
      lines.push("");
      for (const change of otherChanges.slice(0, Math.max(0, 8 - Math.min(highChanges.length, 8)))) {
        lines.push(`- ${change}`);
      }
      lines.push("");
    }
  }

  const affectedAreas = document.returnedShape
    .filter((node) => node.depth === 0)
    .map((node) => providerDomainLabel(node.label))
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 10);
  if (affectedAreas.length) {
    lines.push("### Affected investigation areas");
    lines.push("");
    for (const area of affectedAreas) {
      lines.push(`- ${area}`);
    }
    lines.push("");
  }

  const detailLines = renderReturnedShape(document.returnedShape);
  if (detailLines.length) {
    lines.push("### Detailed provider highlights");
    lines.push("");
    lines.push(...detailLines);
  }
  return lines;
}

function renderComparisonScope(document: UnderstandingDocument): string[] {
  const lines: string[] = [];
  if (document.mechanics.rootTarget) {
    lines.push(`- Entity: **${document.mechanics.rootTarget}**`);
  } else if (document.subject.entityLogicalName) {
    lines.push(`- Entity: \`${document.subject.entityLogicalName}\``);
  }
  lines.push(`- Operation: **${document.mechanics.operation}**`);
  lines.push("- Investigation strategy: **Provider-based evidence comparison**");
  lines.push(`- Evidence ordering: ${document.mechanics.ordering.length ? document.mechanics.ordering.join(", ") : "provider-owned order"}`);
  lines.push("- Evidence domains:");
  for (const domain of uniqueProviderDomains(document)) {
    lines.push(`  - ${domain}`);
  }
  return lines;
}

function renderEvidenceCoverage(document: UnderstandingDocument): string[] {
  const domains = uniqueProviderDomains(document);
  if (!domains.length) {
    return [];
  }
  return domains.map((domain) => `- ✓ ${domain}`);
}

function pushComparisonBriefing(
  lines: string[],
  document: UnderstandingDocument,
  labels: UnderstandingLabels,
): void {
  pushSection(lines, "Explain", renderComparisonExplainSurface());

  pushSection(lines, "Investigation Summary", renderInvestigationSummary(document));

  pushSection(lines, labels.intentHeading, document.narrative.intent);

  pushSection(lines, "Comparison", renderComparisonProfile(document));

  pushSection(
    lines,
    labels.returnedShapeHeading,
    renderCriticalOperationalChanges(document),
  );
  pushSignals(lines, document, "Positive Findings", "Investigation Priority & Risks");
  renderRecommendations(lines, "Recommended Investigation Path", document);

  lines.push("---");
  lines.push("");
  lines.push("The sections below contain the detailed technical explanation supporting the investigation summary above.");
  lines.push("");
  lines.push("---");
  lines.push("");
}

function pushQueryBriefing(
  lines: string[],
  document: UnderstandingDocument,
  labels: UnderstandingLabels,
): void {
  pushSection(lines, "Investigation Narrative", [document.narrative.overview]);
  pushSection(lines, labels.intentHeading, document.narrative.intent);

  const profileLines: string[] = [];
  if (document.narrative.investigationStage) {
    profileLines.push(`- Stage: **${document.narrative.investigationStage}**`);
  }
  if (document.narrative.investigationPattern) {
    profileLines.push(`- Pattern: **${document.narrative.investigationPattern}**`);
  }
  profileLines.push(
    `- Complexity: **${document.complexity.level}** (${document.complexity.score}/100)`,
  );
  pushSection(lines, "Investigation Profile", profileLines);

  pushSection(lines, "Investigation Complexity", [
    `- Level: **${document.complexity.level}**`,
    `- Score: ${document.complexity.score}/100`,
    ...document.complexity.reasons.map((reason) => `- ${reason}`),
  ]);

  lines.push("---");
  lines.push("");
}

function isComparisonUnderstanding(document: UnderstandingDocument): boolean {
  return (
    document.subject.kind === "crossDiff" ||
    document.subject.kind === "timelineDiff"
  );
}

export function renderUnderstandingDocumentMarkdown(
  document: UnderstandingDocument,
): string {
  const lines: string[] = [];
  const labels = getUnderstandingLabels(document);
  const comparisonUnderstanding = isComparisonUnderstanding(document);

  lines.push(`# ${document.title}`);
  lines.push("");
  if (comparisonUnderstanding) {
    lines.push(`> **Cross-Environment Diff Explain** · Generated by Understanding Engine **${document.engineVersion}**`);
    lines.push("");
  }
  lines.push("## Report Information");
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

  lines.push(
    `> **Invariant:** ${document.invariant} Plain-English interpretation is provided first, and the technical breakdown remains available underneath.`,
  );
  lines.push("");

  lines.push("---");
  lines.push("");

  if (comparisonUnderstanding) {
    pushComparisonBriefing(lines, document, labels);
  } else {
    pushQueryBriefing(lines, document, labels);
  }

  if (comparisonUnderstanding) {
    pushSection(lines, labels.mechanicsHeading, renderComparisonScope(document));
    pushSection(lines, labels.traversalHeading, renderEvidenceCoverage(document));
  } else {
    pushSection(lines, labels.mechanicsHeading, renderMechanics(document, labels));
    pushSection(
      lines,
      labels.traversalHeading,
      renderTraversal(document.traversal),
    );
  }
  if (!comparisonUnderstanding) {
    pushSection(
      lines,
      labels.returnedShapeHeading,
      renderReturnedShape(document.returnedShape),
    );
    pushSignals(lines, document);
  }

  lines.push("---");
  lines.push("");

  pushSection(lines, "Technical Breakdown", document.technical.summary);
  for (const section of document.technical.sections) {
    pushSection(lines, section.heading, renderTechnicalSection(section), "###");
  }

  if (!comparisonUnderstanding) {
    renderRecommendations(lines, "Recommendations", document);
  }

  if (document.evidence.length) {
    lines.push("## Evidence References");
    lines.push("");
    for (const evidence of document.evidence) {
      lines.push(`- ${evidence.label}: ${evidence.detail}`);
    }
    lines.push("");
  }

  if (comparisonUnderstanding) {
    lines.push("## Appendix");
    lines.push("");

    lines.push("### Investigation Pipeline");
    lines.push("");
    lines.push("- ✓ Investigation Summary");
    lines.push(`- ✓ ${labels.mechanicsPipelineLabel}`);
    lines.push(`- ✓ ${labels.traversalPipelineLabel}`);
    lines.push(`- ✓ ${labels.returnedShapePipelineLabel}`);
    lines.push("- ✓ Technical Breakdown");
    if (document.recommendations.length) {
      lines.push("- ✓ Recommended Investigation Path");
    }
    for (const contributor of document.sourceContributors) {
      lines.push(`- ✓ ${contributor.title}`);
    }
    lines.push("");

    lines.push(`### ${labels.rawReferenceHeading}`);
  } else {
    lines.push(`## ${labels.rawReferenceHeading}`);
  }
  lines.push("");
  lines.push(`\`\`\`${document.rawReference.language}`);
  lines.push(document.rawReference.text);
  lines.push("``` ".trim());
  lines.push("");

  if (!comparisonUnderstanding) {
    lines.push("## Investigation Pipeline");
    lines.push("");
    lines.push("- ✓ Investigation Narrative");
    lines.push(`- ✓ ${labels.mechanicsPipelineLabel}`);
    lines.push(`- ✓ ${labels.traversalPipelineLabel}`);
    lines.push(`- ✓ ${labels.returnedShapePipelineLabel}`);
    lines.push("- ✓ Technical Breakdown");
    if (document.recommendations.length) {
      lines.push("- ✓ Recommendations");
    }
    for (const contributor of document.sourceContributors) {
      lines.push(`- ✓ ${contributor.title}`);
    }
    lines.push("");
  }
  lines.push(
    `This understanding document is advisory and evidence-backed. It explains ${labels.footerSubject} and investigation posture, but does not establish operational authority, root cause, or deployment correctness.`,
  );

  return lines.join("\n");
}
