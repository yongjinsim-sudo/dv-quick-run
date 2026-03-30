import { buildRankedTraversalRoutes } from "../shared/traversal/traversalSelection.js";
import type { TraversalGraph, TraversalRoute } from "../shared/traversal/traversalTypes.js";
import { assessRouteFeasibility } from "./traversalRoutePickerFeasibility.js";
import type {
  CompactRankedRouteGroup,
  RankedRouteWithFeasibility
} from "./traversalRoutePickerTypes.js";
import { buildCompactRouteLabel } from "./traversalRoutePickerTypes.js";

function hasEntityLoop(route: TraversalRoute): boolean {
  const seen = new Set<string>();

  for (const entity of route.entities) {
    const normalized = entity.trim().toLowerCase();
    if (seen.has(normalized)) {
      return true;
    }

    seen.add(normalized);
  }

  return false;
}

function isLikelyNoisyFallbackGroup(group: CompactRankedRouteGroup): boolean {
  return group.items.every((item) => item.feasibility.status !== "selectable")
    && (group.hopCount > 3 || group.items.every((item) => hasEntityLoop(item.route)));
}

export function buildDefaultVisibleRouteGroups(
  groups: CompactRankedRouteGroup[]
): { visibleGroups: CompactRankedRouteGroup[]; hiddenGroupCount: number } {
  const readyGroups = groups.filter((group) =>
    group.items.some((item) => item.feasibility.status === "selectable")
  );

  const fallbackGroups = groups.filter((group) =>
    group.items.some((item) => item.feasibility.status === "warning")
    && group.items.every((item) => item.feasibility.status !== "unselectable")
    && group.items.every((item) => item.feasibility.status !== "selectable")
  );

  const preferredFallbackGroups = fallbackGroups.filter(
    (group) => !isLikelyNoisyFallbackGroup(group)
  );
  const noisyFallbackGroups = fallbackGroups.filter((group) =>
    isLikelyNoisyFallbackGroup(group)
  );
  const fallbackBudget = readyGroups.length > 0 ? 5 : 8;
  const visibleFallbackGroups = preferredFallbackGroups.slice(0, fallbackBudget);

  const visibleGroups = [...readyGroups, ...visibleFallbackGroups];
  const hiddenGroupCount = groups.length - visibleGroups.length;

  if (visibleGroups.length > 0 || noisyFallbackGroups.length === 0) {
    return {
      visibleGroups,
      hiddenGroupCount
    };
  }

  const fallbackOnlyGroups = [...preferredFallbackGroups, ...noisyFallbackGroups].slice(
    0,
    fallbackBudget
  );

  return {
    visibleGroups: fallbackOnlyGroups,
    hiddenGroupCount: groups.length - fallbackOnlyGroups.length
  };
}

export function buildExpandedRouteGroups(
  groups: CompactRankedRouteGroup[]
): CompactRankedRouteGroup[] {
  return groups.filter((group) =>
    group.items.some((item) => item.feasibility.status !== "unselectable")
  );
}

export function buildShowMoreRouteDetail(hiddenGroupCount: number): string {
  return hiddenGroupCount > 0
    ? `Reveal ${hiddenGroupCount} more caution-only or long/indirect routes.`
    : "Browse more discovered routes.";
}

function countEntityRevisits(route: TraversalRoute): number {
  const seen = new Set<string>();
  let revisits = 0;

  for (const entity of route.entities) {
    const normalized = entity.trim().toLowerCase();
    if (seen.has(normalized)) {
      revisits += 1;
      continue;
    }

    seen.add(normalized);
  }

  return revisits;
}

function countSystemishEntities(route: TraversalRoute): number {
  const noisyEntities = new Set([
    "activitypointer",
    "connection",
    "duplicaterecord",
    "postfollow",
    "postregarding",
    "postrole",
    "principalobjectattributeaccess",
    "processsession",
    "syncerror",
    "slakpinstance",
    "systemuser",
    "team",
    "businessunit",
    "transactioncurrency",
    "knowledgearticle",
    "knowledgebaserecord",
    "sharepointdocumentlocation",
    "recurringappointmentmaster"
  ]);

  return route.entities.reduce((count, entity) => {
    return count + (noisyEntities.has(entity.trim().toLowerCase()) ? 1 : 0);
  }, 0);
}

function buildVariantDisplayScore(item: RankedRouteWithFeasibility): number {
  const feasibilityBase =
    item.feasibility.status === "selectable"
      ? 1000
      : item.feasibility.status === "warning"
        ? 500
        : 0;

  const confidenceBonus =
    item.route.confidence === "high"
      ? 120
      : item.route.confidence === "medium"
        ? 60
        : 0;

  const hopPenalty = item.route.hopCount * 25;
  const revisitPenalty = countEntityRevisits(item.route) * 120;
  const noisyEntityPenalty = countSystemishEntities(item.route) * 35;

  return feasibilityBase + confidenceBonus + item.score - hopPenalty - revisitPenalty - noisyEntityPenalty;
}

function buildVariantFingerprint(route: TraversalRoute): string {
  const edgePath = route.edges
    .map((edge) => `${edge.fromEntity}->${edge.toEntity}:${edge.navigationPropertyName}`)
    .join("|");

  return `${route.sourceEntity}|${route.targetEntity}|${route.hopCount}|${edgePath}`;
}

export function dedupeAndRankGroupVariants(
  items: RankedRouteWithFeasibility[]
): RankedRouteWithFeasibility[] {
  const deduped = new Map<string, RankedRouteWithFeasibility>();

  for (const item of items) {
    const key = buildVariantFingerprint(item.route);
    const existing = deduped.get(key);

    if (!existing) {
      deduped.set(key, item);
      continue;
    }

    if (buildVariantDisplayScore(item) > buildVariantDisplayScore(existing)) {
      deduped.set(key, item);
    }
  }

  return [...deduped.values()].sort((left, right) => {
    const scoreDiff = buildVariantDisplayScore(right) - buildVariantDisplayScore(left);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    if (left.route.hopCount !== right.route.hopCount) {
      return left.route.hopCount - right.route.hopCount;
    }

    return left.route.routeId.localeCompare(right.route.routeId);
  });
}

export function buildDefaultVisibleVariants(
  items: RankedRouteWithFeasibility[]
): { visibleItems: RankedRouteWithFeasibility[]; hiddenCount: number } {
  const ranked = dedupeAndRankGroupVariants(items);
  const ready = ranked.filter((item) => item.feasibility.status === "selectable");
  const caution = ranked.filter((item) => item.feasibility.status === "warning");

  const visibleItems =
    ready.length > 0
      ? [...ready.slice(0, 3), ...caution.slice(0, 2)]
      : caution.slice(0, 5);

  return {
    visibleItems,
    hiddenCount: Math.max(0, ranked.length - visibleItems.length)
  };
}

export function buildCompactRouteGroups(
  graph: TraversalGraph,
  ranked: ReturnType<typeof buildRankedTraversalRoutes>
): CompactRankedRouteGroup[] {
  const groups = new Map<string, CompactRankedRouteGroup>();

  for (const item of ranked) {
    const itemWithFeasibility: RankedRouteWithFeasibility = {
      ...item,
      feasibility: assessRouteFeasibility(graph, item)
    };

    const label = buildCompactRouteLabel(item.route);
    const existing = groups.get(label);

    if (existing) {
      existing.items.push(itemWithFeasibility);
      existing.isBestMatch = existing.isBestMatch || item.isBestMatch;
      continue;
    }

    groups.set(label, {
      groupKey: label,
      label,
      hopCount: item.route.hopCount,
      isBestMatch: item.isBestMatch,
      items: [itemWithFeasibility]
    });
  }

  return [...groups.values()].sort((left, right) => {
    const leftTopScore = left.items[0]?.score ?? 0;
    const rightTopScore = right.items[0]?.score ?? 0;

    if (leftTopScore !== rightTopScore) {
      return rightTopScore - leftTopScore;
    }

    if (left.hopCount !== right.hopCount) {
      return left.hopCount - right.hopCount;
    }

    return left.label.localeCompare(right.label);
  });
}
