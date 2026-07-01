import { combineConfidence } from "./explainConfidence.js";
import { buildConfidenceFactors, buildConfidenceSection, buildUnderstandingSection } from "./explainSynthesizer.js";
import type { ExplainContext, ExplainContributor, ExplainResult } from "./explainEngineTypes.js";

export async function runExplainEngine(
  title: string,
  context: ExplainContext,
  contributors: ExplainContributor[]
): Promise<ExplainResult> {
  const summaryLines: string[] = [];
  const sections: ExplainResult["sections"] = [];
  const observations: ExplainResult["observations"] = [];
  const evidence: ExplainResult["evidence"] = [];
  const unknowns: ExplainResult["unknowns"] = [];
  const recommendations: ExplainResult["recommendations"] = [];

  for (const contributor of contributors) {
    const contribution = await contributor.run(context);
    summaryLines.push(...(contribution.summaryLines ?? []));
    sections.push(...(contribution.sections ?? []));
    observations.push(...(contribution.observations ?? []));
    evidence.push(...(contribution.evidence ?? []));
    unknowns.push(...(contribution.unknowns ?? []));
    recommendations.push(...(contribution.recommendations ?? []));
  }

  const baseConfidence = combineConfidence([
    ...sections.map((section) => section.confidence ?? "medium"),
    ...observations.map((observation) => observation.confidence),
    ...recommendations.map((recommendation) => recommendation.confidence),
    unknowns.length ? "low" : "high"
  ]);
  const confidenceFactors = buildConfidenceFactors(sections, observations, unknowns, recommendations);
  const synthesizedSections = [
    buildConfidenceSection(baseConfidence, confidenceFactors),
    buildUnderstandingSection(observations)
  ].filter((section): section is NonNullable<typeof section> => Boolean(section));

  return {
    schemaVersion: "2.1",
    title,
    context: {
      ...context,
      generatedAt: context.generatedAt ?? new Date().toISOString()
    },
    confidence: baseConfidence,
    confidenceFactors,
    summaryLines,
    sections: [
      ...sections,
      ...synthesizedSections
    ],
    observations,
    evidence,
    unknowns,
    recommendations,
    contributors: contributors.map((contributor) => ({ id: contributor.id, title: contributor.title }))
  };
}
