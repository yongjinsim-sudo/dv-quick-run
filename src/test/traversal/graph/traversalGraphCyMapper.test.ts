import * as assert from "assert";
import {
  buildTraversalGraphEdgeClasses,
  buildTraversalGraphNodeClasses,
  mapTraversalGraphViewModelToCy
} from "../../../commands/router/actions/traversal/graph/traversalGraphCyMapper.js";
import type { TraversalGraphViewModel } from "../../../commands/router/actions/traversal/graph/traversalGraphTypes.js";

function buildGraphViewModel(): TraversalGraphViewModel {
  return {
    sourceEntity: "account",
    targetEntity: "task",
    routeWindow: {
      startIndex: 0,
      visibleCount: 2,
      totalRoutes: 2,
      maxVisibleCount: 10
    },
    controls: {
      canExpandToMax: false,
      canShiftNext: false,
      canShiftPrevious: false
    },
    focus: {
      hasActiveFocus: true,
      keyword: "contact",
      normalizedKeyword: "contact"
    },
    selectedRouteId: "route-a",
    routeGroups: [],
    nodes: [
      {
        id: "task",
        logicalName: "task",
        label: "task",
        role: "target",
        styling: {
          isOnSelectedRoute: true,
          isOnBestRoute: true,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopWarning: false,
          isDimmed: false
        },
        metrics: {
          visibleRouteCount: 2,
          bestVisibleRank: 1
        }
      },
      {
        id: "contact",
        logicalName: "contact",
        label: "contact",
        role: "intermediate",
        styling: {
          isOnSelectedRoute: true,
          isOnBestRoute: false,
          isFocusedByKeyword: true,
          isSystemHeavy: true,
          isLoopWarning: true,
          isDimmed: false
        },
        metrics: {
          visibleRouteCount: 1,
          bestVisibleRank: 1
        },
        layout: {
          x: 420,
          y: 180
        }
      },
      {
        id: "account",
        logicalName: "account",
        label: "account",
        role: "source",
        styling: {
          isOnSelectedRoute: false,
          isOnBestRoute: false,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopWarning: false,
          isDimmed: true
        },
        metrics: {
          visibleRouteCount: 2,
          bestVisibleRank: 1
        }
      }
    ],
    edges: [
      {
        id: "b-edge",
        fromNodeId: "contact",
        toNodeId: "task",
        navigationPropertyName: "regardingobjectid_task",
        label: "regardingobjectid_task",
        routeIds: ["route-a"],
        styling: {
          isOnSelectedRoute: true,
          isOnBestRoute: true,
          isFocusedByKeyword: true,
          isSystemHeavy: false,
          isLoopWarning: false,
          isBlocked: true,
          isDimmed: false
        },
        metrics: {
          visibleRouteCount: 1,
          bestVisibleRank: 1
        }
      },
      {
        id: "a-edge",
        fromNodeId: "account",
        toNodeId: "contact",
        navigationPropertyName: "primarycontactid",
        label: "primarycontactid",
        routeIds: ["route-a", "route-b"],
        styling: {
          isOnSelectedRoute: false,
          isOnBestRoute: false,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopWarning: false,
          isBlocked: false,
          isDimmed: true
        },
        metrics: {
          visibleRouteCount: 2,
          bestVisibleRank: 2
        }
      }
    ],
    routes: [],
    sidePanel: {
      selectedRouteId: "route-a",
      title: "account -> task",
      confidenceExplanation: ["top-ranked match for this route family"],
      positiveReasons: ["best match"],
      comparisonReasons: ["uses fewer joins than alternatives"],
      warningReasons: [],
      variants: [],
      action: {
        label: "Use this route",
        routeId: "route-a",
        enabled: true
      }
    }
  };
}

suite("traversalGraphCyMapper", () => {
  test("maps styling flags to stable node and edge classes", () => {
    const graph = buildGraphViewModel();

    assert.deepStrictEqual(buildTraversalGraphNodeClasses(graph.nodes[1]!), [
      "role-intermediate",
      "selected-route",
      "system-heavy",
      "loop-warning"
    ]);
    assert.deepStrictEqual(buildTraversalGraphEdgeClasses(graph.edges[0]!), [
      "selected-route",
      "blocked"
    ]);
  });

  test("maps graph view model into deterministic cytoscape elements", () => {
    const mapped = mapTraversalGraphViewModelToCy({
      graph: buildGraphViewModel()
    });

    assert.deepStrictEqual(
      mapped.elements.map((element) => element.group === "nodes" ? element.data.id : element.data.id),
      ["account", "task", "contact", "b-edge", "a-edge"]
    );

    const contactNode = mapped.elements.find(
      (element) => element.group === "nodes" && element.data.id === "contact"
    );
    const bestEdge = mapped.elements.find(
      (element) => element.group === "edges" && element.data.id === "b-edge"
    );

    assert.deepStrictEqual(contactNode, {
      group: "nodes",
      data: {
        id: "contact",
        label: "contact",
        logicalName: "contact",
        role: "intermediate",
        routeCount: 1,
        bestVisibleRank: 1,
        classes: [
          "role-intermediate",
          "selected-route",
          "system-heavy",
          "loop-warning"
        ]
      },
      position: {
        x: 420,
        y: 180
      }
    });

    assert.deepStrictEqual(bestEdge, {
      group: "edges",
      data: {
        id: "b-edge",
        source: "contact",
        target: "task",
        label: "regardingobjectid_task",
        navigationPropertyName: "regardingobjectid_task",
        routeIds: ["route-a"],
        visibleRouteCount: 1,
        bestVisibleRank: 1,
        classes: ["selected-route", "blocked"]
      }
    });
  });
});
