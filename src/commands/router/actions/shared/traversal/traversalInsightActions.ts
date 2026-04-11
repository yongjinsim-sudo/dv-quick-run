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
  void context.itinerary;

  const actions = [...existingActions];

  for (const [index, candidate] of context.executionPlan.enrichmentCandidates.entries()) {
    actions.push(buildEnrichmentAction(candidate, index));
  }

  return actions;
}
