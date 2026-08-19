import * as vscode from "vscode";
import type { CommandContext } from "../../../context/commandContext.js";
import { logInfo, logWarn } from "../../../../utils/logger.js";
import { WorkspaceBusinessPathRepository } from "../../../../runtime/businessPaths/workspaceBusinessPathRepository.js";
import { GuidedTraversalBusinessPathMetadataProvider } from "./guidedTraversalBusinessPathMetadataProvider.js";
import {
  buildGuidedTraversalBusinessPathOverlay,
  type GuidedTraversalBusinessPathOverlay,
  type GuidedTraversalPreferredPath
} from "./businessPathGuidedTraversalOverlay.js";
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
  assessRouteFeasibility,
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
    }
  | {
      choiceKind: "preferred_notice";
    };

type RouteQuickPickItem = vscode.QuickPickItem & {
  choiceKind: "route" | "route_group" | "show_all" | "open_graph" | "preferred_route" | "preferred_notice";
  route?: TraversalRoute;
  groupKey?: string;
  feasibility?: RouteFeasibility;
  preferredState?: GuidedTraversalPreferredPath["state"];
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
  loadBusinessPathOverlay?: (
    ctx: CommandContext,
    graph: TraversalGraph,
    routes: TraversalRoute[],
    requestedEndpoints?: { sourceTable: string; targetTable: string }
  ) => Promise<GuidedTraversalBusinessPathOverlay>;
  showWarningMessage?: (message: string) => Thenable<unknown> | Promise<unknown> | unknown;
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

function resolveWorkspaceRoot(): string | undefined {
  const activeEditorUri = vscode.window.activeTextEditor?.document.uri;
  const activeWorkspace = activeEditorUri
    ? vscode.workspace.getWorkspaceFolder(activeEditorUri)
    : undefined;
  return activeWorkspace?.uri.fsPath ?? vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
}

function buildPreferredPathDescription(item: GuidedTraversalPreferredPath): string {
  if (item.state === "valid") {
    return "★ Preferred Business Path · Valid";
  }
  if (item.state === "stale") {
    return "⚠ Preferred Business Path · Stale";
  }
  return "? Preferred Business Path · Validation unavailable";
}

function buildPreferredPathDetail(item: GuidedTraversalPreferredPath): string {
  const chain = item.artifact.hops
    .slice()
    .sort((left, right) => left.ordinal - right.ordinal)
    .reduce<string[]>(
      (tables, hop, index) => index === 0
        ? [hop.fromTable, hop.toTable]
        : [...tables, hop.toTable],
      []
    )
    .join(" → ");

  const verification = item.artifact.verification?.status === "verified"
    ? `Previously runtime verified${item.artifact.verification.verifiedAt ? ` ${item.artifact.verification.verifiedAt}` : ""}`
    : "Not runtime verified";

  const issue = item.validation.issues[0]?.message;
  return [chain, verification, issue].filter(Boolean).join(" • ");
}

function buildPreferredRoutePicks(
  graph: TraversalGraph,
  preferredPaths: readonly GuidedTraversalPreferredPath[]
): RouteQuickPickItem[] {
  return preferredPaths.map((item) => {
    const feasibility = item.route
      ? assessRouteFeasibility(graph, {
          route: item.route,
          score: 0,
          isBestMatch: false,
          reasons: ["saved Preferred Business Path"]
        })
      : undefined;

    return {
      choiceKind: item.state === "valid" && item.route ? "preferred_route" : "preferred_notice",
      route: item.route ? { ...item.route, selectionAuthority: "workspacePreferred" } : undefined,
      label: `★ ${item.artifact.name}`,
      description: buildPreferredPathDescription(item),
      detail: [
        buildPreferredPathDetail(item),
        feasibility && feasibility.status !== "selectable" ? feasibility.reason : undefined
      ].filter(Boolean).join(" • "),
      feasibility,
      preferredState: item.state,
      alwaysShow: true
    };
  });
}

async function loadDefaultBusinessPathOverlay(
  ctx: CommandContext,
  graph: TraversalGraph,
  routes: TraversalRoute[],
  requestedEndpoints?: { sourceTable: string; targetTable: string }
): Promise<GuidedTraversalBusinessPathOverlay> {
  const sourceTable = requestedEndpoints?.sourceTable ?? routes[0]?.sourceEntity;
  const targetTable = requestedEndpoints?.targetTable ?? routes[0]?.targetEntity;
  const workspaceRoot = resolveWorkspaceRoot();

  if (!workspaceRoot || !sourceTable || !targetTable) {
    return { preferredPaths: [], discoveredRoutes: routes };
  }

  try {
    const repository = new WorkspaceBusinessPathRepository(workspaceRoot);
    const activeEnvironment = ctx.envContext.getActiveEnvironment();
    let environmentId = activeEnvironment?.name?.trim().toLowerCase();
    if (activeEnvironment?.url?.trim()) {
      try {
        environmentId = new URL(activeEnvironment.url).hostname.toLowerCase();
      } catch {
        environmentId = activeEnvironment.url.trim().toLowerCase();
      }
    }

    return await buildGuidedTraversalBusinessPathOverlay(
      repository,
      graph,
      sourceTable,
      targetTable,
      routes,
      environmentId,
      new GuidedTraversalBusinessPathMetadataProvider(ctx)
    );
  } catch (error) {
    logWarn(
      ctx.output,
      `Managed Business Path overlay unavailable: ${error instanceof Error ? error.message : "unknown error"}`
    );
    return { preferredPaths: [], discoveredRoutes: routes };
  }
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
  deps: TraversalRoutePickerDeps,
  preferredPaths: readonly GuidedTraversalPreferredPath[] = []
): Promise<RoutePickerChoice | undefined> {
  const preferredPicks = buildPreferredRoutePicks(graph, preferredPaths);
  const picks = [
    ...preferredPicks,
    ...buildRouteGroupPicks(items, successMap, prepared.hiddenGroupCount, includeShowAll)
  ];

  while (true) {
    const selected = await deps.showRouteGroupQuickPick(picks, title, placeHolder);

    if (!selected) {
      return undefined;
    }

    if (selected.choiceKind === "preferred_route" && selected.route) {
      if (selected.feasibility?.status === "unselectable") {
        await (deps.showWarningMessage ?? vscode.window.showWarningMessage)(
          `This Preferred Business Path is metadata-valid but not runnable by the current Guided Traversal executor: ${selected.feasibility.reason}`
        );
        continue;
      }
      return {
        choiceKind: "route",
        route: selected.route
      };
    }

    if (selected.choiceKind === "preferred_notice") {
      const message = selected.preferredState === "stale"
        ? `This Preferred Business Path is stale: ${selected.detail ?? "saved metadata no longer resolves."}`
        : selected.preferredState === "unknown"
          ? `This Preferred Business Path could not be revalidated: ${selected.detail ?? "metadata validation is unavailable."}`
          : `This Preferred Business Path is metadata-valid but is not currently projectable as a runnable Guided Traversal route: ${selected.detail ?? "show alternatives or re-test the saved path."}`;
      await (deps.showWarningMessage ?? vscode.window.showWarningMessage)(message);
      continue;
    }

    if (selected.choiceKind === "route" && selected.route) {
      if (selected.feasibility?.status === "unselectable") {
        await (deps.showWarningMessage ?? vscode.window.showWarningMessage)(
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
  deps: TraversalRoutePickerDeps = createDefaultTraversalRoutePickerDeps(),
  requestedEndpoints?: { sourceTable: string; targetTable: string }
): Promise<TraversalRoute | undefined> {
  const overlayLoader = deps.loadBusinessPathOverlay ?? loadDefaultBusinessPathOverlay;
  const overlay = await overlayLoader(ctx, graph, routes, requestedEndpoints);
  const duplicateRouteIds = new Set(
    overlay.preferredPaths
      .filter((item) => item.state === "valid")
      .map((item) => item.duplicateDiscoveredRouteId)
      .filter((value): value is string => Boolean(value))
  );
  const alternativeRoutes = routes.filter((route) => !duplicateRouteIds.has(route.routeId));

  if (!routes.length && !overlay.preferredPaths.length) {
    return undefined;
  }

  const successMap = buildSuccessMap(ctx, alternativeRoutes.length ? alternativeRoutes : routes);
  const orderedRoutes = sortRoutesByHistoricalSuccess(alternativeRoutes, successMap);
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
    deps,
    overlay.preferredPaths
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
    deps,
    overlay.preferredPaths
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
    showWarningMessage: (message) => vscode.window.showWarningMessage(message),
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
  const exactPreferredPlan = plannedRoute.candidatePlans.length === 1
    ? plannedRoute.candidatePlans[0]
    : undefined;
  if (exactPreferredPlan?.preserveExactHops === true) {
    const feasibility = assessExecutionPlanFeasibility(graph, exactPreferredPlan);
    if (feasibility.status === "unselectable") {
      await vscode.window.showWarningMessage(
        `This exact Preferred Business Path is not runnable yet: ${feasibility.reason}`
      );
      return undefined;
    }
    return exactPreferredPlan;
  }

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
