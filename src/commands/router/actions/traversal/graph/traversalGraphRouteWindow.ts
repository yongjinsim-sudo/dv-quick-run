import type {
  TraversalGraphControlState,
  TraversalGraphRouteWindow
} from "./traversalGraphTypes.js";

export const DEFAULT_VISIBLE_ROUTE_COUNT = 5;
export const MAX_VISIBLE_ROUTE_COUNT = 10;
export const WINDOW_SHIFT_SIZE = 5;

export function buildInitialTraversalGraphRouteWindow(totalRoutes: number): TraversalGraphRouteWindow {
  const safeTotalRoutes = Math.max(0, totalRoutes);

  return {
    startIndex: 0,
    visibleCount: Math.min(DEFAULT_VISIBLE_ROUTE_COUNT, safeTotalRoutes, MAX_VISIBLE_ROUTE_COUNT),
    totalRoutes: safeTotalRoutes,
    maxVisibleCount: MAX_VISIBLE_ROUTE_COUNT
  };
}

export function expandTraversalGraphRouteWindowToMax(
  window: TraversalGraphRouteWindow
): TraversalGraphRouteWindow {
  const remainingRoutes = Math.max(0, window.totalRoutes - window.startIndex);
  const nextVisibleCount = Math.min(window.maxVisibleCount, remainingRoutes);

  if (nextVisibleCount <= window.visibleCount) {
    return window;
  }

  return {
    ...window,
    visibleCount: nextVisibleCount
  };
}

export function shiftTraversalGraphRouteWindowNext(
  window: TraversalGraphRouteWindow
): TraversalGraphRouteWindow {
  const lastValidStartIndex = Math.max(0, window.totalRoutes - window.visibleCount);
  const nextStartIndex = Math.min(window.startIndex + WINDOW_SHIFT_SIZE, lastValidStartIndex);

  if (nextStartIndex === window.startIndex) {
    return window;
  }

  return {
    ...window,
    startIndex: nextStartIndex
  };
}

export function shiftTraversalGraphRouteWindowPrevious(
  window: TraversalGraphRouteWindow
): TraversalGraphRouteWindow {
  const nextStartIndex = Math.max(0, window.startIndex - WINDOW_SHIFT_SIZE);

  if (nextStartIndex === window.startIndex) {
    return window;
  }

  return {
    ...window,
    startIndex: nextStartIndex
  };
}

export function getTraversalGraphVisibleRouteRange(
  window: TraversalGraphRouteWindow
): { startOrdinal: number; endOrdinal: number } {
  if (window.visibleCount <= 0 || window.totalRoutes <= 0) {
    return {
      startOrdinal: 0,
      endOrdinal: 0
    };
  }

  return {
    startOrdinal: window.startIndex + 1,
    endOrdinal: Math.min(window.startIndex + window.visibleCount, window.totalRoutes)
  };
}

export function buildTraversalGraphControlState(
  window: TraversalGraphRouteWindow
): TraversalGraphControlState {
  const remainingRoutes = Math.max(0, window.totalRoutes - window.startIndex);

  return {
    canExpandToMax:
      window.visibleCount < window.maxVisibleCount &&
      window.visibleCount < remainingRoutes,
    canShiftNext: window.startIndex + window.visibleCount < window.totalRoutes,
    canShiftPrevious: window.startIndex > 0
  };
}

export function sliceTraversalGraphVisibleRoutes<T>(
  rankedRoutes: T[],
  window: TraversalGraphRouteWindow
): T[] {
  return rankedRoutes.slice(window.startIndex, window.startIndex + window.visibleCount);
}
