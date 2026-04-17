import * as assert from "assert";
import type { CommandContext } from "../../../commands/context/commandContext.js";
import type { RankedTraversalRoute } from "../../../commands/router/actions/shared/traversal/traversalSelection.js";
import { buildInitialTraversalGraphRouteWindow } from "../../../commands/router/actions/traversal/graph/traversalGraphRouteWindow.js";
import {
  buildInitialTraversalGraphState,
  buildTraversalGraphRenderMessage,
  buildTraversalGraphWebviewHtml,
  resolveTraversalGraphStateFromUiEvent,
  runOpenTraversalGraphViewAction,
  type TraversalGraphUiModelMessage
} from "../../../commands/router/actions/traversal/graph/openTraversalGraphViewAction.js";
import type {
  BuildTraversalGraphViewModelArgs,
  TraversalGraphViewModel
} from "../../../commands/router/actions/traversal/graph/traversalGraphTypes.js";

function createTestTraversalGraph() {
  return {
    nodes: [],
    edges: [],
    routes: [],
    entities: {}
  };
}

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
    },
    {
      route: {
        routeId: "route-b",
        sourceEntity: "account",
        targetEntity: "task",
        entities: ["account", "team", "task"],
        edges: [
          {
            fromEntity: "account",
            toEntity: "team",
            navigationPropertyName: "ownerid",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          },
          {
            fromEntity: "team",
            toEntity: "task",
            navigationPropertyName: "regardingobjectid_task",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          }
        ],
        hopCount: 2,
        confidence: "high"
      },
      score: 90,
      isBestMatch: false,
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
      hasActiveFocus: false
    },
    selectedRouteId: "route-a",
    nodes: [
      {
        id: "account",
        logicalName: "account",
        label: "account",
        role: "source",
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
      }
    ],
    edges: [
      {
        id: "account::primarycontactid::contact",
        fromNodeId: "account",
        toNodeId: "contact",
        navigationPropertyName: "primarycontactid",
        label: "primarycontactid",
        routeIds: ["route-a"],
        styling: {
          isOnSelectedRoute: true,
          isOnBestRoute: true,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopWarning: false,
          isBlocked: false,
          isDimmed: false
        },
        metrics: {
          visibleRouteCount: 1,
          bestVisibleRank: 1
        }
      },
      {
        id: "contact::regardingobjectid_task::task",
        fromNodeId: "contact",
        toNodeId: "task",
        navigationPropertyName: "regardingobjectid_task",
        label: "regardingobjectid_task",
        routeIds: ["route-a", "route-b"],
        styling: {
          isOnSelectedRoute: true,
          isOnBestRoute: true,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopWarning: false,
          isBlocked: false,
          isDimmed: false
        },
        metrics: {
          visibleRouteCount: 2,
          bestVisibleRank: 1
        }
      }
    ],
    routes: [
      {
        routeId: "route-a",
        rank: 1,
        label: "account -> contact -> task",
        entities: ["account", "contact", "task"],
        edgeIds: ["account::primarycontactid::contact", "contact::regardingobjectid_task::task"],
        hopCount: 2,
        confidence: "high",
        semantics: {
          isBestMatch: true,
          isSelected: true,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopBack: false,
          isBlocked: false,
          isPractical: true
        },
        reasoning: {
          positive: ["best match", "clean path"],
          warnings: []
        }
      },
      {
        routeId: "route-b",
        rank: 2,
        label: "account -> team -> task",
        entities: ["account", "team", "task"],
        edgeIds: ["account::ownerid::team", "team::regardingobjectid_task::task"],
        hopCount: 2,
        confidence: "high",
        semantics: {
          isBestMatch: false,
          isSelected: false,
          isFocusedByKeyword: false,
          isSystemHeavy: false,
          isLoopBack: false,
          isBlocked: false,
          isPractical: true
        },
        reasoning: {
          positive: ["clean path"],
          warnings: []
        }
      }
    ],
    routeGroups: [
      {
        groupId: "account::contact::task",
        rank: 1,
        label: "account -> contact -> task",
        entities: ["account", "contact", "task"],
        variantCount: 1,
        selectedVariantRouteId: "route-a",
        bestVariantRouteId: "route-a",
        isSelected: true,
        isBestMatch: true,
        variants: [
          {
            routeId: "route-a",
            rank: 1,
            label: "account -> task - high",
            subtitle: "direct path",
            navigationChain: ["Account_Tasks"],
            confidence: "high",
            isSelected: true
          }
        ]
      },
      {
        groupId: "account::team::task",
        rank: 2,
        label: "account -> team -> task",
        entities: ["account", "team", "task"],
        variantCount: 1,
        selectedVariantRouteId: "route-b",
        bestVariantRouteId: "route-b",
        isSelected: false,
        isBestMatch: false,
        variants: [
          {
            routeId: "route-b",
            rank: 2,
            label: "account -> contact -> task - high",
            subtitle: "via primarycontactid -> Contact_Tasks",
            navigationChain: ["primarycontactid", "Contact_Tasks"],
            confidence: "high",
            isSelected: false
          }
        ]
      }
    ],
    sidePanel: {
      selectedRouteId: "route-a",
      selectedGroupId: "account::contact::task",
      title: "account -> contact -> task",
      confidenceExplanation: ["top-ranked match for this route family"],
      positiveReasons: ["best match", "clean path"],
      comparisonReasons: ["uses fewer joins than alternatives"],
      warningReasons: [],
      variants: [
        {
            routeId: "route-a",
            rank: 1,
            label: "account -> task - high",
            subtitle: "direct path",
            navigationChain: ["Account_Tasks"],
            confidence: "high",
            isSelected: true
        }
      ],
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
          rankedRoutes: RankedTraversalRoute[];
        }
      | undefined;
    let mapperGraph: TraversalGraphViewModel | undefined;

    await runOpenTraversalGraphViewAction(
      createCommandContextStub(),
      {
        sourceEntity: "account",
        targetEntity: "task",
        rankedRoutes,
        selectedRouteId: "route-a",
        graph: createTestTraversalGraph()
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
        openGraphSurface: async ({ graphState, renderMessage, rankedRoutes }) => {
          openPayload = {
            graphState,
            renderMessage,
            rankedRoutes
          };
        },
        onUseRouteRequested: async () => undefined,
        showInfoMessage: () => undefined
      }
    );

    assert.deepStrictEqual(builderArgs, {
      sourceEntity: "account",
      targetEntity: "task",
      rankedRoutes,
      routeWindow: {
        startIndex: 0,
        visibleCount: 2,
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
          visibleCount: 2,
          totalRoutes: 2,
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
      },
      rankedRoutes
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
        rankedRoutes: [],
        graph: createTestTraversalGraph()
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
        onUseRouteRequested: async () => undefined,
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

  test("builds a real graph surface shell with graph canvas, route chips, and use-route action", () => {
    const html = buildTraversalGraphWebviewHtml({
      panelTitle: "DV Quick Run Guided Traversal Graph",
      renderMessage: {
        type: "renderGraph",
        graphViewModel: createGraphViewModel(),
        cyElements: []
      }
    });

    assert.match(html, /Graph view/);
    assert.match(html, /Selected route/);
    assert.match(html, /routeChips/);
    assert.match(html, /graphCanvas/);
    assert.match(html, /Use this route/);
    assert.match(html, /Variants/);
    assert.match(html, /routeGroups/);
    assert.match(html, /edgeClicked/);
    assert.match(html, /routeClicked/);
  });

  test("updates selected route from route and edge graph events", () => {
    const graphState = buildInitialTraversalGraphState({
      sourceEntity: "account",
      targetEntity: "task",
      totalRoutes: 2,
      selectedRouteId: "route-a"
    });
    const graphViewModel = createGraphViewModel();

    const routeClickedState = resolveTraversalGraphStateFromUiEvent({
      event: {
        type: "routeClicked",
        routeId: "route-b"
      },
      graphState,
      graphViewModel
    });

    const edgeClickedState = resolveTraversalGraphStateFromUiEvent({
      event: {
        type: "edgeClicked",
        edgeId: "contact::regardingobjectid_task::task",
        routeIds: ["route-a", "route-b"]
      },
      graphState: {
        ...graphState,
        selectedRouteId: "route-b"
      },
      graphViewModel
    });

    assert.strictEqual(routeClickedState.selectedRouteId, "route-b");
    assert.strictEqual(edgeClickedState.selectedRouteId, "route-b");
  });

  test("builds render messages from current graph state", () => {
    const rankedRoutes = createRankedRoutes();
    const graphState = buildInitialTraversalGraphState({
      sourceEntity: "account",
      targetEntity: "task",
      totalRoutes: rankedRoutes.length,
      selectedRouteId: "route-a"
    });

    const renderMessage = buildTraversalGraphRenderMessage({
      graphState,
      rankedRoutes,
      buildGraphViewModel: (args) => ({
        ...createGraphViewModel(),
        selectedRouteId: args.selectedRouteId
      }),
      mapTraversalGraphViewModelToCy: ({ graph }) => ({
        elements: [
          {
            group: "nodes",
            data: {
              id: graph.sourceEntity,
              label: graph.sourceEntity,
              logicalName: graph.sourceEntity,
              role: "source",
              routeCount: 1,
              classes: ["role-source"]
            }
          }
        ]
      })
    });

    assert.strictEqual(renderMessage.type, "renderGraph");
    assert.strictEqual(renderMessage.graphViewModel.selectedRouteId, "route-a");
    assert.strictEqual(renderMessage.cyElements.length, 1);
  });
});
