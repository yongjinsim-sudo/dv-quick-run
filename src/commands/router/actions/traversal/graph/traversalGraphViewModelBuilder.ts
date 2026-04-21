import {
  buildTraversalGraphControlState,
  sliceTraversalGraphVisibleRoutes
} from "./traversalGraphRouteWindow.js";
import { resolveTraversalGraphSelectedRouteId } from "./traversalGraphSelection.js";
import type {
  BuildTraversalGraphViewModelArgs,
  TraversalGraphEdgeViewModel,
  TraversalGraphFocusState,
  TraversalGraphNodeRole,
  TraversalGraphNodeViewModel,
  TraversalGraphRouteGroupViewModel,
  TraversalGraphRouteVariantViewModel,
  TraversalGraphRouteViewModel,
  TraversalGraphSelectableRoute,
  TraversalGraphSidePanelModel,
  TraversalGraphVariantConfidenceGroupViewModel,
  TraversalGraphViewModel
} from "./traversalGraphTypes.js";

export function buildTraversalGraphViewModel(
  args: BuildTraversalGraphViewModelArgs
): TraversalGraphViewModel {
  const focusState = buildTraversalGraphFocusState(args.focusedKeyword);
  const allRouteModels = args.rankedRoutes.map((item, index) =>
    buildRouteViewModel(item, index + 1, args.selectedRouteId, focusState)
  );
  const allRouteGroups = buildRouteGroups(allRouteModels);
  const routeWindow = {
    startIndex: args.routeWindow.startIndex,
    visibleCount: Math.min(args.routeWindow.visibleCount, args.routeWindow.maxVisibleCount, Math.max(0, allRouteGroups.length - args.routeWindow.startIndex) || 0),
    totalRoutes: allRouteGroups.length,
    maxVisibleCount: args.routeWindow.maxVisibleCount
  };
  const visibleRouteGroups = sliceTraversalGraphVisibleRoutes(allRouteGroups, routeWindow);
  const visibleRouteIds = new Set(visibleRouteGroups.flatMap((group) => group.variants.map((variant) => variant.routeId)));
  const visibleRouteModels = allRouteModels.filter((route) => visibleRouteIds.has(route.routeId));
  const selectableVisibleRoutes = visibleRouteModels.map((route) => ({
    routeId: route.routeId,
    rank: route.rank,
    isBestMatch: route.semantics.isBestMatch,
    isFocusedByKeyword: route.semantics.isFocusedByKeyword
  }));
  const selection = resolveTraversalGraphSelectedRouteId({
    visibleRoutes: selectableVisibleRoutes,
    currentSelectedRouteId: args.selectedRouteId,
    focusedKeyword: focusState.keyword
  });

  const selectedRouteId = selection.selectedRouteId;
  const bestVisibleRouteId = visibleRouteModels[0]?.routeId;
  const routeModels = visibleRouteModels.map((route) => ({
    ...route,
    semantics: {
      ...route.semantics,
      isSelected: route.routeId === selectedRouteId
    }
  }));
  const routeGroups = buildRouteGroups(routeModels)
    .filter((group) => visibleRouteGroups.some((visible) => visible.groupId === group.groupId));
  const nodeModels = buildVisibleNodeModels(
    routeModels,
    args.sourceEntity,
    args.targetEntity,
    focusState,
    bestVisibleRouteId,
    selectedRouteId,
    args.layoutState?.positionsByNodeId
  );
  const edgeModels = buildVisibleEdgeModels(routeModels, focusState, selectedRouteId);
  const sidePanel = buildTraversalGraphSidePanelModel(routeModels, routeGroups, selectedRouteId);

  return {
    sourceEntity: args.sourceEntity,
    targetEntity: args.targetEntity,
    routeWindow,
    controls: buildTraversalGraphControlState(routeWindow),
    focus: focusState,
    selectedRouteId,
    nodes: nodeModels,
    edges: edgeModels,
    routes: routeModels,
    routeGroups,
    sidePanel
  };
}

function buildTraversalGraphFocusState(focusedKeyword?: string): TraversalGraphFocusState {
  const keyword = focusedKeyword?.trim();
  const normalizedKeyword = normalizeKeyword(keyword);

  return {
    keyword,
    normalizedKeyword,
    hasActiveFocus: normalizedKeyword.length > 0
  };
}

function buildRouteViewModel(
  rankedRoute: BuildTraversalGraphViewModelArgs["rankedRoutes"][number],
  rank: number,
  selectedRouteId: string | undefined,
  focusState: TraversalGraphFocusState
): TraversalGraphRouteViewModel {
  const route = rankedRoute.route;
  const edgeIds = route.edges.map(buildEdgeId);
  const isLoopBack = countRepeatedEntities(route.entities) > 0;
  const isSystemHeavy = false;

  return {
    routeId: route.routeId,
    rank,
    label: route.entities.join(" -> "),
    entities: [...route.entities],
    edgeIds,
    hopCount: route.hopCount,
    confidence: route.confidence,
    score: rankedRoute.score,
    semantics: {
      isBestMatch: rankedRoute.isBestMatch,
      isSelected: route.routeId === selectedRouteId,
      isFocusedByKeyword: isRouteFocusedByKeyword(route.entities, focusState.normalizedKeyword),
      isSystemHeavy,
      isLoopBack,
      isBlocked: false,
      isPractical: true
    },
    reasoning: {
      positive: buildPositiveReasons(rankedRoute.isBestMatch, rankedRoute.reasons),
      warnings: buildWarningReasons(isLoopBack, isSystemHeavy)
    }
  };
}

function buildVisibleNodeModels(
  routeModels: TraversalGraphRouteViewModel[],
  sourceEntity: string,
  targetEntity: string,
  focusState: TraversalGraphFocusState,
  bestVisibleRouteId: string | undefined,
  selectedRouteId: string | undefined,
  positionsByNodeId?: Record<string, { x: number; y: number }>
): TraversalGraphNodeViewModel[] {
  const nodeMap = new Map<string, TraversalGraphNodeViewModel>();

  for (const route of routeModels) {
    for (const entity of route.entities) {
      const existing = nodeMap.get(entity);
      const layoutPosition = positionsByNodeId?.[entity];
      const isFocusedByKeyword =
        isEntityFocusedByKeyword(entity, focusState.normalizedKeyword) ||
        route.semantics.isFocusedByKeyword;
      const preferredRouteId = buildPreferredRouteIdForNode(routeModels, entity, selectedRouteId);

      if (!existing) {
        nodeMap.set(entity, {
          id: entity,
          logicalName: entity,
          label: entity,
          role: getNodeRole(entity, sourceEntity, targetEntity),
          styling: {
            isOnSelectedRoute: route.semantics.isSelected,
            isOnBestRoute: route.routeId === bestVisibleRouteId,
            isFocusedByKeyword,
            isSystemHeavy: route.semantics.isSystemHeavy,
            isLoopWarning: route.semantics.isLoopBack,
            isDimmed: false
          },
          metrics: {
            visibleRouteCount: 1,
            bestVisibleRank: route.rank
          },
          preferredRouteId,
          layout: layoutPosition ? { x: layoutPosition.x, y: layoutPosition.y } : undefined
        });
        continue;
      }

      existing.styling.isOnSelectedRoute = existing.styling.isOnSelectedRoute || route.semantics.isSelected;
      existing.styling.isOnBestRoute = existing.styling.isOnBestRoute || route.routeId === bestVisibleRouteId;
      existing.styling.isFocusedByKeyword = existing.styling.isFocusedByKeyword || isFocusedByKeyword;
      existing.styling.isSystemHeavy = existing.styling.isSystemHeavy || route.semantics.isSystemHeavy;
      existing.styling.isLoopWarning = existing.styling.isLoopWarning || route.semantics.isLoopBack;
      existing.metrics.visibleRouteCount += 1;
      existing.metrics.bestVisibleRank = Math.min(existing.metrics.bestVisibleRank ?? route.rank, route.rank);
      existing.preferredRouteId = preferredRouteId;
      if (layoutPosition) {
        existing.layout = { x: layoutPosition.x, y: layoutPosition.y };
      }
    }
  }

  for (const node of nodeMap.values()) {
    node.styling.isDimmed = shouldDimGraphItem(
      focusState.hasActiveFocus,
      Boolean(selectedRouteId),
      node.styling.isFocusedByKeyword,
      node.styling.isOnSelectedRoute,
      node.styling.isOnBestRoute
    );
  }

  return [...nodeMap.values()].sort((left, right) => {
    const roleDelta = rankNodeRole(left.role) - rankNodeRole(right.role);
    if (roleDelta !== 0) {
      return roleDelta;
    }

    const selectedDelta = Number(right.styling.isOnSelectedRoute) - Number(left.styling.isOnSelectedRoute);
    if (selectedDelta !== 0) {
      return selectedDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function buildVisibleEdgeModels(
  routeModels: TraversalGraphRouteViewModel[],
  focusState: TraversalGraphFocusState,
  selectedRouteId: string | undefined
): TraversalGraphEdgeViewModel[] {
  const edgeMap = new Map<string, TraversalGraphEdgeViewModel & { navigationNames: Set<string> }>();
  const bestVisibleRouteId = routeModels[0]?.routeId;

  for (const route of routeModels) {
    for (let index = 0; index < route.edgeIds.length; index += 1) {
      const edgeId = route.edgeIds[index]!;
      const fromNodeId = route.entities[index]!;
      const toNodeId = route.entities[index + 1]!;
      const navigationPropertyName = parseEdgeId(edgeId).navigationPropertyName;
      const aggregateEdgeId = buildAggregateEdgeId(fromNodeId, toNodeId);
      const existing = edgeMap.get(aggregateEdgeId);

      if (!existing) {
        edgeMap.set(aggregateEdgeId, {
          id: aggregateEdgeId,
          fromNodeId,
          toNodeId,
          navigationPropertyName,
          label: navigationPropertyName,
          routeIds: [route.routeId],
          styling: {
            isOnSelectedRoute: route.semantics.isSelected,
            isOnBestRoute: route.routeId === bestVisibleRouteId,
            isFocusedByKeyword: route.semantics.isFocusedByKeyword,
            isSystemHeavy: route.semantics.isSystemHeavy,
            isLoopWarning: route.semantics.isLoopBack,
            isBlocked: route.semantics.isBlocked,
            isDimmed: false
          },
          metrics: {
            visibleRouteCount: 1,
            bestVisibleRank: route.rank
          },
          navigationNames: new Set([navigationPropertyName])
        });
        continue;
      }

      if (!existing.routeIds.includes(route.routeId)) {
        existing.routeIds.push(route.routeId);
      }
      existing.navigationNames.add(navigationPropertyName);
      existing.styling.isOnSelectedRoute = existing.styling.isOnSelectedRoute || route.semantics.isSelected;
      existing.styling.isOnBestRoute = existing.styling.isOnBestRoute || route.routeId === bestVisibleRouteId;
      existing.styling.isFocusedByKeyword = existing.styling.isFocusedByKeyword || route.semantics.isFocusedByKeyword;
      existing.styling.isSystemHeavy = existing.styling.isSystemHeavy || route.semantics.isSystemHeavy;
      existing.styling.isLoopWarning = existing.styling.isLoopWarning || route.semantics.isLoopBack;
      existing.styling.isBlocked = existing.styling.isBlocked || route.semantics.isBlocked;
      existing.metrics.visibleRouteCount += 1;
      existing.metrics.bestVisibleRank = Math.min(existing.metrics.bestVisibleRank ?? route.rank, route.rank);

      if (route.routeId === selectedRouteId) {
        existing.navigationPropertyName = navigationPropertyName;
      }
    }
  }

  const edges = [...edgeMap.values()].map((edge) => {
    edge.routeIds.sort((left, right) => left.localeCompare(right));
    edge.label = buildAggregateEdgeLabel({
      navigationPropertyName: edge.navigationPropertyName,
      navigationNames: [...edge.navigationNames].sort((left, right) => left.localeCompare(right)),
      isOnSelectedRoute: edge.styling.isOnSelectedRoute
    });
    edge.styling.isDimmed = shouldDimGraphItem(
      focusState.hasActiveFocus,
      Boolean(selectedRouteId),
      edge.styling.isFocusedByKeyword,
      edge.styling.isOnSelectedRoute,
      edge.styling.isOnBestRoute
    );
    return edge;
  });

  return edges.sort((left, right) => {
    const selectedDelta = Number(right.styling.isOnSelectedRoute) - Number(left.styling.isOnSelectedRoute);
    if (selectedDelta !== 0) {
      return selectedDelta;
    }

    return left.id.localeCompare(right.id);
  });
}

function buildTraversalGraphSidePanelModel(
  routeModels: TraversalGraphRouteViewModel[],
  routeGroups: TraversalGraphRouteGroupViewModel[],
  selectedRouteId: string | undefined
): TraversalGraphSidePanelModel {
  const selectedRoute = routeModels.find((route) => route.routeId === selectedRouteId);
  const selectedGroup = routeGroups.find((group) => group.variants.some((variant) => variant.routeId === selectedRouteId));

  if (!selectedRoute || !selectedGroup) {
    return {
      selectedRouteId: undefined,
      selectedGroupId: undefined,
      confidenceExplanation: [],
      positiveReasons: [],
      comparisonReasons: [],
      warningReasons: [],
      variants: [],
      variantGroups: [],
      action: {
        label: "Use this route",
        enabled: false
      }
    };
  }

  const allRanksInGroup = selectedGroup.variants.map((variant) => variant.rank).sort((left, right) => left - right);

  return {
    selectedRouteId: selectedRoute.routeId,
    selectedGroupId: selectedGroup.groupId,
    title: selectedRoute.label,
    subtitle: buildRouteExecutionSubtitle(selectedRoute),
    rank: selectedRoute.rank,
    hopCount: selectedRoute.hopCount,
    confidence: selectedRoute.confidence,
    confidenceExplanation: buildConfidenceExplanation(selectedRoute),
    positiveReasons: [...selectedRoute.reasoning.positive],
    comparisonReasons: buildComparisonReasons({
      selectedRoute,
      selectedGroup,
      allRanksInGroup
    }),
    warningReasons: [...selectedRoute.reasoning.warnings],
    variantsTitle: selectedGroup.label,
    variants: dedupeVariants(selectedGroup.variants),
    variantGroups: buildVariantConfidenceGroups(dedupeVariants(selectedGroup.variants)),
    action: {
      label: "Use this route",
      routeId: selectedRoute.routeId,
      enabled: true
    }
  };
}



function buildPreferredRouteIdForNode(
  routeModels: TraversalGraphRouteViewModel[],
  nodeId: string,
  selectedRouteId: string | undefined
): string | undefined {
  const matchingRoutes = routeModels.filter((route) => route.entities.includes(nodeId));
  if (matchingRoutes.length === 0) {
    return undefined;
  }

  const selectedMatch = selectedRouteId
    ? matchingRoutes.find((route) => route.routeId === selectedRouteId)
    : undefined;
  if (selectedMatch) {
    return selectedMatch.routeId;
  }

  const [firstMatch] = matchingRoutes;
  return firstMatch?.routeId;
}

function buildVariantConfidenceGroups(
  variants: TraversalGraphRouteVariantViewModel[]
): TraversalGraphVariantConfidenceGroupViewModel[] {
  const groups = new Map<string, TraversalGraphRouteVariantViewModel[]>();

  for (const variant of variants) {
    const confidence = variant.confidence || "medium";
    const bucket = groups.get(confidence) || [];
    bucket.push(variant);
    groups.set(confidence, bucket);
  }

  const order: Record<string, number> = { high: 0, medium: 1, low: 2 };

  return [...groups.entries()]
    .map(([confidence, items]) => ({
      confidence: confidence as "high" | "medium",
      items: [...items].sort((left, right) => {
        const selectedDelta = Number(right.isSelected) - Number(left.isSelected);
        if (selectedDelta !== 0) {
          return selectedDelta;
        }

        const rankDelta = left.rank - right.rank;
        if (rankDelta !== 0) {
          return rankDelta;
        }

        const chainDelta = (left.navigationChain?.length ?? 0) - (right.navigationChain?.length ?? 0);
        if (chainDelta !== 0) {
          return chainDelta;
        }

        const leftLoopPenalty = left.loopPenalty ?? 0;
        const rightLoopPenalty = right.loopPenalty ?? 0;
        if (leftLoopPenalty !== rightLoopPenalty) {
          return leftLoopPenalty - rightLoopPenalty;
        }

        return left.routeId.localeCompare(right.routeId);
      })
    }))
    .sort((left, right) => (order[left.confidence] ?? 99) - (order[right.confidence] ?? 99));
}

function buildRouteExecutionSubtitle(route: TraversalGraphRouteViewModel): string | undefined {
  const navigationChain = route.edgeIds
    .map((edgeId) => parseEdgeId(edgeId).navigationPropertyName)
    .filter((value) => value.trim().length > 0);

  if (navigationChain.length === 0) {
    return undefined;
  }

  return `via ${navigationChain.join(" → ")}`;
}

function buildRouteGroups(
  routeModels: TraversalGraphRouteViewModel[]
): TraversalGraphRouteGroupViewModel[] {
  const groups = new Map<string, TraversalGraphRouteGroupViewModel>();

  for (const route of routeModels) {
    const groupId = buildRouteGroupId(route.entities);
    const subtitle = buildRouteVariantSubtitle(route);
    const variant: TraversalGraphRouteVariantViewModel = {
      routeId: route.routeId,
      rank: route.rank,
      label: route.label,
      subtitle,
      variantKey: subtitle,
      navigationChain: route.edgeIds
        .map((edgeId) => parseEdgeId(edgeId).navigationPropertyName)
        .filter((value) => value.trim().length > 0),
      confidence: route.confidence,
      isSelected: route.semantics.isSelected,
      loopPenalty: Number(route.semantics.isLoopBack) + Number(route.semantics.isSystemHeavy)
    };

    const existing = groups.get(groupId);
    if (!existing) {
      groups.set(groupId, {
        groupId,
        rank: route.rank,
        label: route.label,
        entities: [...route.entities],
        variantCount: 1,
        selectedVariantRouteId: route.semantics.isSelected ? route.routeId : undefined,
        bestVariantRouteId: route.routeId,
        isSelected: route.semantics.isSelected,
        isBestMatch: route.semantics.isBestMatch,
        variants: [variant]
      });
      continue;
    }

    existing.variants.push(variant);
    existing.variantCount += 1;
    existing.rank = Math.min(existing.rank, route.rank);
    existing.isBestMatch = existing.isBestMatch || route.semantics.isBestMatch;
    existing.isSelected = existing.isSelected || route.semantics.isSelected;
    if (route.semantics.isSelected) {
      existing.selectedVariantRouteId = route.routeId;
    }
    if (route.rank < existing.variants.find((item) => item.routeId === existing.bestVariantRouteId)!.rank) {
      existing.bestVariantRouteId = route.routeId;
    }
  }

  return [...groups.values()]
    .map((group) => ({
      ...group,
      variants: [...group.variants].sort((left, right) => {
        const selectedDelta = Number(right.isSelected) - Number(left.isSelected);
        if (selectedDelta !== 0) {
          return selectedDelta;
        }
        const rankDelta = left.rank - right.rank;
        if (rankDelta !== 0) {
          return rankDelta;
        }
        const chainDelta = (left.navigationChain?.length ?? 0) - (right.navigationChain?.length ?? 0);
        if (chainDelta !== 0) {
          return chainDelta;
        }
        return left.routeId.localeCompare(right.routeId);
      }),
      selectedVariantRouteId: group.selectedVariantRouteId ?? group.bestVariantRouteId
    }))
    .sort((left, right) => left.rank - right.rank || left.groupId.localeCompare(right.groupId));
}

function buildRouteGroupId(entities: string[]): string {
  return entities.join('::');
}

function buildRouteVariantSubtitle(route: TraversalGraphRouteViewModel): string | undefined {
  if (route.edgeIds.length === 0) {
    return undefined;
  }

  return route.edgeIds
    .map((edgeId) => parseEdgeId(edgeId).navigationPropertyName)
    .filter((value) => value.trim().length > 0)
    .join(' → ');
}

function getNodeRole(
  logicalName: string,
  sourceEntity: string,
  targetEntity: string
): TraversalGraphNodeRole {
  if (logicalName === sourceEntity) {
    return "source";
  }

  if (logicalName === targetEntity) {
    return "target";
  }

  return "intermediate";
}

function buildPositiveReasons(isBestMatch: boolean, rankedReasons: string[]): string[] {
  const reasons = [...rankedReasons];
  if (isBestMatch) {
    reasons.unshift("best match");
  }

  return dedupeStrings(reasons);
}

function buildWarningReasons(isLoopBack: boolean, isSystemHeavy: boolean): string[] {
  const warnings: string[] = [];
  if (isLoopBack) {
    warnings.push("repeated entity / loop-back");
  }

  if (isSystemHeavy) {
    warnings.push("system-heavy route");
  }

  return warnings;
}

function buildEdgeId(edge: { fromEntity: string; navigationPropertyName: string; toEntity: string }): string {
  return `${edge.fromEntity}::${edge.navigationPropertyName}::${edge.toEntity}`;
}

function parseEdgeId(edgeId: string): {
  fromEntity: string;
  navigationPropertyName: string;
  toEntity: string;
} {
  const [fromEntity = "", navigationPropertyName = "", toEntity = ""] = edgeId.split("::");
  return { fromEntity, navigationPropertyName, toEntity };
}

function countRepeatedEntities(entities: string[]): number {
  const seen = new Set<string>();
  let repeats = 0;

  for (const entity of entities) {
    const normalized = normalizeKeyword(entity);
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

function shouldDimGraphItem(
  hasActiveFocus: boolean,
  hasActiveSelectionContext: boolean,
  isFocusedByKeyword: boolean,
  isOnSelectedRoute: boolean,
  isOnBestRoute: boolean
): boolean {
  void hasActiveFocus;
  void isFocusedByKeyword;
  void isOnBestRoute;

  if (!hasActiveSelectionContext) {
    return false;
  }

  return !isOnSelectedRoute;
}


function buildAggregateEdgeId(fromNodeId: string, toNodeId: string): string {
  return `${fromNodeId}::${toNodeId}`;
}

function buildAggregateEdgeLabel(args: {
  navigationPropertyName: string;
  navigationNames: string[];
  isOnSelectedRoute: boolean;
}): string {
  if (args.isOnSelectedRoute && args.navigationPropertyName.trim()) {
    return args.navigationPropertyName;
  }

  if (args.navigationNames.length <= 1) {
    return args.navigationNames[0] ?? args.navigationPropertyName;
  }

  return `${args.navigationNames.length} relationships`;
}

function buildConfidenceExplanation(route: TraversalGraphRouteViewModel): string[] {
  const explanation: string[] = [];

  if (route.semantics.isBestMatch) {
    explanation.push("top-ranked match for this route family");
  }

  if (route.hopCount <= 1) {
    explanation.push("direct relationship with minimal traversal cost");
  } else if (route.hopCount === 2) {
    explanation.push("short multi-hop route with low complexity");
  } else {
    explanation.push("longer route, so confidence depends more on relationship quality");
  }

  if (route.semantics.isLoopBack) {
    explanation.push("loop-back semantics reduce confidence versus cleaner alternatives");
  } else {
    explanation.push("clean path without repeated entities");
  }

  return dedupeStrings(explanation);
}

function buildComparisonReasons(args: {
  selectedRoute: TraversalGraphRouteViewModel;
  selectedGroup: TraversalGraphRouteGroupViewModel;
  allRanksInGroup: number[];
}): string[] {
  const reasons: string[] = [];
  const selectedRoute = args.selectedRoute;
  const selectedGroup = args.selectedGroup;

  if (selectedRoute.rank === 1) {
    reasons.push("beats all visible alternatives on current ranking");
  } else if (selectedRoute.rank <= 3) {
    reasons.push("remains near the top of the visible route ranking");
  } else {
    reasons.push("chosen for route semantics rather than absolute rank");
  }

  if (selectedRoute.hopCount <= 1) {
    reasons.push("uses fewer joins than longer alternatives");
  } else if (selectedRoute.hopCount === 2) {
    reasons.push("balances reach with a relatively small number of joins");
  }

  if (selectedGroup.variantCount > 1) {
    reasons.push(`selected from ${selectedGroup.variantCount} variants in this route group`);
  }

  if (!selectedRoute.semantics.isLoopBack) {
    reasons.push("avoids repeated-entity loop-back patterns where available");
  }

  return dedupeStrings(reasons);
}

function dedupeVariants(variants: TraversalGraphRouteVariantViewModel[]): TraversalGraphRouteVariantViewModel[] {
  const seen = new Set<string>();
  const result: TraversalGraphRouteVariantViewModel[] = [];

  for (const variant of variants) {
    const key = `${variant.variantKey ?? variant.label}::${(variant.navigationChain ?? []).join("->")}::${variant.confidence}`.toLowerCase();
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(variant);
  }

  return result;
}

function rankNodeRole(role: TraversalGraphNodeRole): number {
  switch (role) {
    case "source":
      return 0;
    case "target":
      return 1;
    default:
      return 2;
  }
}

function isRouteFocusedByKeyword(entities: string[], normalizedKeyword?: string): boolean {
  if (!normalizedKeyword) {
    return false;
  }

  return entities.some((entity) => isEntityFocusedByKeyword(entity, normalizedKeyword));
}

function isEntityFocusedByKeyword(entity: string, normalizedKeyword?: string): boolean {
  if (!normalizedKeyword) {
    return false;
  }

  return normalizeKeyword(entity).includes(normalizedKeyword);
}

function normalizeKeyword(value?: string): string {
  return String(value ?? "").trim().toLowerCase();
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const trimmed = value.trim();
    if (!trimmed) {
      continue;
    }

    const normalized = trimmed.toLowerCase();
    if (seen.has(normalized)) {
      continue;
    }

    seen.add(normalized);
    result.push(trimmed);
  }

  return result;
}
