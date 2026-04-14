import type {
  ResolveTraversalGraphSelectionArgs,
  TraversalGraphSelectableRoute,
  TraversalGraphSelectionResolution
} from "./traversalGraphTypes.js";

export function resolveTraversalGraphSelectedRouteId(
  args: ResolveTraversalGraphSelectionArgs
): TraversalGraphSelectionResolution {
  if (args.visibleRoutes.length === 0) {
    return {
      selectedRouteId: undefined,
      selectionSource: "none"
    };
  }

  if (isTraversalGraphRouteVisible(args.currentSelectedRouteId, args.visibleRoutes)) {
    return {
      selectedRouteId: args.currentSelectedRouteId,
      selectionSource: "preserved-current"
    };
  }

  if (args.focusedKeyword?.trim()) {
    const bestFocusedRoute = findBestFocusedTraversalGraphRoute(args.visibleRoutes);
    if (bestFocusedRoute) {
      return {
        selectedRouteId: bestFocusedRoute.routeId,
        selectionSource: "best-focused-fallback"
      };
    }
  }

  const bestVisibleRoute = findBestVisibleTraversalGraphRoute(args.visibleRoutes);
  if (bestVisibleRoute) {
    return {
      selectedRouteId: bestVisibleRoute.routeId,
      selectionSource: "best-visible-default"
    };
  }

  return {
    selectedRouteId: args.visibleRoutes[0]?.routeId,
    selectionSource: args.visibleRoutes[0] ? "first-visible-fallback" : "none"
  };
}

export function isTraversalGraphRouteVisible(
  routeId: string | undefined,
  visibleRoutes: TraversalGraphSelectableRoute[]
): boolean {
  if (!routeId) {
    return false;
  }

  return visibleRoutes.some((route) => route.routeId === routeId);
}

export function findBestVisibleTraversalGraphRoute(
  visibleRoutes: TraversalGraphSelectableRoute[]
): TraversalGraphSelectableRoute | undefined {
  return [...visibleRoutes].sort(compareSelectableRoutes)[0];
}

export function findBestFocusedTraversalGraphRoute(
  visibleRoutes: TraversalGraphSelectableRoute[]
): TraversalGraphSelectableRoute | undefined {
  return visibleRoutes
    .filter((route) => route.isFocusedByKeyword)
    .sort(compareSelectableRoutes)[0];
}

export function resolveTraversalGraphRouteSelectionFromClick(args: {
  clickedRouteId?: string;
  clickedEdgeRouteIds?: string[];
  currentSelectedRouteId?: string;
  visibleRoutes: TraversalGraphSelectableRoute[];
}): string | undefined {
  if (isTraversalGraphRouteVisible(args.clickedRouteId, args.visibleRoutes)) {
    return args.clickedRouteId;
  }

  const matchingVisibleRoutes = args.visibleRoutes.filter((route) =>
    (args.clickedEdgeRouteIds ?? []).includes(route.routeId)
  );

  if (matchingVisibleRoutes.length > 0) {
    if (isTraversalGraphRouteVisible(args.currentSelectedRouteId, matchingVisibleRoutes)) {
      return args.currentSelectedRouteId;
    }

    return findBestVisibleTraversalGraphRoute(matchingVisibleRoutes)?.routeId;
  }

  return isTraversalGraphRouteVisible(args.currentSelectedRouteId, args.visibleRoutes)
    ? args.currentSelectedRouteId
    : undefined;
}

function compareSelectableRoutes(
  left: TraversalGraphSelectableRoute,
  right: TraversalGraphSelectableRoute
): number {
  if (left.rank !== right.rank) {
    return left.rank - right.rank;
  }

  if (left.isBestMatch !== right.isBestMatch) {
    return left.isBestMatch ? -1 : 1;
  }

  return left.routeId.localeCompare(right.routeId);
}
