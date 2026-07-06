import type { ComparisonDriftGroup, ComparisonOperationalSignificance, ComparisonProviderResult, ComparisonViewModel } from "../../core/comparison/index.js";
import type { AuditEvidenceResult } from "../audit/auditEvidenceTypes.js";
import type { ReconstructionArtifactReference } from "../reconstruction/reconstructionArtifactReference.js";
import type { UnderstandingComplexityLevel, UnderstandingConfidence, UnderstandingDocument, UnderstandingEvidence, UnderstandingRecommendation, UnderstandingReturnedShapeNode, UnderstandingSignal, UnderstandingTechnicalSection, UnderstandingTraversalNode } from "../understanding/understandingTypes.js";

const invariant = "Narrative must never replace technical truth.";

export interface ComparisonUnderstandingContext {
  readonly auditEvidenceResults?: readonly AuditEvidenceResult[];
  readonly reconstructionArtifacts?: readonly ReconstructionArtifactReference[];
}

function significanceRank(value: ComparisonOperationalSignificance): number {
  switch (value) {
    case "High":
      return 3;
    case "Medium":
      return 2;
    case "Low":
    default:
      return 1;
  }
}

function getTopGroups(model: ComparisonViewModel): readonly ComparisonDriftGroup[] {
  return [...model.groups]
    .sort((left, right) => significanceRank(right.significance) - significanceRank(left.significance) || right.differences.length - left.differences.length)
    .slice(0, 5);
}

function resolveConfidence(model: ComparisonViewModel, context: ComparisonUnderstandingContext): UnderstandingConfidence {
  const trustValues = [model.snapshotTrust?.sourceTrustState, model.snapshotTrust?.targetTrustState].filter(Boolean);
  if (trustValues.some((value) => value === "Invalid" || value === "Legacy / Unverified")) {
    return "low";
  }

  if (trustValues.some((value) => value === "Modified")) {
    return "medium";
  }

  if ((context.auditEvidenceResults?.length ?? 0) > 0 || model.providerResults.length > 0) {
    return "high";
  }

  return "medium";
}

function resolveComplexityLevel(score: number): UnderstandingComplexityLevel {
  if (score >= 70) {
    return "High";
  }

  if (score >= 35) {
    return "Medium";
  }

  return "Low";
}

function buildComplexity(model: ComparisonViewModel, context: ComparisonUnderstandingContext): { readonly level: UnderstandingComplexityLevel; readonly score: number; readonly reasons: string[] } {
  const differenceScore = Math.min(45, model.summary.differenceCount * 3);
  const providerScore = Math.min(20, model.summary.providerCount * 3);
  const highScore = Math.min(20, model.summary.highCount * 5);
  const evidenceScore = (context.auditEvidenceResults?.length ?? 0) > 0 ? 8 : 0;
  const artifactScore = (context.reconstructionArtifacts?.length ?? 0) > 0 ? 7 : 0;
  const score = Math.min(100, differenceScore + providerScore + highScore + evidenceScore + artifactScore);
  const reasons: string[] = [];

  if (model.summary.differenceCount > 0) {
    reasons.push(`${model.summary.differenceCount} evidence-backed difference${model.summary.differenceCount === 1 ? "" : "s"} were returned by comparison providers.`);
  } else {
    reasons.push("No provider differences were returned for the selected snapshots.");
  }

  if (model.summary.highCount > 0) {
    reasons.push(`${model.summary.highCount} high-significance signal${model.summary.highCount === 1 ? "" : "s"} require careful external review.`);
  }

  if ((context.auditEvidenceResults?.length ?? 0) > 0) {
    reasons.push("Inline audit evidence has been added as supporting context, not as replacement truth.");
  }

  if ((context.reconstructionArtifacts?.length ?? 0) > 0) {
    reasons.push("Reconstruction artifact references are present and remain preview/export intent only.");
  }

  return {
    level: resolveComplexityLevel(score),
    score,
    reasons
  };
}

function buildTraversal(model: ComparisonViewModel): UnderstandingTraversalNode[] {
  const nodes: UnderstandingTraversalNode[] = [
    {
      label: "Comparison session",
      technicalName: model.session?.mode ?? (model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff"),
      depth: 0,
      relationship: "source snapshot → target snapshot"
    }
  ];

  for (const provider of model.providerResults) {
    nodes.push({
      label: provider.title,
      technicalName: provider.providerId,
      depth: 1,
      relationship: "comparison provider"
    });
  }

  return nodes;
}

function buildReturnedShape(model: ComparisonViewModel): UnderstandingReturnedShapeNode[] {
  if (!model.groups.length) {
    return [{
      label: "Comparison result",
      depth: 0,
      fields: ["No operational drift groups returned"]
    }];
  }

  return getTopGroups(model).map((group) => ({
    label: group.title,
    technicalName: group.id,
    depth: 0,
    fields: group.differences.slice(0, 5).map((difference) => `${difference.kind} · ${difference.significance} · ${difference.title}`)
  }));
}

function buildSignals(model: ComparisonViewModel, context: ComparisonUnderstandingContext): UnderstandingSignal[] {
  const signals: UnderstandingSignal[] = [];

  if (model.summary.differenceCount === 0) {
    signals.push({
      kind: "positive",
      title: "No provider drift returned",
      detail: "The selected comparison providers did not find evidence-backed operational drift for this session.",
      confidence: resolveConfidence(model, context)
    });
  }

  if (model.summary.highCount > 0) {
    signals.push({
      kind: "risk",
      title: "High-significance drift present",
      detail: `${model.summary.highCount} high-significance difference${model.summary.highCount === 1 ? "" : "s"} should be reviewed before any reconstruction or remediation workflow is considered.`,
      confidence: "high"
    });
  }

  const trustValues = [model.snapshotTrust?.sourceTrustState, model.snapshotTrust?.targetTrustState].filter(Boolean);
  if (trustValues.some((value) => value !== "Verified")) {
    signals.push({
      kind: "risk",
      title: "Snapshot trust is limited",
      detail: "One or more snapshots are modified, legacy, unverified, or invalid. Treat the comparison as inspectable evidence with trust limitations.",
      confidence: "high"
    });
  }

  if ((context.auditEvidenceResults?.length ?? 0) > 0) {
    signals.push({
      kind: "positive",
      title: "Audit evidence attached",
      detail: "Inline audit evidence has been collected for selected findings and can enrich the investigation narrative.",
      confidence: "medium"
    });
  }

  if ((context.reconstructionArtifacts?.length ?? 0) > 0) {
    signals.push({
      kind: "recommendation",
      title: "Reconstruction artifact references available",
      detail: "DV ForgeLab reconstruction artifacts have been exported as intent references only. They do not establish source correctness or target incorrectness.",
      confidence: "high"
    });
  }

  return signals;
}

function buildRecommendations(model: ComparisonViewModel, context: ComparisonUnderstandingContext): UnderstandingRecommendation[] {
  const recommendations: UnderstandingRecommendation[] = [
    {
      title: "Review high-significance groups first",
      detail: model.summary.highCount > 0
        ? "Start with high-significance operational drift before reviewing medium and low findings."
        : "No high-significance findings were returned; review medium/low findings for completeness if this is a release gate.",
      rationale: "Provider-owned significance is the safest ordering signal in Cross Diff Understanding.",
      confidence: "high",
      actionability: "none"
    },
    {
      title: "Keep reconstruction separate from comparison truth",
      detail: "Treat DVAF/DVIM/DVCE/DVEVM artifacts as preview/export handoffs only, not as remediation authority.",
      rationale: "DVQR observes and explains drift; external utilities own staging, preview, apply, and execution review.",
      confidence: "high",
      actionability: "none"
    }
  ];

  if ((context.auditEvidenceResults?.length ?? 0) === 0 && model.summary.differenceCount > 0) {
    recommendations.push({
      title: "Attach audit evidence where available",
      detail: "Use inline audit evidence for selected findings when entity and interval evidence are available.",
      rationale: "Audit evidence can help answer who changed what during the snapshot interval, but remains supplementary.",
      confidence: "medium",
      actionability: "none"
    });
  }

  return recommendations;
}

function buildEvidence(model: ComparisonViewModel, context: ComparisonUnderstandingContext): UnderstandingEvidence[] {
  const evidence: UnderstandingEvidence[] = [
    {
      label: "Source snapshot",
      detail: `${model.summary.sourceLabel}${model.summary.sourceCapturedAtIso ? ` · captured ${model.summary.sourceCapturedAtIso}` : ""}`,
      confidence: model.snapshotTrust?.sourceTrustState === "Verified" ? "high" : "medium"
    },
    {
      label: "Target snapshot",
      detail: `${model.summary.targetLabel}${model.summary.targetCapturedAtIso ? ` · captured ${model.summary.targetCapturedAtIso}` : ""}`,
      confidence: model.snapshotTrust?.targetTrustState === "Verified" ? "high" : "medium"
    },
    {
      label: "Provider results",
      detail: `${model.summary.providerCount} provider${model.summary.providerCount === 1 ? "" : "s"}; ${model.summary.differenceCount} difference${model.summary.differenceCount === 1 ? "" : "s"}`,
      confidence: "high"
    }
  ];

  for (const audit of context.auditEvidenceResults ?? []) {
    evidence.push({
      label: `Audit evidence · ${audit.title}`,
      detail: `${audit.status}: ${audit.summary}`,
      confidence: audit.status === "Found" ? "medium" : "low"
    });
  }

  for (const artifact of context.reconstructionArtifacts ?? []) {
    evidence.push({
      label: `${artifact.kind} artifact reference`,
      detail: `${artifact.artifactFileName} · ${artifact.reason}`,
      confidence: "high"
    });
  }

  return evidence;
}

function providerSummary(provider: ComparisonProviderResult): string {
  const differenceCount = provider.groups.reduce((sum, group) => sum + group.differences.length, 0);
  return `${provider.title}: ${provider.groups.length} group${provider.groups.length === 1 ? "" : "s"}, ${differenceCount} difference${differenceCount === 1 ? "" : "s"}.`;
}

function buildTechnicalSections(model: ComparisonViewModel, context: ComparisonUnderstandingContext): UnderstandingTechnicalSection[] {
  const sections: UnderstandingTechnicalSection[] = [
    {
      heading: "Provider Result Breakdown",
      lines: model.providerResults.length
        ? model.providerResults.map((provider) => `- ${providerSummary(provider)}`)
        : ["- No comparison provider results were returned."],
      confidence: "high"
    },
    {
      heading: "Snapshot Trust",
      lines: [
        `- Source trust: ${model.snapshotTrust?.sourceTrustState ?? "Unknown"}`,
        `- Target trust: ${model.snapshotTrust?.targetTrustState ?? "Unknown"}`,
        "- Trust-limited snapshots remain inspectable, but should not be treated as verified snapshot truth."
      ],
      confidence: resolveConfidence(model, context)
    }
  ];

  if ((context.auditEvidenceResults?.length ?? 0) > 0) {
    sections.push({
      heading: "Audit Evidence Context",
      lines: (context.auditEvidenceResults ?? []).map((result) => `- ${result.title}: ${result.status} · ${result.summary}`),
      confidence: "medium"
    });
  }

  if ((context.reconstructionArtifacts?.length ?? 0) > 0) {
    sections.push({
      heading: "Reconstruction Artifact Context",
      lines: (context.reconstructionArtifacts ?? []).map((artifact) => `- ${artifact.kind}: ${artifact.artifactFileName} · ${artifact.support} · ${artifact.reason}`),
      confidence: "high"
    });
  }

  return sections;
}

function buildRawReference(model: ComparisonViewModel): string {
  return JSON.stringify({
    title: model.title,
    summary: model.summary,
    snapshotTrust: model.snapshotTrust,
    session: model.session,
    groups: model.groups.map((group) => ({
      id: group.id,
      title: group.title,
      significance: group.significance,
      differenceCount: group.differences.length
    })),
    providerResults: model.providerResults.map((provider) => ({
      providerId: provider.providerId,
      title: provider.title,
      groupCount: provider.groups.length,
      differenceCount: provider.groups.reduce((sum, group) => sum + group.differences.length, 0)
    }))
  }, null, 2);
}

export function buildComparisonUnderstandingDocument(model: ComparisonViewModel, context: ComparisonUnderstandingContext = {}): UnderstandingDocument {
  const confidence = resolveConfidence(model, context);
  const complexity = buildComplexity(model, context);
  const mode = model.title.startsWith("Timeline Diff") ? "Timeline Diff" : "Cross-Environment Diff";
  const topGroups = getTopGroups(model);
  const scope = model.summary.subjectLabel ?? model.summary.entityLogicalName ?? "selected snapshots";

  return {
    schemaVersion: "1.0",
    engineVersion: "v2.2",
    title: `${mode} Understanding Report`,
    generatedAt: new Date().toISOString(),
    subject: {
      kind: mode === "Timeline Diff" ? "timelineDiff" : "crossDiff",
      entityLogicalName: model.summary.entityLogicalName
    },
    confidence,
    audience: ["investigator", "developer", "admin", "handoff"],
    invariant,
    narrative: {
      overview: `DV Quick Run detected ${model.summary.differenceCount} evidence-backed operational difference${model.summary.differenceCount === 1 ? "" : "s"} between the selected ${model.summary.sourceLabel} and ${model.summary.targetLabel} snapshots for ${scope}. ${model.summary.highCount} difference${model.summary.highCount === 1 ? " is" : "s are"} classified as High significance and should be investigated first before considering reconstruction or remediation.`,
      intent: [
        "Compare the selected snapshots, explain the operational differences discovered by provider-owned evidence, and preserve reconstruction and audit artifacts as supporting context rather than operational authority."
      ],
      investigationStage: "Cross-environment understanding",
      investigationPattern: "Snapshot comparison → provider drift groups → evidence references → optional audit/reconstruction context"
    },
    technical: {
      summary: [
        `${model.summary.providerCount} comparison provider${model.summary.providerCount === 1 ? "" : "s"} contributed to this model.`,
        `${model.summary.differenceCount} difference${model.summary.differenceCount === 1 ? "" : "s"}: ${model.summary.highCount} high, ${model.summary.mediumCount} medium, ${model.summary.lowCount} low.`,
        topGroups.length
          ? `Top groups: ${topGroups.map((group) => `${group.title} (${group.significance})`).join("; ")}.`
          : "No drift groups were returned."
      ],
      sections: buildTechnicalSections(model, context)
    },
    mechanics: {
      rootTarget: scope,
      operation: mode,
      projection: ["summary", "snapshotTrust", "providerResults", "groups", "differences", "evidence"],
      filters: model.summary.entityLogicalName ? [`entityLogicalName eq ${model.summary.entityLogicalName}`] : [],
      ordering: ["provider-owned operational significance", "difference count", "rendered group order"],
      expands: model.providerResults.map((provider) => ({
        navigationProperty: provider.providerId,
        nestedProjection: ["groups", "differences", "evidence", "continuations"],
        raw: provider.providerId,
        explanation: provider.title
      })),
      unknownOptions: []
    },
    traversal: buildTraversal(model),
    returnedShape: buildReturnedShape(model),
    complexity,
    signals: buildSignals(model, context),
    recommendations: buildRecommendations(model, context),
    evidence: buildEvidence(model, context),
    rawReference: {
      language: "text",
      text: buildRawReference(model)
    },
    sourceContributors: [
      { id: "comparison-view-model", title: "Comparison View Model" },
      ...model.providerResults.map((provider) => ({ id: provider.providerId, title: provider.title })),
      ...((context.auditEvidenceResults?.length ?? 0) > 0 ? [{ id: "audit-evidence", title: "Audit Evidence Context" }] : []),
      ...((context.reconstructionArtifacts?.length ?? 0) > 0 ? [{ id: "reconstruction-artifacts", title: "Reconstruction Artifact Context" }] : [])
    ]
  };
}
