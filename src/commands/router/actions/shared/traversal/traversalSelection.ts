import { normalizeReasoningName } from "../metadataReasoning/metadataReasoningCommon.js";
import type {
  TraversalExecutionPlan,
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
  "coding",
  "adx_",
  "async",
  "bulk",
  "queueitem"
];

const PRACTICAL_RELATIONSHIP_HINTS = [
  "primary",
  "owner",
  "customer",
  "parent",
  "contact",
  "patient",
  "careplan",
  "task",
  "regarding"
];

const NOISY_ENTITY_HINTS = [
  "asyncoperation",
  "syncrror",
  "letter",
  "adx_",
  "queueitem",
  "bulk",
  "activitymimeattachment",
  "annotation",
  "systemuser"
];

function countNoisyIntermediates(route: TraversalRoute): number {
  return getIntermediateEntities(route).filter((entity) => {
    const normalized = normalizeReasoningName(entity);
    return NOISY_ENTITY_HINTS.some((hint) => normalized.includes(hint));
  }).length;
}

function hasRepeatedIntermediate(route: TraversalRoute): boolean {
  const intermediates = getIntermediateEntities(route).map((entity) =>
    normalizeReasoningName(entity)
  );

  const seen = new Set<string>();

  for (const entity of intermediates) {
    if (seen.has(entity)) {
      return true;
    }

    seen.add(entity);
  }

  return false;
}

function isPotentiallyRunnableRoute(route: TraversalRoute): boolean {
  // Keep clean 1–2 hop routes
  if (route.hopCount <= 2) {
    return true;
  }

  // For now, suppress ugly deeper graph-only paths from the picker.
  // Re-enable selectively once 3+ continuation and fallback are mature.
  if (route.hopCount > 4) {
    return false;
  }

  if (countNoisyIntermediates(route) >= 2) {
    return false;
  }

  if (hasRepeatedIntermediate(route)) {
    return false;
  }

  if (getIntermediateEntities(route).some((entity) => looksLikeBridgeEntity(entity))) {
    return false;
  }

  return true;
}

export function getPracticalTraversalRoutes(routes: TraversalRoute[]): TraversalRoute[] {
  return routes.filter((route) => isPotentiallyRunnableRoute(route));
}

export type RankedTraversalRoute = {
  route: TraversalRoute;
  score: number;
  isBestMatch: boolean;
  reasons: string[];
};

function looksLikeBridgeEntity(logicalName: string): boolean {
  const normalized = normalizeReasoningName(logicalName);

  if (!normalized) {
    return true;
  }

  return BRIDGE_HINTS.some((hint) => normalized.includes(hint));
}

function getIntermediateEntities(route: TraversalRoute): string[] {
  if (route.entities.length <= 2) {
    return [];
  }

  return route.entities.slice(1, -1);
}

function humanizeName(value: string): string {
  return value
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();
}

function buildRelationshipPath(route: TraversalRoute): string {
  const relationships = route.edges
    .map((edge) => edge.navigationPropertyName)
    .filter((value) => !!value && value.trim().length > 0);

  return relationships.map((value) => humanizeName(value)).join(" → ");
}

function hasPracticalRelationshipHint(route: TraversalRoute): boolean {
  const relationshipPath = route.edges
    .map((edge) => normalizeReasoningName(edge.navigationPropertyName))
    .join(" ");

  return PRACTICAL_RELATIONSHIP_HINTS.some((hint) => relationshipPath.includes(hint));
}

function isCleanDirectRoute(route: TraversalRoute): boolean {
  return route.hopCount === 1 && getIntermediateEntities(route).length === 0;
}

export function scoreTraversalRouteForSelection(route: TraversalRoute): number {
  let score = 0;

  score -= route.hopCount * 100;

  if (route.confidence === "high") {
    score += 40;
  }

  const intermediates = getIntermediateEntities(route);

  if (!intermediates.length) {
    score += 30;
  }

  for (const entity of intermediates) {
    if (looksLikeBridgeEntity(entity)) {
      score -= 40;
    } else {
      score += 20;
    }
  }

  if (isCleanDirectRoute(route)) {
    score += 60;
  }

  if (hasPracticalRelationshipHint(route)) {
    score += 35;
  }

  if (route.hopCount <= 2 && !intermediates.some((entity) => looksLikeBridgeEntity(entity))) {
    score += 20;
  }

  return score;
}

function scoreRelationshipSemantics(route: TraversalRoute): number {
  let score = 0;

  const relationshipPath = route.edges
    .map((edge) => normalizeReasoningName(edge.navigationPropertyName))
    .join(" ");

  // Strong signals
  if (relationshipPath.includes("primary")) {
    score += 50;
  }

  if (relationshipPath.includes("customer")) {
    score += 30;
  }

  if (relationshipPath.includes("owner")) {
    score += 25;
  }

  if (relationshipPath.includes("parent")) {
    score += 20;
  }

  // Domain-specific (optional but useful)
  if (relationshipPath.includes("contact")) {
    score += 10;
  }

  if (relationshipPath.includes("patient")) {
    score += 10;
  }

  // Weak/noisy signals (optional penalties)
  if (relationshipPath.includes("managingpartner")) {
    score -= 10;
  }

  if (relationshipPath.includes("association") || relationshipPath.includes("link")) {
    score -= 15;
  }

  return score;
}

export function rankTraversalRoutesForSelection(routes: TraversalRoute[]): TraversalRoute[] {
  return buildRankedTraversalRoutes(routes).map((item) => item.route);
}

export function buildRankedTraversalRoutes(routes: TraversalRoute[]): RankedTraversalRoute[] {
  const ranked = routes
    .map((route) => {
      const reasons: string[] = [];
      let score = scoreTraversalRouteForSelection(route);

      if (isCleanDirectRoute(route)) {
        reasons.push("direct route");
      }

      const semanticScore = scoreRelationshipSemantics(route);
      score += semanticScore;

      if (semanticScore > 0) {
        reasons.push("strong relationship semantics");
      }

      if (
        route.hopCount <= 2 &&
        !getIntermediateEntities(route).some((entity) => looksLikeBridgeEntity(entity))
      ) {
        reasons.push("clean path");
      }

      return {
        route,
        score,
        isBestMatch: false,
        reasons
      };
    })
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }

      if (left.route.hopCount !== right.route.hopCount) {
        return left.route.hopCount - right.route.hopCount;
      }

      return buildReadableTraversalRouteLabel(left.route).localeCompare(
        buildReadableTraversalRouteLabel(right.route)
      );
    });

  const threshold = ranked[0] ? ranked[0].score - 30 : Number.NEGATIVE_INFINITY;

  return ranked.map((item, index) => ({
    ...item,
    isBestMatch:
      index < 4 &&
      item.score >= threshold &&
      item.score >= 0
  }));
}

export function getBestMatchRoutes(routes: TraversalRoute[]): TraversalRoute[] {
  return buildRankedTraversalRoutes(routes)
    .filter((item) => item.isBestMatch)
    .map((item) => item.route);
}

export function buildReadableTraversalRouteLabel(route: TraversalRoute): string {
  return `${route.sourceEntity} → ${route.targetEntity}`;
}

export function buildTraversalRouteDescription(route: TraversalRoute): string {
  const relationshipPath = buildRelationshipPath(route);

  if (relationshipPath) {
    return `via ${relationshipPath}`;
  }

  return route.hopCount === 0 ? "same table" : "direct route";
}

export function buildTraversalRouteDetail(route: TraversalRoute): string {
  const entityPath = route.entities.join(" → ");
  const hopLabel = `${route.hopCount} relationship ${route.hopCount === 1 ? "hop" : "hops"}`;

  if (route.entities.length <= 2) {
    return `${hopLabel} • ${route.confidence} confidence • ${entityPath}`;
  }

  return `${hopLabel} • ${route.confidence} confidence • path: ${entityPath}`;
}

export function buildExecutionPlanLabel(plan: TraversalExecutionPlan): string {
  return `${plan.label} • ${plan.steps.length} step${plan.steps.length === 1 ? "" : "s"}`;
}

export function buildExecutionPlanDescription(plan: TraversalExecutionPlan): string {
  return plan.steps
    .map((step) => `${step.stepNumber}. ${step.stageLabel}`)
    .join(" | ");
}