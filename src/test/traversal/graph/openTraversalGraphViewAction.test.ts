import * as assert from "assert";
import type { CommandContext } from "../../../commands/context/commandContext.js";
import type { RankedTraversalRoute } from "../../../commands/router/actions/shared/traversal/traversalSelection.js";
import { buildInitialTraversalGraphRouteWindow } from "../../../commands/router/actions/traversal/graph/traversalGraphRouteWindow.js";
import {
  buildInitialTraversalGraphState,
  buildTraversalGraphWebviewHtml,
  runOpenTraversalGraphViewAction,
  type TraversalGraphUiModelMessage
} from "../../../commands/router/actions/traversal/graph/openTraversalGraphViewAction.js";
import type {
  BuildTraversalGraphViewModelArgs,
  TraversalGraphViewModel
} from "../../../commands/router/actions/traversal/graph/traversalGraphTypes.js";

function createRankedRoutes(): RankedTraversalRoute[] {
  return [
    {
      route: {
        routeId: "route-a",
        sourceEntity: "account",
        targetEntity: "task",
        entities: ["account", "contact", "task"],
        edges: [
          {
            fromEntity: "account",
            toEntity: "contact",
            navigationPropertyName: "primarycontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          },
          {
            fromEntity: "contact",
            toEntity: "task",
            navigationPropertyName: "regardingobjectid_task",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          }
        ],
        hopCount: 2,
        confidence: "high"
      },
      score: 100,
      isBestMatch: true,
      reasons: ["clean path"]
    }
  ];
}

function createGraphViewModel(): TraversalGraphViewModel {
  return {
    sourceEntity: "account",
    targetEntity: "task",
    routeWindow: {
      startIndex: 0,
      visibleCount: 1,
      totalRoutes: 1,
      maxVisibleCount: 10
    },
    controls: {
      canExpandToMax: false,
      canShiftNext: false,
      canShiftPrevious: false
    },
    focus: {
      hasActiveFocus: false
    },
    selectedRouteId: "route-a",
    nodes: [],
    edges: [],
    routes: [],
    sidePanel: {
      selectedRouteId: "route-a",
      title: "account -> contact -> task",
      positiveReasons: ["clean path"],
      warningReasons: [],
      action: {
        label: "Use this route",
        routeId: "route-a",
        enabled: true
      }
    }
  };
}

function createCommandContextStub(): CommandContext {
  return {
    ext: {} as CommandContext["ext"],
    output: {
      show: () => undefined
    } as CommandContext["output"],
    envContext: {} as CommandContext["envContext"],
    getBaseUrl: async () => "",
    getScope: () => "",
    getToken: async () => "",
    getClient: () => {
      throw new Error("not used");
    }
  };
}

suite("openTraversalGraphViewAction", () => {
  test("builds fresh deterministic graph state for initial open", () => {
    const state = buildInitialTraversalGraphState({
      sourceEntity: "account",
      targetEntity: "task",
      totalRoutes: 12,
      selectedRouteId: "route-b"
    });

    assert.deepStrictEqual(state, {
      sourceEntity: "account",
      targetEntity: "task",
      routeWindow: buildInitialTraversalGraphRouteWindow(12),
      selectedRouteId: "route-b",
      focusedKeyword: undefined,
      layoutState: {
        positionsByNodeId: {}
      }
    });
  });

  test("orchestrates graph build, cytoscape mapping, and surface hydration without recomputing traversal", async () => {
    const rankedRoutes = createRankedRoutes();
    const expectedGraph = createGraphViewModel();
    let builderArgs: BuildTraversalGraphViewModelArgs | undefined;
    let openPayload:
      | {
          graphState: ReturnType<typeof buildInitialTraversalGraphState>;
          renderMessage: TraversalGraphUiModelMessage;
        }
      | undefined;
    let mapperGraph: TraversalGraphViewModel | undefined;

    await runOpenTraversalGraphViewAction(
      createCommandContextStub(),
      {
        sourceEntity: "account",
        targetEntity: "task",
        rankedRoutes,
        selectedRouteId: "route-a"
      },
      {
        buildInitialGraphState: buildInitialTraversalGraphState,
        buildGraphViewModel: (args) => {
          builderArgs = args;
          return expectedGraph;
        },
        mapTraversalGraphViewModelToCy: ({ graph }) => {
          mapperGraph = graph;
          return {
            elements: [
              {
                group: "nodes",
                data: {
                  id: "account",
                  label: "account",
                  logicalName: "account",
                  role: "source",
                  routeCount: 1,
                  classes: ["role-source"]
                }
              }
            ]
          };
        },
        openGraphSurface: async ({ graphState, renderMessage }) => {
          openPayload = {
            graphState,
            renderMessage
          };
        },
        showInfoMessage: () => undefined
      }
    );

    assert.deepStrictEqual(builderArgs, {
      sourceEntity: "account",
      targetEntity: "task",
      rankedRoutes,
      routeWindow: {
        startIndex: 0,
        visibleCount: 1,
        maxVisibleCount: 10
      },
      selectedRouteId: "route-a",
      focusedKeyword: undefined,
      layoutState: {
        positionsByNodeId: {}
      }
    });
    assert.strictEqual(mapperGraph, expectedGraph);
    assert.deepStrictEqual(openPayload, {
      graphState: {
        sourceEntity: "account",
        targetEntity: "task",
        routeWindow: {
          startIndex: 0,
          visibleCount: 1,
          totalRoutes: 1,
          maxVisibleCount: 10
        },
        selectedRouteId: "route-a",
        focusedKeyword: undefined,
        layoutState: {
          positionsByNodeId: {}
        }
      },
      renderMessage: {
        type: "renderGraph",
        graphViewModel: expectedGraph,
        cyElements: [
          {
            group: "nodes",
            data: {
              id: "account",
              label: "account",
              logicalName: "account",
              role: "source",
              routeCount: 1,
              classes: ["role-source"]
            }
          }
        ]
      }
    });
  });

  test("returns early when no ranked routes exist", async () => {
    let infoMessage: string | undefined;
    let openCalled = false;

    await runOpenTraversalGraphViewAction(
      createCommandContextStub(),
      {
        sourceEntity: "account",
        targetEntity: "task",
        rankedRoutes: []
      },
      {
        buildInitialGraphState: buildInitialTraversalGraphState,
        buildGraphViewModel: () => {
          throw new Error("should not build");
        },
        mapTraversalGraphViewModelToCy: () => {
          throw new Error("should not map");
        },
        openGraphSurface: async () => {
          openCalled = true;
        },
        showInfoMessage: (message) => {
          infoMessage = message;
          return undefined;
        }
      }
    );

    assert.strictEqual(
      infoMessage,
      "DV Quick Run: No traversal routes are available for graph view."
    );
    assert.strictEqual(openCalled, false);
  });

  test("builds a minimal hydration shell with one coherent render payload", () => {
    const html = buildTraversalGraphWebviewHtml({
      panelTitle: "DV Quick Run Guided Traversal Graph",
      renderMessage: {
        type: "renderGraph",
        graphViewModel: createGraphViewModel(),
        cyElements: []
      }
    });

    assert.match(html, /DV Quick Run Guided Traversal Graph/);
    assert.match(html, /Hydration Payload/);
    assert.match(html, /renderGraph/);
    assert.match(html, /selected: /);
  });
});
