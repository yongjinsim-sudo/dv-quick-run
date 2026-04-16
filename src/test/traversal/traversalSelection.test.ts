import * as assert from "assert";
import {
  buildRankedTraversalRoutes,
  scoreTraversalRouteForSelection
} from "../../commands/router/actions/shared/traversal/traversalSelection.js";
import type { TraversalRoute } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildRoute(args: {
  entities: string[];
  confidence?: "high" | "medium";
  edgeNames?: string[];
}): TraversalRoute {
  const entities = args.entities;
  const edgeNames = args.edgeNames ?? entities.slice(0, -1).map((_, index) => `rel_${index + 1}`);

  return {
    routeId: entities.join("::"),
    sourceEntity: entities[0]!,
    targetEntity: entities[entities.length - 1]!,
    entities,
    edges: edgeNames.map((navigationPropertyName, index) => ({
      fromEntity: entities[index]!,
      toEntity: entities[index + 1]!,
      navigationPropertyName,
      relationshipType: "ManyToOne",
      direction: "manyToOne"
    })),
    hopCount: Math.max(0, entities.length - 1),
    confidence: args.confidence ?? "high"
  };
}

suite("traversalSelection", () => {
  test("prefers business-relevant intermediate tables over system tables", () => {
    const businessRoute = buildRoute({
      entities: ["account", "contact", "opportunity"]
    });
    const systemRoute = buildRoute({
      entities: ["account", "_asyncoperation", "opportunity"]
    });

    const ranked = buildRankedTraversalRoutes([systemRoute, businessRoute]);

    assert.strictEqual(ranked[0]?.route.routeId, businessRoute.routeId);
    assert.ok(
      scoreTraversalRouteForSelection(businessRoute) >
      scoreTraversalRouteForSelection(systemRoute)
    );
  });

  test("still prefers shorter paths when business relevance is otherwise similar", () => {
    const shorterRoute = buildRoute({
      entities: ["account", "contact"]
    });
    const longerRoute = buildRoute({
      entities: ["account", "opportunity", "contact"]
    });

    const ranked = buildRankedTraversalRoutes([longerRoute, shorterRoute]);

    assert.strictEqual(ranked[0]?.route.routeId, shorterRoute.routeId);
    assert.ok(
      scoreTraversalRouteForSelection(shorterRoute) >
      scoreTraversalRouteForSelection(longerRoute)
    );
  });

  test("penalizes loop-back routes below equivalent clean routes", () => {
    const cleanRoute = buildRoute({
      entities: ["account", "contact", "task"],
      edgeNames: ["primarycontactid", "regardingobjectid_task"]
    });
    const loopBackRoute = buildRoute({
      entities: ["account", "contact", "account", "task"],
      edgeNames: ["primarycontactid", "parentcustomerid_account", "regardingobjectid_task"]
    });

    const ranked = buildRankedTraversalRoutes([loopBackRoute, cleanRoute]);

    assert.strictEqual(ranked[0]?.route.routeId, cleanRoute.routeId);
    assert.ok(
      scoreTraversalRouteForSelection(cleanRoute) >
      scoreTraversalRouteForSelection(loopBackRoute)
    );
  });

  test("marks only the strongest route as best match when no runner-up is close enough", () => {
    const topRoute = buildRoute({
      entities: ["account", "contact"],
      edgeNames: ["primarycontactid"]
    });
    const strongRunnerUp = buildRoute({
      entities: ["account", "opportunity", "contact"],
      edgeNames: ["customerid_account", "parentcontactid"]
    });
    const weakerAlternative = buildRoute({
      entities: ["account", "lead", "contact"],
      confidence: "medium",
      edgeNames: ["rel_a", "rel_b"]
    });

    const ranked = buildRankedTraversalRoutes([
      weakerAlternative,
      strongRunnerUp,
      topRoute
    ]);

    const bestMatches = ranked.filter((item) => item.isBestMatch);

    assert.deepStrictEqual(
      bestMatches.map((item) => item.route.routeId),
      [topRoute.routeId]
    );
  });

  test("does not over-tag alternatives when the top route is clearly ahead", () => {
    const topRoute = buildRoute({
      entities: ["account", "contact"],
      edgeNames: ["primarycontactid"]
    });
    const weakAlternative = buildRoute({
      entities: ["account", "_asyncoperation", "contact"],
      confidence: "medium",
      edgeNames: ["rel_a", "rel_b"]
    });
    const anotherWeakAlternative = buildRoute({
      entities: ["account", "lead", "opportunity", "contact"],
      confidence: "medium",
      edgeNames: ["rel_1", "rel_2", "rel_3"]
    });

    const ranked = buildRankedTraversalRoutes([
      weakAlternative,
      anotherWeakAlternative,
      topRoute
    ]);

    const bestMatches = ranked.filter((item) => item.isBestMatch);

    assert.deepStrictEqual(
      bestMatches.map((item) => item.route.routeId),
      [topRoute.routeId]
    );
  });
});
