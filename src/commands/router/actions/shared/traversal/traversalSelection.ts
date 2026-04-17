import * as vscode from "vscode";
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

const SYSTEM_ENTITY_PREFIXES = [
  "_",
  "adx_",
  "msdyn_",
  "mspp_",
  "msfp_",
  "msfsi_",
  "mserp_",
  "msdyncrm_",
  "solution",
  "workflow",
  "async",
  "bulk",
  "queue",
  "system"
];

const SYSTEM_ENTITY_HINTS = [
  "activitypointer",
  "activitymimeattachment",
  "annotation",
  "asyncoperation",
  "bulkdelete",
  "bulkoperation",
  "duplicaterecord",
  "pluginassembly",
  "plugintype",
  "queueitem",
  "ribbon",
  "savedquery",
  "systemform",
  "systemuser",
  "teamtemplate",
  "workflow",
  "workflowlog"
];

const BEST_MATCH_MAX_COUNT = 2;
const BEST_MATCH_SCORE_GAP = 12;
const REPEATED_ENTITY_PENALTY = 15;

const SYSTEM_RELATIONSHIP_HINTS = [
  "createdby",
  "modifiedby",
  "createdonbehalfby",
  "modifiedonbehalfby",
  "owninguser",
  "owningteam",
  "ownerid",
  "lk_task_createdby",
  "lk_task_modifiedby",
  "lk_task_createdonbehalfby",
  "lk_task_modifiedonbehalfby"
];

function getTraversalAllowedTablePatterns(): string[] {
  try {
    const raw = vscode.workspace
      .getConfiguration("dvQuickRun")
      .get<unknown[]>("traversal.allowedTables", []);

    if (!Array.isArray(raw)) {
      return [];
    }

    return raw
      .filter((value): value is string => typeof value === "string")
      .map((value) => normalizeReasoningName(value))
      .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index);
  } catch {
    return [];
  }
}

function matchesTraversalPattern(value: string, pattern: string): boolean {
  if (!pattern) {
    return false;
  }

  if (!pattern.includes("*")) {
    return value === pattern;
  }

  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regexPattern = "^" + escaped.replace(/\*/g, ".*") + "$";
  return new RegExp(regexPattern, "i").test(value);
}

function countAllowedTableMatches(route: TraversalRoute): number {
  const patterns = getTraversalAllowedTablePatterns();
  if (patterns.length === 0) {
    return 0;
  }

  const intermediates = getIntermediateEntities(route).map((entity) => normalizeReasoningName(entity));
  if (intermediates.length === 0) {
    return 0;
  }

  let matches = 0;
  for (const entity of intermediates) {
    if (patterns.some((pattern) => matchesTraversalPattern(entity, pattern))) {
      matches += 1;
    }
  }

  return matches;
}

function scoreAllowedTableAffinity(route: TraversalRoute): number {
  const intermediates = getIntermediateEntities(route);
  if (intermediates.length === 0) {
    return 0;
  }

  const matches = countAllowedTableMatches(route);
  if (matches === 0) {
    return 0;
  }

  // Mild business-like promotion only. This should not overpower structural quality.
  return Math.min(18, matches * 8 + (matches === intermediates.length ? 4 : 0));
}

function countSystemHeavyRelationships(route: TraversalRoute): number {
  return route.edges.reduce((count, edge) => {
    const normalized = normalizeReasoningName(edge.navigationPropertyName);
    return count + (SYSTEM_RELATIONSHIP_HINTS.some((hint) => normalized.includes(hint)) ? 1 : 0);
  }, 0);
}

function scoreSystemHeavyRelationshipPenalty(route: TraversalRoute): number {
  const count = countSystemHeavyRelationships(route);
  if (count === 0) {
    return 0;
  }

  // Slight penalty only, so valid routes remain visible but business-like paths rise first.
  return Math.min(18, count * 6);
}


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

function looksLikeSystemEntity(logicalName: string): boolean {
  const trimmed = logicalName.trim();
  const normalized = normalizeReasoningName(logicalName);

  if (!trimmed || !normalized) {
    return true;
  }

  if (trimmed.startsWith("_")) {
    return true;
  }

  if (SYSTEM_ENTITY_PREFIXES.some((prefix) => normalized.startsWith(prefix))) {
    return true;
  }

  return SYSTEM_ENTITY_HINTS.some((hint) => normalized.includes(hint));
}

function getIntermediateEntities(route: TraversalRoute): string[] {
  if (route.entities.length <= 2) {
    return [];
  }

  return route.entities.slice(1, -1);
}

function countRepeatedEntities(route: TraversalRoute): number {
  const seen = new Set<string>();
  let repeats = 0;

  for (const entity of route.entities) {
    const normalized = normalizeReasoningName(entity);
    if (!normalized) {
      continue;
    }

    if (seen.has(normalized)) {
      repeats += 1;
      continue;
    }

    seen.add(normalized);
  }

  return repeats;
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

function scoreTraversalRouteBusinessRelevance(route: TraversalRoute): number {
  let score = 0;

  for (const entity of route.entities) {
    if (looksLikeSystemEntity(entity)) {
      score -= route.sourceEntity === entity || route.targetEntity === entity ? 25 : 60;
      continue;
    }

    score += route.sourceEntity === entity || route.targetEntity === entity ? 5 : 15;
  }

  return score;
}

export function scoreTraversalRouteForSelection(route: TraversalRoute): number {
  let score = 0;
  const allowedTableAffinity = scoreAllowedTableAffinity(route);
  const systemHeavyRelationshipPenalty = scoreSystemHeavyRelationshipPenalty(route);

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

  score -= countRepeatedEntities(route) * REPEATED_ENTITY_PENALTY;
  score += scoreTraversalRouteBusinessRelevance(route);
  score += allowedTableAffinity;
  score -= systemHeavyRelationshipPenalty;

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

      const allowedTableAffinity = scoreAllowedTableAffinity(route);
      if (allowedTableAffinity > 0) {
        reasons.push("business-like route scope");
      }

      const systemHeavyPenalty = scoreSystemHeavyRelationshipPenalty(route);
      if (systemHeavyPenalty > 0) {
        reasons.push("system-heavy relationship penalty applied");
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

  const bestMatchRouteIds = new Set(
    collectBestMatchRouteIds(ranked).map((item) => item.route.routeId)
  );

  return ranked.map((item, index) => ({
    ...item,
    isBestMatch: bestMatchRouteIds.has(item.route.routeId)
  }));
}

function collectBestMatchRouteIds(
  ranked: Array<Pick<RankedTraversalRoute, "route" | "score">>
): Array<Pick<RankedTraversalRoute, "route" | "score">> {
  const top = ranked[0];

  if (!top || top.score < 0) {
    return [];
  }

  const bestMatches = [top];

  for (const item of ranked.slice(1)) {
    if (bestMatches.length >= BEST_MATCH_MAX_COUNT) {
      break;
    }

    const scoreGap = top.score - item.score;
    if (scoreGap > BEST_MATCH_SCORE_GAP) {
      break;
    }

    if (item.route.hopCount > top.route.hopCount + 1) {
      continue;
    }

    bestMatches.push(item);
  }

  return bestMatches;
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
