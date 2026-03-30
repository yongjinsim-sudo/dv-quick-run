import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo } from "../../../../utils/logger.js";
import { buildPlannedTraversalRoute } from "../shared/traversal/traversalPlanGenerator.js";
import {
  buildExecutionPlanDescription,
  buildExecutionPlanLabel,
  buildReadableTraversalRouteLabel,
  buildTraversalRouteDescription,
  buildRankedTraversalRoutes
} from "../shared/traversal/traversalSelection.js";
import { buildStepExecutionPlan } from "../shared/traversal/traversalStepExecutor.js";
import {
  buildSuccessfulRouteBadgeText,
  getSuccessfulTraversalRouteMap,
  sortRoutesByHistoricalSuccess
} from "../shared/traversal/traversalHistoryStore.js";
import type { TraversalHistoryEntry } from "../shared/traversal/traversalHistoryStore.js";
import type {
  PlannedTraversalRoute,
  TraversalExecutionPlan,
  TraversalGraph,
  TraversalRoute
} from "../shared/traversal/traversalTypes.js";

const pickerModelCache = new WeakMap<TraversalRoute[], PreparedPickerModel>();

type PreparedPickerModel = {
  grouped: CompactRankedRouteGroup[];
  expandedGroups: CompactRankedRouteGroup[];
  defaultVisibleGroups: CompactRankedRouteGroup[];
  bestMatches: CompactRankedRouteGroup[];
  hiddenGroupCount: number;
};

type RoutePickerChoice =
  | {
      choiceKind: "route";
      route: TraversalRoute;
    }
  | {
      choiceKind: "route_group";
      groupKey: string;
    }
  | {
      choiceKind: "show_all";
    };

type RouteFeasibilityStatus = "selectable" | "warning" | "unselectable";

type RouteFeasibility = {
  status: RouteFeasibilityStatus;
  reason: string;
};

type RouteQuickPickItem = vscode.QuickPickItem & {
  choiceKind: "route" | "route_group" | "show_all";
  route?: TraversalRoute;
  groupKey?: string;
  feasibility?: RouteFeasibility;
};

type RankedRouteItem = ReturnType<typeof buildRankedTraversalRoutes>[number];

type RankedRouteWithFeasibility = RankedRouteItem & {
  feasibility: RouteFeasibility;
};

type CompactRankedRouteGroup = {
  groupKey: string;
  label: string;
  hopCount: number;
  isBestMatch: boolean;
  items: RankedRouteWithFeasibility[];
};

function buildCompactRouteLabel(route: TraversalRoute): string {
  return `${route.entities.join(" -> ")} (${route.hopCount} ${route.hopCount === 1 ? "hop" : "hops"})`;
}

function humanizeVariantHop(raw: string): string {
  let friendly = raw
    .replace(/^msemr_/i, "")
    .replace(/^bu_/i, "")
    .replace(/^msa_/i, "")
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim();

  const replacements: Array<[RegExp, string]> = [
    [/primarycontactid/gi, "primary contact"],
    [/contact customer accounts/gi, "customer accounts"],
    [/patient identifier/gi, "patient identifier"],
    [/authorcareplan contact/gi, "author care plan contact"],
    [/careplanactivity/gi, "care plan activity"],
    [/care plan activity/gi, "care plan activity"],
    [/careplan/gi, "care plan"],
    [/account primary contact/gi, "account primary contact"],
    [/managingpartnerid/gi, "managing partner"],
    [/managing organization/gi, "managing organization"],
    [/qualification1issuer/gi, "qualification issuer"],
    [/task/gi, "task"]
  ];

  for (const [pattern, value] of replacements) {
    friendly = friendly.replace(pattern, value);
  }

  return friendly.replace(/\s+/g, " ").trim().toLowerCase();
}

function buildVariantChainLabel(route: TraversalRoute): string {
  const hops = route.edges.map((edge) => humanizeVariantHop(edge.navigationPropertyName));
  return `via ${hops.join(" -> ")}`;
}

function getVariantDisplaySection(
  item: RankedRouteWithFeasibility,
  successMap: Map<string, TraversalHistoryEntry>
): string {
  const routeHistory = successMap.get(item.route.routeId);

  if (routeHistory) {
    return "Proven routes";
  }

  return getVariantConfidenceSection(item);
}

function getVariantConfidenceSection(item: RankedRouteItem): string {
  if (item.route.confidence === "high" && item.score >= 0) {
    return "High confidence";
  }

  if (item.score >= 0) {
    return "Medium confidence";
  }

  return "Low confidence";
}

function getFeasibilityRank(status: RouteFeasibilityStatus): number {
  switch (status) {
    case "selectable":
      return 3;
    case "warning":
      return 2;
    default:
      return 1;
  }
}

function buildFeasibilityPrefix(status: RouteFeasibilityStatus): string {
  switch (status) {
    case "selectable":
      return "✓";
    case "warning":
      return "⚠";
    default:
      return "✕";
  }
}

function getBlockedRuntimePlaceholderReason(queryPath: string): string {
  if (queryPath.includes("__RUNTIME_VALUE__")) {
    return "Requires unsupported runtime value propagation";
  }

  return "This route cannot be executed safely yet";
}

function assessExecutionPlanFeasibility(
  graph: TraversalGraph,
  plan: TraversalExecutionPlan
): RouteFeasibility {
  const firstStep = plan.steps[0];

  if (!firstStep) {
    return {
      status: "unselectable",
      reason: "Execution plan did not produce a runnable first step"
    };
  }

  const stepPlan = buildStepExecutionPlan(graph, plan, firstStep, undefined, 1);

  if (!stepPlan.queries.length) {
    return {
      status: "unselectable",
      reason: "Execution plan did not produce runnable queries"
    };
  }

  const blockedQuery = stepPlan.queries.find((query) =>
    query.queryPath.includes("__RUNTIME_VALUE__")
  );

  if (blockedQuery) {
    return {
      status: "unselectable",
      reason: getBlockedRuntimePlaceholderReason(blockedQuery.queryPath)
    };
  }

  if (stepPlan.usedFallback || stepPlan.mode === "chained_queries") {
    return {
      status: "warning",
      reason: "Runs via fallback chained queries"
    };
  }

  if (stepPlan.mode === "nested_expand" || firstStep.hopCount > 1) {
    return {
      status: "warning",
      reason: "Runnable, but uses a more complex nested expand"
    };
  }

  return {
    status: "selectable",
    reason: "Runnable with a direct first step"
  };
}

function assessRouteFeasibility(graph: TraversalGraph, item: RankedRouteItem): RouteFeasibility {
  const plannedRoute = buildPlannedTraversalRoute(item.route);
  const planFeasibilities = plannedRoute.candidatePlans.map((plan) =>
    assessExecutionPlanFeasibility(graph, plan)
  );

  const bestPlan = [...planFeasibilities].sort(
    (left, right) => getFeasibilityRank(right.status) - getFeasibilityRank(left.status)
  )[0];

  if (!bestPlan) {
    return {
      status: "unselectable",
      reason: "No runnable itinerary was generated"
    };
  }

  if (bestPlan.status === "selectable") {
    if (item.route.confidence === "high" && item.score >= 0) {
      return bestPlan;
    }

    return {
      status: "warning",
      reason: "Runnable, but this route is lower confidence"
    };
  }

  return bestPlan;
}

function summarizeGroupFeasibility(
  items: RankedRouteWithFeasibility[]
): Record<RouteFeasibilityStatus, number> {
  return items.reduce<Record<RouteFeasibilityStatus, number>>(
    (summary, item) => {
      summary[item.feasibility.status] += 1;
      return summary;
    },
    {
      selectable: 0,
      warning: 0,
      unselectable: 0
    }
  );
}

function buildGroupFeasibilityPrefix(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);

  if (summary.selectable > 0 && summary.unselectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("selectable");
  }

  if (summary.selectable === 0 && summary.warning === 0) {
    return buildFeasibilityPrefix("unselectable");
  }

  return buildFeasibilityPrefix("warning");
}

function buildGroupFeasibilityDetail(items: RankedRouteWithFeasibility[]): string {
  const summary = summarizeGroupFeasibility(items);
  const parts = [
    `${items.length} variant${items.length === 1 ? "" : "s"}`,
    `${summary.selectable} ready`,
    `${summary.warning} caution`,
    `${summary.unselectable} blocked`
  ];

  return parts.join(" • ");
}

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

function buildDefaultVisibleRouteGroups(
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

  const preferredFallbackGroups = fallbackGroups.filter((group) => !isLikelyNoisyFallbackGroup(group));
  const noisyFallbackGroups = fallbackGroups.filter((group) => isLikelyNoisyFallbackGroup(group));
  const fallbackBudget = readyGroups.length > 0 ? 5 : 8;
  const visibleFallbackGroups = preferredFallbackGroups.slice(0, fallbackBudget);

  const visibleGroups = [
    ...readyGroups,
    ...visibleFallbackGroups
  ];

  const hiddenGroupCount = groups.length - visibleGroups.length;

  if (visibleGroups.length > 0 || noisyFallbackGroups.length === 0) {
    return {
      visibleGroups,
      hiddenGroupCount
    };
  }

  const fallbackOnlyGroups = [...preferredFallbackGroups, ...noisyFallbackGroups].slice(0, fallbackBudget);

  return {
    visibleGroups: fallbackOnlyGroups,
    hiddenGroupCount: groups.length - fallbackOnlyGroups.length
  };
}

function buildExpandedRouteGroups(groups: CompactRankedRouteGroup[]): CompactRankedRouteGroup[] {
  return groups.filter((group) =>
    group.items.some((item) => item.feasibility.status !== "unselectable")
  );
}

function buildShowMoreRouteDetail(hiddenGroupCount: number): string {
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

function dedupeAndRankGroupVariants(
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

function buildDefaultVisibleVariants(
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

function buildCompactRouteGroups(
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

export async function pickTraversalRouteFromQuickPick(
  ctx: CommandContext,
  graph: TraversalGraph,
  routes: TraversalRoute[]
): Promise<TraversalRoute | undefined> {
  const sourceEntity = routes[0]?.sourceEntity;
  const targetEntity = routes[0]?.targetEntity;

  const successMap =
    sourceEntity && targetEntity
      ? getSuccessfulTraversalRouteMap(ctx, sourceEntity, targetEntity)
      : new Map();

  const orderedRoutes = sortRoutesByHistoricalSuccess(routes, successMap);

  if (successMap.size > 0 && sourceEntity && targetEntity) {
    logInfo(
      ctx.output,
      `Traversal history: found ${successMap.size} previously successful route(s) for ${sourceEntity} -> ${targetEntity}.`
    );
  }

  let prepared = pickerModelCache.get(orderedRoutes);

  if (!prepared) {
    const ranked = buildRankedTraversalRoutes(orderedRoutes);
    const grouped = buildCompactRouteGroups(graph, ranked);
    const expandedGroups = buildExpandedRouteGroups(grouped);

    const { visibleGroups: defaultVisibleGroups, hiddenGroupCount } =
      buildDefaultVisibleRouteGroups(expandedGroups);

    const bestMatches = defaultVisibleGroups.filter((item) => item.isBestMatch);

    prepared = {
      grouped,
      expandedGroups,
      defaultVisibleGroups,
      bestMatches,
      hiddenGroupCount
    };

    pickerModelCache.set(orderedRoutes, prepared);
  }

  const showingBestMatchOnly = prepared.bestMatches.length > 0;
  const initialGroups =
    prepared.bestMatches.length > 0
      ? prepared.bestMatches
      : prepared.defaultVisibleGroups;

  const pickFromList = async (
    title: string,
    placeHolder: string,
    items: CompactRankedRouteGroup[],
    includeShowAll: boolean
  ): Promise<RoutePickerChoice | undefined> => {
    const picks: RouteQuickPickItem[] = items.map((item) => {
      const singleRoute = item.items.length === 1 ? item.items[0] : undefined;
      const prefix = singleRoute
        ? buildFeasibilityPrefix(singleRoute.feasibility.status)
        : buildGroupFeasibilityPrefix(item.items);

      const singleRouteHistory = singleRoute ? successMap.get(singleRoute.route.routeId) : undefined;
      const successBadge = buildSuccessfulRouteBadgeText(singleRouteHistory);

      const description = successBadge
        ? "⭐ Previously successful"
        : item.isBestMatch
          ? "Suggested"
          : undefined;

      return {
        choiceKind: item.items.length === 1 ? "route" : "route_group",
        route: singleRoute?.route,
        groupKey: item.groupKey,
        feasibility: singleRoute?.feasibility,
        label: `${prefix} ${item.label}`,
        description,
        detail: singleRoute
          ? singleRoute.feasibility.reason
          : buildGroupFeasibilityDetail(item.items)
      };
    });

    if (includeShowAll) {
      picks.push({
        choiceKind: "show_all",
        label: "Show more routes…",
        description: "Browse more practical routes",
        detail: buildShowMoreRouteDetail(prepared.hiddenGroupCount)
      });
    }

    while (true) {
      const selected = await vscode.window.showQuickPick(picks, {
        title,
        placeHolder,
        ignoreFocusOut: true,
        matchOnDescription: true,
        matchOnDetail: true
      });

      if (!selected) {
        return undefined;
      }

      if (selected.choiceKind === "route" && selected.route) {
        if (selected.feasibility?.status === "unselectable") {
          await vscode.window.showWarningMessage(
            `This route variant is not runnable yet: ${selected.feasibility.reason}`
          );
          continue;
        }

        return {
          choiceKind: "route",
          route: selected.route
        };
      }

      if (selected.choiceKind === "route_group" && selected.groupKey) {
        return {
          choiceKind: "route_group",
          groupKey: selected.groupKey
        };
      }

      return {
        choiceKind: "show_all"
      };
    }
  };

  const pickVariantForGroup = async (
    group: CompactRankedRouteGroup
  ): Promise<TraversalRoute | undefined> => {
    const rankedItems = dedupeAndRankGroupVariants(group.items);
    const { visibleItems, hiddenCount } = buildDefaultVisibleVariants(rankedItems);

    const chooseFromPicks = async (
      items: RankedRouteWithFeasibility[],
      includeShowMore: boolean,
      placeHolder: string
    ): Promise<TraversalRoute | "show_more" | undefined> => {
      const picks = items.map((item) => {
        const routeHistory = successMap.get(item.route.routeId);
        const successBadge = buildSuccessfulRouteBadgeText(routeHistory);
        const section = getVariantDisplaySection(item, successMap);
        const chainLabel = buildVariantChainLabel(item.route);
        const routeLabel = buildReadableTraversalRouteLabel(item.route);
        const routeDescription = buildTraversalRouteDescription(item.route);

        const detailSegments = [
          item.feasibility.reason,
          chainLabel,
          routeDescription
        ].filter((segment) => segment && segment.length > 0);

        return {
          label: `${buildFeasibilityPrefix(item.feasibility.status)} ${routeLabel}`,
          description: successBadge || section,
          detail: detailSegments.join(" • "),
          route: item.route,
          feasibility: item.feasibility,
          alwaysShow: routeHistory?.lastSucceededAt !== undefined
        };
      });

      const quickPickItems: Array<typeof picks[number] & { choiceKind: "route" | "show_more_variants" }> = picks.map((pick) => ({
        ...pick,
        choiceKind: "route"
      }));

      if (includeShowMore) {
        quickPickItems.push({
          choiceKind: "show_more_variants",
          label: "Show more variants…",
          description: "Browse all variants in this route family",
          detail: `Reveal ${hiddenCount} more variants for ${group.label}.`,
          route: rankedItems[0]?.route,
          feasibility: rankedItems[0]?.feasibility,
          alwaysShow: false
        });
      }

      while (true) {
        const selected = await vscode.window.showQuickPick(quickPickItems, {
          title: `DV Quick Run: Route Variants — ${group.label}`,
          placeHolder,
          ignoreFocusOut: true,
          matchOnDescription: true,
          matchOnDetail: true
        });

        if (!selected) {
          return undefined;
        }

        if (selected.choiceKind === "show_more_variants") {
          return "show_more";
        }

        if (selected.feasibility?.status === "unselectable") {
          await vscode.window.showWarningMessage(
            `This variant is not runnable yet: ${selected.feasibility.reason}`
          );
          continue;
        }

        return selected.route;
      }
    };

    const firstSelection = await chooseFromPicks(
      visibleItems,
      hiddenCount > 0,
      "Choose the best-ranked relationship chain to use"
    );

    if (!firstSelection || firstSelection !== "show_more") {
      return firstSelection;
    }

    const fullSelection = await chooseFromPicks(
      rankedItems,
      false,
      "Choose from all variants in this route family"
    );

    return fullSelection === "show_more" ? undefined : fullSelection;
  };

  const firstPick = await pickFromList(
    "DV Quick Run: Best Match",
    showingBestMatchOnly
      ? "Here's what I think you want"
      : "Choose a route",
    initialGroups,
    showingBestMatchOnly
  );

  if (!firstPick) {
    return undefined;
  }

  if (firstPick.choiceKind === "route") {
    return firstPick.route;
  }

  if (firstPick.choiceKind === "route_group") {
    const group = prepared.grouped.find((item) => item.groupKey === firstPick.groupKey);
    return group ? pickVariantForGroup(group) : undefined;
  }

  const fullPick = await pickFromList(
    "DV Quick Run: All Routes",
    "Choose from all discovered routes",
    prepared.expandedGroups,
    false
  );

  if (!fullPick) {
    return undefined;
  }

  if (fullPick.choiceKind === "route") {
    return fullPick.route;
  }

  if (fullPick.choiceKind === "route_group") {
    const group = prepared.grouped.find((item) => item.groupKey === fullPick.groupKey);
    return group ? pickVariantForGroup(group) : undefined;
  }

  return undefined;
}

export async function pickExecutionPlanFromQuickPick(
  graph: TraversalGraph,
  plannedRoute: PlannedTraversalRoute
): Promise<TraversalExecutionPlan | undefined> {
  const picks = plannedRoute.candidatePlans.map((plan) => {
    const feasibility = assessExecutionPlanFeasibility(graph, plan);
    const prefix = buildFeasibilityPrefix(feasibility.status);

    return {
      label: `${prefix} ${buildExecutionPlanLabel(plan)}`,
      description: plan.recommended ? `${plan.rationale} • recommended` : plan.rationale,
      detail: `${buildExecutionPlanDescription(plan)} • ${feasibility.reason}`,
      plan,
      feasibility
    };
  });

  while (true) {
    const picked = await vscode.window.showQuickPick(picks, {
      title: "DV Quick Run: Choose Itinerary",
      placeHolder: "Choose how the route should be dissected",
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (!picked) {
      return undefined;
    }

    if (picked.feasibility.status === "unselectable") {
      await vscode.window.showWarningMessage(
        `This itinerary is not runnable yet: ${picked.feasibility.reason}`
      );
      continue;
    }

    return picked.plan;
  }
}
