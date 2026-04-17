import * as assert from "assert";
import { buildTraversalGraphViewModel } from "../../../commands/router/actions/traversal/graph/traversalGraphViewModelBuilder.js";
import type { RankedTraversalRoute } from "../../../commands/router/actions/shared/traversal/traversalSelection.js";

function buildRankedRoute(args: {
  routeId: string;
  rankOrder: number;
  entities: string[];
  edgeNames?: string[];
  score?: number;
  isBestMatch?: boolean;
  reasons?: string[];
}): RankedTraversalRoute {
  const edgeNames = args.edgeNames ?? args.entities.slice(0, -1).map((_, index) => `rel_${index + 1}`);

  return {
    route: {
      routeId: args.routeId,
      sourceEntity: args.entities[0]!,
      targetEntity: args.entities[args.entities.length - 1]!,
      entities: args.entities,
      edges: edgeNames.map((navigationPropertyName, index) => ({
        fromEntity: args.entities[index]!,
        toEntity: args.entities[index + 1]!,
        navigationPropertyName,
        relationshipType: "ManyToOne",
        direction: "manyToOne"
      })),
      hopCount: Math.max(0, args.entities.length - 1),
      confidence: "high"
    },
    score: args.score ?? 100 - args.rankOrder,
    isBestMatch: args.isBestMatch ?? false,
    reasons: args.reasons ?? []
  };
}

suite("traversalGraphViewModelBuilder", () => {
  test("builds nodes, edges, routes, and side panel from the visible window only", () => {
    const rankedRoutes = [
      buildRankedRoute({
        routeId: "route-a",
        rankOrder: 1,
        entities: ["account", "contact", "task"],
        edgeNames: ["primarycontactid", "regardingobjectid_task"],
        isBestMatch: true,
        reasons: ["clean path", "strong relationship semantics"]
      }),
      buildRankedRoute({
        routeId: "route-b",
        rankOrder: 2,
        entities: ["account", "team", "task"],
        edgeNames: ["ownerid", "regardingobjectid_task"],
        reasons: ["clean path"]
      }),
      buildRankedRoute({
        routeId: "route-c",
        rankOrder: 3,
        entities: ["account", "contact", "account", "task"],
        edgeNames: ["primarycontactid", "parentcustomerid_account", "regardingobjectid_task"]
      })
    ];

    const model = buildTraversalGraphViewModel({
      sourceEntity: "account",
      targetEntity: "task",
      rankedRoutes,
      routeWindow: {
        startIndex: 0,
        visibleCount: 2,
        maxVisibleCount: 10
      }
    });

    assert.deepStrictEqual(model.routes.map((route) => route.routeId), ["route-a", "route-b"]);
    assert.deepStrictEqual(model.nodes.map((node) => node.id), ["account", "task", "contact", "team"]);
    assert.deepStrictEqual(model.edges.map((edge) => edge.id), [
       "account::contact",
       "contact::task",
       "account::team",
       "team::task"
    ]);
    assert.strictEqual(model.selectedRouteId, "route-a");
    assert.strictEqual(model.sidePanel.selectedRouteId, "route-a");
    assert.strictEqual(model.sidePanel.title, "account -> contact -> task");
    assert.strictEqual(model.routeGroups.length, 2);
    assert.deepStrictEqual(model.routeGroups.map((group) => [group.rank, group.variantCount]), [
      [1, 1],
      [2, 1]
    ]);
    assert.deepStrictEqual(model.sidePanel.positiveReasons, [
      "best match",
      "clean path",
      "strong relationship semantics"
    ]);
  });

  test("preserves a visible selected route and carries layout positions", () => {
    const rankedRoutes = [
      buildRankedRoute({
        routeId: "route-a",
        rankOrder: 1,
        entities: ["account", "contact", "task"],
        isBestMatch: true
      }),
      buildRankedRoute({
        routeId: "route-b",
        rankOrder: 2,
        entities: ["account", "team", "task"]
      })
    ];

    const model = buildTraversalGraphViewModel({
      sourceEntity: "account",
      targetEntity: "task",
      rankedRoutes,
      routeWindow: {
        startIndex: 0,
        visibleCount: 2,
        maxVisibleCount: 10
      },
      selectedRouteId: "route-b",
      layoutState: {
        positionsByNodeId: {
          team: { x: 120, y: 45 }
        }
      }
    });

    assert.strictEqual(model.selectedRouteId, "route-b");
    assert.strictEqual(model.sidePanel.selectedRouteId, "route-b");
    assert.deepStrictEqual(model.nodes.find((node) => node.id === "team")?.layout, {
      x: 120,
      y: 45
    });
  });

  test("marks loop-back routes and focused routes without leaking focus semantics into hidden routes", () => {
    const rankedRoutes = [
      buildRankedRoute({
        routeId: "route-a",
        rankOrder: 1,
        entities: ["account", "contact", "task"],
        isBestMatch: true
      }),
      buildRankedRoute({
        routeId: "route-b",
        rankOrder: 2,
        entities: ["account", "contact", "account", "task"]
      }),
      buildRankedRoute({
        routeId: "route-c",
        rankOrder: 3,
        entities: ["account", "team", "task"]
      })
    ];

    const model = buildTraversalGraphViewModel({
      sourceEntity: "account",
      targetEntity: "task",
      rankedRoutes,
      routeWindow: {
        startIndex: 1,
        visibleCount: 2,
        maxVisibleCount: 10
      },
      focusedKeyword: "team"
    });

    const loopBackRoute = model.routes.find((route) => route.routeId === "route-b");
    const focusedRoute = model.routes.find((route) => route.routeId === "route-c");
    const accountNode = model.nodes.find((node) => node.id === "account");
    const contactNode = model.nodes.find((node) => node.id === "contact");

    assert.strictEqual(loopBackRoute?.semantics.isLoopBack, true);
    assert.deepStrictEqual(loopBackRoute?.reasoning.warnings, ["repeated entity / loop-back"]);
    assert.strictEqual(focusedRoute?.semantics.isFocusedByKeyword, true);
    assert.strictEqual(accountNode?.styling.isDimmed, false);
    assert.strictEqual(contactNode?.styling.isDimmed, true);
    assert.deepStrictEqual(model.routes.map((route) => route.rank), [2, 3]);
  });
});
