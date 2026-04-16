import * as assert from "assert";
import {
  buildInitialTraversalGraphRouteWindow,
  buildTraversalGraphControlState,
  expandTraversalGraphRouteWindowToMax,
  getTraversalGraphVisibleRouteRange,
  shiftTraversalGraphRouteWindowNext,
  shiftTraversalGraphRouteWindowPrevious,
  sliceTraversalGraphVisibleRoutes
} from "../../../commands/router/actions/traversal/graph/traversalGraphRouteWindow.js";

suite("traversalGraphRouteWindow", () => {
  test("builds an initial top-5 window", () => {
    const window = buildInitialTraversalGraphRouteWindow(12);

    assert.deepStrictEqual(window, {
      startIndex: 0,
      visibleCount: 5,
      totalRoutes: 12,
      maxVisibleCount: 10
    });
  });

  test("expands to the capped max visible window", () => {
    const expanded = expandTraversalGraphRouteWindowToMax(
      buildInitialTraversalGraphRouteWindow(12)
    );

    assert.strictEqual(expanded.startIndex, 0);
    assert.strictEqual(expanded.visibleCount, 10);
  });

  test("shifts next and previous with safe clamping", () => {
    const initial = {
      startIndex: 0,
      visibleCount: 10,
      totalRoutes: 22,
      maxVisibleCount: 10
    };

    const next = shiftTraversalGraphRouteWindowNext(initial);
    const end = shiftTraversalGraphRouteWindowNext({
      ...initial,
      startIndex: 10
    });
    const previous = shiftTraversalGraphRouteWindowPrevious(next);

    assert.strictEqual(next.startIndex, 5);
    assert.strictEqual(end.startIndex, 12);
    assert.strictEqual(previous.startIndex, 0);
  });

  test("builds control state and visible range deterministically", () => {
    const window = {
      startIndex: 5,
      visibleCount: 10,
      totalRoutes: 20,
      maxVisibleCount: 10
    };

    assert.deepStrictEqual(buildTraversalGraphControlState(window), {
      canExpandToMax: false,
      canShiftNext: true,
      canShiftPrevious: true
    });
    assert.deepStrictEqual(getTraversalGraphVisibleRouteRange(window), {
      startOrdinal: 6,
      endOrdinal: 15
    });
  });

  test("slices only the visible routes", () => {
    const routes = ["r1", "r2", "r3", "r4", "r5", "r6"];
    const window = {
      startIndex: 2,
      visibleCount: 3,
      totalRoutes: 6,
      maxVisibleCount: 10
    };

    assert.deepStrictEqual(sliceTraversalGraphVisibleRoutes(routes, window), ["r3", "r4", "r5"]);
  });
});
