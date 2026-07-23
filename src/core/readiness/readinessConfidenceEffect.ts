import type {
  ConfidenceLevel,
  InvestigationReadinessPosture,
  ReadinessConfidenceEffect
} from "./readinessContracts.js";

export interface ReadinessConfidenceResolutionV1 {
  readonly effect: ReadinessConfidenceEffect;
  readonly effectiveConfidence: ConfidenceLevel;
  readonly limitations: readonly string[];
}

export function defaultReadinessConfidenceEffect(
  posture: InvestigationReadinessPosture
): ReadinessConfidenceEffect {
  switch (posture) {
    case "Ready": return "Preserve";
    case "Conditional": return "Qualify";
    case "Limited": return "Dampen";
    case "NotAssessable": return "Withhold";
  }
}

export function applyReadinessConfidenceEffect(
  base: ConfidenceLevel,
  effect: ReadinessConfidenceEffect
): ConfidenceLevel {
  if (base === "Unknown" || effect === "Withhold") {
    return "Unknown";
  }
  if (effect !== "Dampen") {
    return base;
  }
  if (base === "High") {
    return "Medium";
  }
  return base === "Medium" ? "Low" : "Low";
}

export function resolveReadinessConfidence(
  posture: InvestigationReadinessPosture,
  base: ConfidenceLevel
): ReadinessConfidenceResolutionV1 {
  const effect = defaultReadinessConfidenceEffect(posture);
  const effectiveConfidence = applyReadinessConfidenceEffect(base, effect);
  const limitations: string[] = [];
  if (effect === "Qualify") {
    limitations.push("Readiness limitations qualify the synthesized confidence; the confidence label is unchanged.");
  } else if (effect === "Dampen") {
    limitations.push(base === "Low"
      ? "Readiness limitations are severe; synthesized confidence remains at the Low floor."
      : "Readiness limitations dampen synthesized confidence by one supported level at most.");
  } else if (effect === "Withhold") {
    limitations.push("A meaningful synthesized confidence is withheld because the investigation is not assessable.");
  }
  return { effect, effectiveConfidence, limitations };
}
