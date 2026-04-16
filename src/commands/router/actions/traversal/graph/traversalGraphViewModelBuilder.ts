import { buildTraversalRouteDescription } from "../../shared/traversal/traversalSelection.js";
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
  TraversalGraphViewModel
} from "./traversalGraphTypes.js";

export function buildTraversalGraphViewModel(
  args: BuildTraversalGraphViewModelArgs
): TraversalGraphViewModel {
  const allRouteModels = args.rankedRoutes.map((item, index) =>
    buildRouteViewModel(item, index + 1, args.selectedRouteId, buildTraversalGraphFocusState(args.focusedKeyword))
  );
  const allRouteGroups = buildRouteGroups(allRouteModels);
  const routeWindow = {
    startIndex: args.routeWindow.startIndex,
    visibleCount: Math.min(args.routeWindow.visibleCount, args.routeWindow.maxVisibleCount, Math.max(0, allRouteGroups.length - args.routeWindow.startIndex) || 0),
    totalRoutes: allRouteGroups.length,
    maxVisibleCount: args.routeWindow.maxVisibleCount
  };
  const focusState = buildTraversalGraphFocusState(args.focusedKeyword);
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
    args.layoutState?.positionsByNodeId
  );
  const edgeModels = buildVisibleEdgeModels(routeModels, focusState);
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

function buildSelectableVisibleRoute(
  routeId: string,
  rank: number,
  isBestMatch: boolean,
  entities: string[],
  focusState: TraversalGraphFocusState
): TraversalGraphSelectableRoute {
  return {
    routeId,
    rank,
    isBestMatch,
    isFocusedByKeyword: isRouteFocusedByKeyword(entities, focusState.normalizedKeyword)
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
      if (layoutPosition) {
        existing.layout = { x: layoutPosition.x, y: layoutPosition.y };
      }
    }
  }

  for (const node of nodeMap.values()) {
    node.styling.isDimmed = shouldDimGraphItem(
      focusState.hasActiveFocus,
      node.styling.isFocusedByKeyword,
      node.styling.isOnSelectedRoute,
      node.styling.isOnBestRoute
    );
  }

  return [...nodeMap.values()].sort((left, right) => left.id.localeCompare(right.id));
}

function buildVisibleEdgeModels(
  routeModels: TraversalGraphRouteViewModel[],
  focusState: TraversalGraphFocusState
): TraversalGraphEdgeViewModel[] {
  const edgeMap = new Map<string, TraversalGraphEdgeViewModel>();
  const bestVisibleRouteId = routeModels[0]?.routeId;

  for (const route of routeModels) {
    for (let index = 0; index < route.edgeIds.length; index += 1) {
      const edgeId = route.edgeIds[index]!;
      const fromNodeId = route.entities[index]!;
      const toNodeId = route.entities[index + 1]!;
      const navigationPropertyName = parseEdgeId(edgeId).navigationPropertyName;
      const existing = edgeMap.get(edgeId);

      if (!existing) {
        edgeMap.set(edgeId, {
          id: edgeId,
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
          }
        });
        continue;
      }

      existing.routeIds.push(route.routeId);
      existing.styling.isOnSelectedRoute = existing.styling.isOnSelectedRoute || route.semantics.isSelected;
      existing.styling.isOnBestRoute = existing.styling.isOnBestRoute || route.routeId === bestVisibleRouteId;
      existing.styling.isFocusedByKeyword = existing.styling.isFocusedByKeyword || route.semantics.isFocusedByKeyword;
      existing.styling.isSystemHeavy = existing.styling.isSystemHeavy || route.semantics.isSystemHeavy;
      existing.styling.isLoopWarning = existing.styling.isLoopWarning || route.semantics.isLoopBack;
      existing.styling.isBlocked = existing.styling.isBlocked || route.semantics.isBlocked;
      existing.metrics.visibleRouteCount += 1;
      existing.metrics.bestVisibleRank = Math.min(existing.metrics.bestVisibleRank ?? route.rank, route.rank);
    }
  }

  for (const edge of edgeMap.values()) {
    edge.routeIds.sort((left, right) => left.localeCompare(right));
    edge.styling.isDimmed = shouldDimGraphItem(
      focusState.hasActiveFocus,
      edge.styling.isFocusedByKeyword,
      edge.styling.isOnSelectedRoute,
      edge.styling.isOnBestRoute
    );
  }

  return [...edgeMap.values()].sort((left, right) => left.id.localeCompare(right.id));
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
      positiveReasons: [],
      warningReasons: [],
      variants: [],
      action: {
        label: "Use this route",
        enabled: false
      }
    };
  }

  return {
    selectedRouteId: selectedRoute.routeId,
    selectedGroupId: selectedGroup.groupId,
    title: selectedRoute.label,
    subtitle: buildTraversalRouteDescription({
      routeId: selectedRoute.routeId,
      sourceEntity: selectedRoute.entities[0] ?? "",
      targetEntity: selectedRoute.entities[selectedRoute.entities.length - 1] ?? "",
      entities: selectedRoute.entities,
      edges: selectedRoute.edgeIds.map((edgeId) => ({
        ...parseEdgeId(edgeId),
        relationshipType: "ManyToOne",
        direction: "manyToOne"
      })),
      hopCount: selectedRoute.hopCount,
      confidence: selectedRoute.confidence
    }),
    rank: selectedRoute.rank,
    hopCount: selectedRoute.hopCount,
    confidence: selectedRoute.confidence,
    positiveReasons: [...selectedRoute.reasoning.positive],
    warningReasons: [...selectedRoute.reasoning.warnings],
    variants: selectedGroup.variants,
    action: {
      label: "Use this route",
      routeId: selectedRoute.routeId,
      enabled: true
    }
  };
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
      confidence: route.confidence,
      isSelected: route.semantics.isSelected
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
      variants: [...group.variants].sort((left, right) => left.rank - right.rank || left.routeId.localeCompare(right.routeId)),
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
  isFocusedByKeyword: boolean,
  isOnSelectedRoute: boolean,
  isOnBestRoute: boolean
): boolean {
  if (!hasActiveFocus) {
    return false;
  }

  return !isFocusedByKeyword && !isOnSelectedRoute && !isOnBestRoute;
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
