import { normalizeReasoningName } from "../metadataReasoning/metadataReasoningCommon.js";
import type {
  PlannedTraversalRoute,
  TraversalBreakpoint,
  TraversalExecutionPlan,
  TraversalExecutionStep,
  TraversalRoute
} from "./traversalTypes.js";

const BRIDGE_HINTS = [
  "intersect",
  "association",
  "associationentity",
  "link",
  "xref",
  "bridge",
  "join",
  "mapping",
  "map",
  "relationship",
  "rel",
  "junction",
  "activityparty",
  "annotation",
  "codeableconcept",
  "codeable_concept",
  "coding"
];

const STRONG_BUSINESS_HINTS = [
  "patient",
  "careplan",
  "task",
  "case",
  "incident",
  "opportunity",
  "invoice",
  "order",
  "quote"
];

const GENERIC_CORE_ENTITY_HINTS = [
  "account",
  "contact",
  "systemuser",
  "team",
  "businessunit",
  "activitypointer",
  "annotation"
];

export function buildPlannedTraversalRoute(route: TraversalRoute): PlannedTraversalRoute {
  const breakpoints = analyzeTraversalBreakpoints(route);
  const candidatePlans = buildTraversalExecutionPlans(route, breakpoints);
  const recommendedPlanId = candidatePlans.find((plan) => plan.recommended)?.planId;

  return {
    route,
    breakpoints,
    candidatePlans,
    recommendedPlanId
  };
}

export function analyzeTraversalBreakpoints(route: TraversalRoute): TraversalBreakpoint[] {
  const results: TraversalBreakpoint[] = [];

  for (let i = 1; i < route.entities.length - 1; i++) {
    const entity = route.entities[i]!;
    const normalized = normalizeReasoningName(entity);
    const reasons: string[] = [];
    let score = 0;

    if (looksDomainSpecificEntity(normalized)) {
      score += 35;
      reasons.push("domain-specific entity");
    }

    if (STRONG_BUSINESS_HINTS.some((hint) => normalized.includes(hint))) {
      score += 20;
      reasons.push("business-meaningful entity");
    }

    if (looksLikeBridgeEntity(normalized)) {
      score -= 30;
      reasons.push("bridge-like or technical entity");
    }

    if (looksGenericCoreEntity(normalized)) {
      score -= 10;
      reasons.push("generic core entity");
    }

    const centerIndex = (route.entities.length - 1) / 2;
    const distanceFromCenter = Math.abs(i - centerIndex);
    const waypointBonus = Math.max(0, 6 - distanceFromCenter * 3);

    score += waypointBonus;

    if (waypointBonus > 0) {
      reasons.push("useful central waypoint");
    }

    results.push({
      entity,
      entityIndex: i,
      score,
      reasons
    });
  }

  return results.sort(compareBreakpoints);
}

export function buildTraversalExecutionPlans(
  route: TraversalRoute,
  breakpoints: TraversalBreakpoint[] = analyzeTraversalBreakpoints(route)
): TraversalExecutionPlan[] {
  const splitCandidates = breakpoints.map((point) => point.entityIndex);
  const topTwoSplitIndexes = breakpoints
    .slice(0, 2)
    .map((point) => point.entityIndex)
    .sort((left, right) => left - right);

  const plans: TraversalExecutionPlan[] = [];

  plans.push(
    buildExecutionPlan(
      route,
      "Compact",
      getCompactSplitIndexes(route, breakpoints),
      "Fewer execution steps with stronger waypoint grouping."
    )
  );

  if (route.hopCount >= 3) {
    plans.push(
      buildExecutionPlan(
        route,
        "Mixed",
        topTwoSplitIndexes.length ? topTwoSplitIndexes : getCompactSplitIndexes(route, breakpoints),
        "Balanced grouping with extra control at meaningful waypoints."
      )
    );
  }

  if (splitCandidates.length > 0) {
    plans.push(
      buildExecutionPlan(
        route,
        "Detailed",
        [...splitCandidates].sort((left, right) => left - right),
        "Maximum control by splitting at every intermediate table."
      )
    );
  }

  const deduped = dedupePlans(plans);
  const recommendedLabel = getRecommendedPlanLabel(route, deduped);

  return deduped.map((plan) => ({
    ...plan,
    recommended: plan.label === recommendedLabel
  }));
}

function buildExecutionPlan(
  route: TraversalRoute,
  label: TraversalExecutionPlan["label"],
  splitIndexes: number[],
  rationale: string
): TraversalExecutionPlan {
  const orderedSplits = [...new Set(splitIndexes)].sort((left, right) => left - right);
  const steps: TraversalExecutionStep[] = [];

  let startIndex = 0;

  for (const splitIndex of [...orderedSplits, route.entities.length - 1]) {
    const entities = route.entities.slice(startIndex, splitIndex + 1);
    const edges = route.edges.slice(startIndex, splitIndex);
    const fromEntity = entities[0]!;
    const toEntity = entities[entities.length - 1]!;

    steps.push({
      stepNumber: steps.length + 1,
      fromEntity,
      toEntity,
      entities,
      edges,
      hopCount: edges.length,
      stageLabel: `${fromEntity} → ${toEntity}`
    });

    startIndex = splitIndex;
  }

  return {
    planId: `${route.routeId}:${label.toLowerCase()}`,
    label,
    rationale,
    steps
  };
}

function getCompactSplitIndexes(
  route: TraversalRoute,
  breakpoints: TraversalBreakpoint[]
): number[] {
  if (route.hopCount <= 2) {
    return [];
  }

  const strongest = breakpoints[0];
  return strongest ? [strongest.entityIndex] : [Math.floor(route.entities.length / 2)];
}

function getRecommendedPlanLabel(
  route: TraversalRoute,
  plans: TraversalExecutionPlan[]
): TraversalExecutionPlan["label"] {
  const available = new Set(plans.map((plan) => plan.label));

  if (route.hopCount <= 2 && available.has("Compact")) {
    return "Compact";
  }

  if (route.hopCount >= 4 && available.has("Mixed")) {
    return "Mixed";
  }

  if (available.has("Compact")) {
    return "Compact";
  }

  return plans[0]?.label ?? "Compact";
}

function dedupePlans(plans: TraversalExecutionPlan[]): TraversalExecutionPlan[] {
  const result: TraversalExecutionPlan[] = [];
  const seen = new Set<string>();

  for (const plan of plans) {
    const signature = plan.steps.map((step) => step.stageLabel).join("|");

    if (seen.has(signature)) {
      continue;
    }

    seen.add(signature);
    result.push(plan);
  }

  return result;
}

function compareBreakpoints(left: TraversalBreakpoint, right: TraversalBreakpoint): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return left.entityIndex - right.entityIndex;
}

function looksLikeBridgeEntity(logicalName: string): boolean {
  const normalized = normalizeReasoningName(logicalName);

  if (!normalized) {
    return true;
  }

  return BRIDGE_HINTS.some((hint) => normalized.includes(hint));
}

function looksGenericCoreEntity(logicalName: string): boolean {
  const normalized = normalizeReasoningName(logicalName);

  if (!normalized) {
    return false;
  }

  return GENERIC_CORE_ENTITY_HINTS.includes(normalized);
}

function looksDomainSpecificEntity(logicalName: string): boolean {
  const normalized = normalizeReasoningName(logicalName);

  if (!normalized) {
    return false;
  }

  if (looksGenericCoreEntity(normalized)) {
    return false;
  }

  return normalized.includes("_");
}