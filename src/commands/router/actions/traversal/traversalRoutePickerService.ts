import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo } from "../../../../utils/logger.js";
import {
  buildExecutionPlanDescription,
  buildExecutionPlanLabel,
  buildReadableTraversalRouteLabel,
  buildRankedTraversalRoutes,
  buildTraversalRouteDescription
} from "../shared/traversal/traversalSelection.js";
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
import {
  assessExecutionPlanFeasibility,
  buildFeasibilityPrefix,
  buildGroupFeasibilityDetail,
  buildGroupFeasibilityPrefix
} from "./traversalRoutePickerFeasibility.js";
import {
  buildCompactRouteGroups,
  buildDefaultVisibleRouteGroups,
  buildDefaultVisibleVariants,
  buildExpandedRouteGroups,
  buildShowMoreRouteDetail,
  dedupeAndRankGroupVariants
} from "./traversalRoutePickerGrouping.js";
import {
  buildVariantChainLabel,
  getVariantDisplaySection
} from "./traversalRoutePickerTypes.js";
import { runOpenTraversalGraphViewAction } from "./graph/openTraversalGraphViewAction.js";
import type {
  CompactRankedRouteGroup,
  RankedRouteWithFeasibility,
  RouteFeasibility,
  RouteFeasibilityStatus
} from "./traversalRoutePickerTypes.js";

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
    }
  | {
      choiceKind: "open_graph";
    };

type RouteQuickPickItem = vscode.QuickPickItem & {
  choiceKind: "route" | "route_group" | "show_all" | "open_graph";
  route?: TraversalRoute;
  groupKey?: string;
  feasibility?: RouteFeasibility;
};

type TraversalRoutePickerDeps = {
  showRouteGroupQuickPick: (
    picks: RouteQuickPickItem[],
    title: string,
    placeHolder: string
  ) => Promise<RouteQuickPickItem | undefined>;
  openGraphView: (args: {
    ctx: CommandContext;
    graph: TraversalGraph;
    orderedRoutes: TraversalRoute[];
    selectedRouteId?: string;
  }) => Promise<void>;
};

type VariantQuickPickItem = vscode.QuickPickItem & {
  choiceKind: "route" | "show_more_variants";
  route?: TraversalRoute;
  feasibility?: RouteFeasibility;
  alwaysShow?: boolean;
};

function buildPreparedPickerModel(
  graph: TraversalGraph,
  orderedRoutes: TraversalRoute[]
): PreparedPickerModel {
  const ranked = buildRankedTraversalRoutes(orderedRoutes);
  const grouped = buildCompactRouteGroups(graph, ranked);
  const expandedGroups = buildExpandedRouteGroups(grouped);
  const { visibleGroups: defaultVisibleGroups, hiddenGroupCount } =
    buildDefaultVisibleRouteGroups(expandedGroups);
  const bestMatches = defaultVisibleGroups.filter((item) => item.isBestMatch);

  return {
    grouped,
    expandedGroups,
    defaultVisibleGroups,
    bestMatches,
    hiddenGroupCount
  };
}

function getOrCreatePreparedPickerModel(
  graph: TraversalGraph,
  orderedRoutes: TraversalRoute[]
): PreparedPickerModel {
  const cached = pickerModelCache.get(orderedRoutes);

  if (cached) {
    return cached;
  }

  const prepared = buildPreparedPickerModel(graph, orderedRoutes);
  pickerModelCache.set(orderedRoutes, prepared);
  return prepared;
}

function buildRouteGroupPick(
  item: CompactRankedRouteGroup,
  successMap: Map<string, TraversalHistoryEntry>
): RouteQuickPickItem {
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
}

function buildRouteGroupPicks(
  items: CompactRankedRouteGroup[],
  successMap: Map<string, TraversalHistoryEntry>,
  hiddenGroupCount: number,
  includeShowAll: boolean
): RouteQuickPickItem[] {
  const picks = items.map((item) => buildRouteGroupPick(item, successMap));

  picks.push({
    choiceKind: "open_graph",
    label: "Open graph view",
    description: "Visualize these ranked routes",
    detail: "Open the Guided Traversal graph companion surface."
  });

  if (!includeShowAll) {
    return picks;
  }

  return [
    ...picks,
    {
      choiceKind: "show_all",
      label: "Show more routes…",
      description: "Browse more practical routes",
      detail: buildShowMoreRouteDetail(hiddenGroupCount)
    }
  ];
}

async function showRouteGroupQuickPick(
  picks: RouteQuickPickItem[],
  title: string,
  placeHolder: string
): Promise<RouteQuickPickItem | undefined> {
  return vscode.window.showQuickPick(picks, {
    title,
    placeHolder,
    ignoreFocusOut: true,
    matchOnDescription: true,
    matchOnDetail: true
  });
}

async function pickFromRouteGroupList(
  ctx: CommandContext,
  graph: TraversalGraph,
  orderedRoutes: TraversalRoute[],
  prepared: PreparedPickerModel,
  successMap: Map<string, TraversalHistoryEntry>,
  title: string,
  placeHolder: string,
  items: CompactRankedRouteGroup[],
  includeShowAll: boolean,
  deps: TraversalRoutePickerDeps
): Promise<RoutePickerChoice | undefined> {
  const picks = buildRouteGroupPicks(items, successMap, prepared.hiddenGroupCount, includeShowAll);

  while (true) {
    const selected = await deps.showRouteGroupQuickPick(picks, title, placeHolder);

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

    if (selected.choiceKind === "open_graph") {
      const selectedRouteId = buildRankedTraversalRoutes(orderedRoutes)[0]?.route.routeId;
      await deps.openGraphView({
        ctx,
        graph,
        orderedRoutes,
        selectedRouteId
      });
      return undefined;
    }

    return {
      choiceKind: "show_all"
    };
  }
}

function buildVariantPickItems(
  group: CompactRankedRouteGroup,
  items: RankedRouteWithFeasibility[],
  successMap: Map<string, TraversalHistoryEntry>,
  hiddenCount: number,
  includeShowMore: boolean
): VariantQuickPickItem[] {
  const picks: VariantQuickPickItem[] = items.map((item) => {
    const routeHistory = successMap.get(item.route.routeId);
    const successBadge = buildSuccessfulRouteBadgeText(routeHistory);
    const section = getVariantDisplaySection(item, successMap);
    const chainLabel = buildVariantChainLabel(item.route);
    const routeLabel = buildReadableTraversalRouteLabel(item.route);
    const routeDescription = buildTraversalRouteDescription(item.route);
    const detailSegments = [item.feasibility.reason, chainLabel, routeDescription].filter(
      (segment) => segment && segment.length > 0
    );

    return {
      choiceKind: "route",
      label: `${buildFeasibilityPrefix(item.feasibility.status)} ${routeLabel}`,
      description: successBadge || section,
      detail: detailSegments.join(" • "),
      route: item.route,
      feasibility: item.feasibility,
      alwaysShow: routeHistory?.lastSucceededAt !== undefined
    };
  });

  if (!includeShowMore) {
    return picks;
  }

  return [
    ...picks,
    {
      choiceKind: "show_more_variants",
      label: "Show more variants…",
      description: "Browse all variants in this route family",
      detail: `Reveal ${hiddenCount} more variants for ${group.label}.`,
      route: items[0]?.route,
      feasibility: items[0]?.feasibility,
      alwaysShow: false
    }
  ];
}

async function chooseVariantFromQuickPick(
  group: CompactRankedRouteGroup,
  items: RankedRouteWithFeasibility[],
  successMap: Map<string, TraversalHistoryEntry>,
  hiddenCount: number,
  includeShowMore: boolean,
  placeHolder: string
): Promise<TraversalRoute | "show_more" | undefined> {
  const picks = buildVariantPickItems(group, items, successMap, hiddenCount, includeShowMore);

  while (true) {
    const selected = await vscode.window.showQuickPick(picks, {
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
}

async function pickVariantForGroup(
  successMap: Map<string, TraversalHistoryEntry>,
  group: CompactRankedRouteGroup
): Promise<TraversalRoute | undefined> {
  const rankedItems = dedupeAndRankGroupVariants(group.items);
  const { visibleItems, hiddenCount } = buildDefaultVisibleVariants(rankedItems);
  const firstSelection = await chooseVariantFromQuickPick(
    group,
    visibleItems,
    successMap,
    hiddenCount,
    hiddenCount > 0,
    "Choose the best-ranked relationship chain to use"
  );

  if (!firstSelection || firstSelection !== "show_more") {
    return firstSelection as TraversalRoute | undefined;
  }

  const fullSelection = await chooseVariantFromQuickPick(
    group,
    rankedItems,
    successMap,
    hiddenCount,
    false,
    "Choose from all variants in this route family"
  );

  return fullSelection === "show_more" ? undefined : fullSelection;
}

function resolveGroupSelection(
  groups: CompactRankedRouteGroup[],
  groupKey: string
): CompactRankedRouteGroup | undefined {
  return groups.find((item) => item.groupKey === groupKey);
}

function buildSuccessMap(
  ctx: CommandContext,
  routes: TraversalRoute[]
): Map<string, TraversalHistoryEntry> {
  const sourceEntity = routes[0]?.sourceEntity;
  const targetEntity = routes[0]?.targetEntity;

  if (!sourceEntity || !targetEntity) {
    return new Map();
  }

  const successMap = getSuccessfulTraversalRouteMap(ctx, sourceEntity, targetEntity);

  if (successMap.size > 0) {
    logInfo(
      ctx.output,
      `Traversal history: found ${successMap.size} previously successful route(s) for ${sourceEntity} -> ${targetEntity}.`
    );
  }

  return successMap;
}

export async function pickTraversalRouteFromQuickPick(
  ctx: CommandContext,
  graph: TraversalGraph,
  routes: TraversalRoute[],
  deps: TraversalRoutePickerDeps = createDefaultTraversalRoutePickerDeps()
): Promise<TraversalRoute | undefined> {
  const successMap = buildSuccessMap(ctx, routes);
  const orderedRoutes = sortRoutesByHistoricalSuccess(routes, successMap);
  const prepared = getOrCreatePreparedPickerModel(graph, orderedRoutes);
  const showingBestMatchOnly = prepared.bestMatches.length > 0;
  const initialGroups = showingBestMatchOnly
    ? prepared.bestMatches
    : prepared.defaultVisibleGroups;
  const firstPick = await pickFromRouteGroupList(
    ctx,
    graph,
    orderedRoutes,
    prepared,
    successMap,
    "DV Quick Run: Best Match",
    showingBestMatchOnly ? "Here's what I think you want" : "Choose a route",
    initialGroups,
    showingBestMatchOnly,
    deps
  );

  if (!firstPick) {
    return undefined;
  }

  if (firstPick.choiceKind === "route") {
    return firstPick.route;
  }

  if (firstPick.choiceKind === "route_group") {
    const group = resolveGroupSelection(prepared.grouped, firstPick.groupKey);
    return group ? pickVariantForGroup(successMap, group) : undefined;
  }

  const fullPick = await pickFromRouteGroupList(
    ctx,
    graph,
    orderedRoutes,
    prepared,
    successMap,
    "DV Quick Run: All Routes",
    "Choose from all discovered routes",
    prepared.expandedGroups,
    false,
    deps
  );

  if (!fullPick) {
    return undefined;
  }

  if (fullPick.choiceKind === "route") {
    return fullPick.route;
  }

  if (fullPick.choiceKind === "route_group") {
    const group = resolveGroupSelection(prepared.grouped, fullPick.groupKey);
    return group ? pickVariantForGroup(successMap, group) : undefined;
  }

  return undefined;
}

function createDefaultTraversalRoutePickerDeps(): TraversalRoutePickerDeps {
  return {
    showRouteGroupQuickPick,
    openGraphView: async ({ ctx, graph, orderedRoutes, selectedRouteId }) => {
      const rankedRoutes = buildRankedTraversalRoutes(orderedRoutes);
      const sourceEntity = rankedRoutes[0]?.route.sourceEntity;
      const targetEntity = rankedRoutes[0]?.route.targetEntity;

      if (!sourceEntity || !targetEntity) {
        return;
      }

      await runOpenTraversalGraphViewAction(ctx, {
        sourceEntity,
        targetEntity,
        graph,
        rankedRoutes,
        selectedRouteId
      });
    }
  };
}

export async function pickExecutionPlanFromQuickPick(
  graph: TraversalGraph,
  plannedRoute: PlannedTraversalRoute
): Promise<TraversalExecutionPlan | undefined> {
  const picks = plannedRoute.candidatePlans.map((plan) => {
    const feasibility = assessExecutionPlanFeasibility(graph, plan);

    return {
      label: `${buildFeasibilityPrefix(feasibility.status)} ${buildExecutionPlanLabel(plan)}`,
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
