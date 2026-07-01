import { combineConfidence } from "./explainConfidence.js";
import type { ExplainConfidenceFactor, ExplainConfidenceLevel, ExplainObservation, ExplainRecommendation, ExplainSection, ExplainUnknown } from "./explainEngineTypes.js";

function confidenceLabel(confidence: ExplainConfidenceLevel): string {
  return confidence === "high" ? "High" : confidence === "medium" ? "Medium" : confidence === "low" ? "Low" : "Unknown";
}

function markerFor(status: ExplainConfidenceFactor["status"]): string {
  return status === "supports" ? "✓" : status === "limits" ? "⚠" : "•";
}

function confidenceIntro(confidence: ExplainConfidenceLevel): string {
  switch (confidence) {
    case "high":
      return "DVQR can explain this query shape with high confidence because the recognised clauses are straightforward and supported by available evidence.";
    case "medium":
      return "DVQR can explain the main query shape, but some context is unavailable or advisory, so the assessment should be treated as guided interpretation rather than complete certainty.";
    case "low":
      return "DVQR can explain the broad query shape, but confidence is reduced because important context is partial or unavailable.";
    default:
      return "DVQR could not establish enough structured evidence to assign a confident assessment.";
  }
}

function nextStepForConfidence(factors: ExplainConfidenceFactor[]): string | undefined {
  const limitLabels = new Set(factors.filter((factor) => factor.status === "limits").map((factor) => factor.label));
  if (limitLabels.has("Execution evidence unavailable") && limitLabels.has("Relationship shape observed")) {
    return "Run the query once and review the expanded relationship payload before relying on it for comparison or handoff evidence.";
  }

  if (limitLabels.has("Execution evidence unavailable")) {
    return "Run the query once so DVQR can compare the parsed shape with observed rows and timing.";
  }

  if (limitLabels.has("Relationship shape observed")) {
    return "Review the expanded data shape manually because nested relationship diagnostics are still advisory.";
  }

  if (limitLabels.has("Unknown options present")) {
    return "Review the unknown query options manually before treating this output as operational evidence.";
  }

  return undefined;
}

export function buildUnderstandingSection(observations: ExplainObservation[]): ExplainSection | undefined {
  const patternObservations = observations
    .filter((observation) => ["projection", "filtering", "ordering", "paging", "relationship"].includes(observation.category))
    .sort((a, b) => (a.displayPriority ?? 100) - (b.displayPriority ?? 100));

  if (!patternObservations.length) {
    return undefined;
  }

  const lines: string[] = [
    "**Investigator's Mental Model**",
    "",
    "This query follows a common investigation pattern: retrieve a focused shape, inspect what comes back, narrow the question, validate the result, and only then capture evidence.",
    "",
    "Typical workflow: Retrieve → Inspect → Narrow → Validate → Capture Evidence",
    ""
  ];
  for (const observation of patternObservations) {
    lines.push(`- **${observation.title}.** ${observation.statement}`);
    if (observation.why) {
      lines.push(`  - Why it matters: ${observation.why}`);
    }
    if (observation.useWhen) {
      lines.push(`  - Use when: ${observation.useWhen}`);
    }
    if (observation.tradeOff) {
      lines.push(`  - Trade-off: ${observation.tradeOff}`);
    }
    if (observation.watchFor) {
      lines.push(`  - Watch for: ${observation.watchFor}`);
    }
  }

  return {
    heading: "Investigation Pattern",
    lines,
    confidence: combineConfidence(patternObservations.map((observation) => observation.confidence)),
    sourceContributor: "dvqr.synthesizer"
  };
}

export function buildConfidenceFactors(
  sections: ExplainSection[],
  observations: ExplainObservation[],
  unknowns: ExplainUnknown[],
  recommendations: ExplainRecommendation[]
): ExplainConfidenceFactor[] {
  const factors: ExplainConfidenceFactor[] = [];

  if (sections.some((section) => section.heading === "Raw Query")) {
    factors.push({
      label: "Query parsed",
      detail: "The query shape was parsed into recognised OData clauses.",
      status: "supports"
    });
  }

  if (observations.some((observation) => observation.category === "projection")) {
    factors.push({
      label: "Projection analysed",
      detail: "Selected columns were recognised and used to explain the intended payload shape.",
      status: "supports"
    });
  }

  if (observations.some((observation) => observation.category === "filtering")) {
    factors.push({
      label: "Filter boundary assessed",
      detail: "The presence or absence of a filter was used to assess investigation focus.",
      status: "supports"
    });
  }

  if (observations.some((observation) => observation.category === "relationship")) {
    factors.push({
      label: "Relationship shape observed",
      detail: "Expand clauses were recognised, but nested relationship diagnostics may still be partial.",
      status: "limits"
    });
  }

  if (sections.some((section) => section.heading === "Evidence")) {
    factors.push({
      label: "Execution evidence available",
      detail: "The explanation includes the latest observed row count and execution timing.",
      status: "supports"
    });
  } else {
    factors.push({
      label: "Execution evidence unavailable",
      detail: "The assessment explains query shape but cannot compare it with a recent observed execution.",
      status: "limits"
    });
  }

  if (unknowns.length) {
    factors.push({
      label: "Unknown options present",
      detail: "Some query options were preserved but not interpreted by the Explain Engine.",
      status: "limits"
    });
  }

  if (recommendations.length) {
    factors.push({
      label: "Advisory recommendations generated",
      detail: "Query Doctor contributed review guidance; recommendations remain advisory rather than causal claims.",
      status: "neutral"
    });
  }

  return factors;
}

export function buildConfidenceSection(confidence: ExplainConfidenceLevel, factors: ExplainConfidenceFactor[]): ExplainSection | undefined {
  if (!factors.length) {
    return undefined;
  }

  const lines: string[] = [
    `- Overall confidence: **${confidenceLabel(confidence)}**`,
    `- ${confidenceIntro(confidence)}`,
    "",
    `Why confidence is ${confidenceLabel(confidence)}:`
  ];
  for (const factor of factors) {
    lines.push(`- ${markerFor(factor.status)} **${factor.label}:** ${factor.detail}`);
  }

  const nextStep = nextStepForConfidence(factors);
  if (nextStep) {
    lines.push("", "To increase confidence:", `- ${nextStep}`);
  }

  return {
    heading: "Confidence Assessment",
    lines,
    confidence,
    sourceContributor: "dvqr.synthesizer"
  };
}
