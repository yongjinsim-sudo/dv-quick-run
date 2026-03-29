import type {
  TraversalEnrichmentCandidate,
  TraversalInsightAction,
  TraversalInsightActionContext
} from "./traversalTypes.js";

function buildEnrichmentAction(
  candidate: TraversalEnrichmentCandidate,
  index: number
): TraversalInsightAction {
  return {
    actionId: `traversal.enrich.${index + 1}`,
    title: `Enhance with ${candidate.targetEntity}`,
    description: `${candidate.kind} via ${candidate.relationshipName}`,
    kind: "enrich_current_leg",
    appliesToCurrentLegOnly: true
  };
}

export function appendTraversalInsightActions(
  context: TraversalInsightActionContext,
  existingActions: TraversalInsightAction[] = []
): TraversalInsightAction[] {
  const actions = [...existingActions];

  for (const [index, candidate] of context.executionPlan.enrichmentCandidates.entries()) {
    actions.push(buildEnrichmentAction(candidate, index));
  }

  actions.push({
    actionId: "traversal.insight.manual-merge-preview",
    title: "Preview mergeable path insight",
    description:
      context.itinerary.steps.length >= 2
        ? "Future actionable insight model (current leg only)."
        : "Future actionable insight model.",
    kind: "manual_test_hook",
    appliesToCurrentLegOnly: true
  });

  return actions;
}
