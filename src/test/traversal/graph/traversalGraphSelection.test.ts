import * as assert from "assert";
import {
  findBestFocusedTraversalGraphRoute,
  findBestVisibleTraversalGraphRoute,
  resolveTraversalGraphRouteSelectionFromClick,
  resolveTraversalGraphSelectedRouteId
} from "../../../commands/router/actions/traversal/graph/traversalGraphSelection.js";
import type { TraversalGraphSelectableRoute } from "../../../commands/router/actions/traversal/graph/traversalGraphTypes.js";

function buildSelectableRoute(args: {
  routeId: string;
  rank: number;
  isBestMatch?: boolean;
  isFocusedByKeyword?: boolean;
}): TraversalGraphSelectableRoute {
  return {
    routeId: args.routeId,
    rank: args.rank,
    isBestMatch: args.isBestMatch ?? false,
    isFocusedByKeyword: args.isFocusedByKeyword ?? false
  };
}

suite("traversalGraphSelection", () => {
  test("preserves a current visible selection", () => {
    const result = resolveTraversalGraphSelectedRouteId({
      visibleRoutes: [
        buildSelectableRoute({ routeId: "route-a", rank: 1, isBestMatch: true }),
        buildSelectableRoute({ routeId: "route-b", rank: 2 })
      ],
      currentSelectedRouteId: "route-b"
    });

    assert.deepStrictEqual(result, {
      selectedRouteId: "route-b",
      selectionSource: "preserved-current"
    });
  });

  test("falls back to the best focused visible route when current selection is invalid", () => {
    const visibleRoutes = [
      buildSelectableRoute({ routeId: "route-a", rank: 1 }),
      buildSelectableRoute({ routeId: "route-b", rank: 2, isFocusedByKeyword: true }),
      buildSelectableRoute({ routeId: "route-c", rank: 3, isFocusedByKeyword: true })
    ];

    assert.strictEqual(findBestFocusedTraversalGraphRoute(visibleRoutes)?.routeId, "route-b");
    assert.deepStrictEqual(
      resolveTraversalGraphSelectedRouteId({
        visibleRoutes,
        currentSelectedRouteId: "missing-route",
        focusedKeyword: "contact"
      }),
      {
        selectedRouteId: "route-b",
        selectionSource: "best-focused-fallback"
      }
    );
  });

  test("falls back to the best visible route when no focused route applies", () => {
    const visibleRoutes = [
      buildSelectableRoute({ routeId: "route-a", rank: 1, isBestMatch: true }),
      buildSelectableRoute({ routeId: "route-b", rank: 2 })
    ];

    assert.strictEqual(findBestVisibleTraversalGraphRoute(visibleRoutes)?.routeId, "route-a");
    assert.deepStrictEqual(
      resolveTraversalGraphSelectedRouteId({
        visibleRoutes,
        currentSelectedRouteId: undefined
      }),
      {
        selectedRouteId: "route-a",
        selectionSource: "best-visible-default"
      }
    );
  });

  test("resolves edge click route selection route-first", () => {
    const visibleRoutes = [
      buildSelectableRoute({ routeId: "route-a", rank: 1, isBestMatch: true }),
      buildSelectableRoute({ routeId: "route-b", rank: 2 })
    ];

    assert.strictEqual(
      resolveTraversalGraphRouteSelectionFromClick({
        clickedEdgeRouteIds: ["route-a", "route-b"],
        currentSelectedRouteId: "route-b",
        visibleRoutes
      }),
      "route-b"
    );

    assert.strictEqual(
      resolveTraversalGraphRouteSelectionFromClick({
        clickedEdgeRouteIds: ["route-a", "route-b"],
        visibleRoutes
      }),
      "route-a"
    );
  });
});
