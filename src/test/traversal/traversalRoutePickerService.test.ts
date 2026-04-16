import * as assert from "assert";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { pickTraversalRouteFromQuickPick } from "../../commands/router/actions/traversal/traversalRoutePickerService.js";
import type { TraversalGraph, TraversalRoute } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function createStubContext(): CommandContext {
  return {
    ext: {} as CommandContext["ext"],
    output: {
      append: () => undefined,
      appendLine: () => undefined,
      clear: () => undefined,
      dispose: () => undefined,
      hide: () => undefined,
      name: "DV Quick Run",
      replace: () => undefined,
      show: () => undefined
    },
    envContext: {
      getEnvironmentName: () => "TEST",
      getBaseUrl: () => "https://example.crm.dynamics.com",
      getScope: () => "https://example.crm.dynamics.com/.default",
      getActiveEnvironment: () => ({
        name: "TEST",
        url: "https://example.crm.dynamics.com"
      })
    } as CommandContext["envContext"],
    getBaseUrl: async () => "https://example.crm.dynamics.com",
    getScope: () => "https://example.crm.dynamics.com/.default",
    getToken: async () => "token",
    getClient: () => ({ get: async () => ({ value: [] }) }) as any
  };
}

function buildRoute(args: {
  routeId: string;
  entities: string[];
  edgeNames?: string[];
  confidence?: "high" | "medium";
}): TraversalRoute {
  const edgeNames = args.edgeNames ?? args.entities.slice(0, -1).map((_, index) => `rel_${index + 1}`);

  return {
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
    confidence: args.confidence ?? "high"
  };
}

function buildGraph(): TraversalGraph {
  return {
    entities: {
      account: {
        logicalName: "account",
        entitySetName: "accounts",
        primaryIdAttribute: "accountid",
        primaryNameAttribute: "name",
        fieldLogicalNames: [],
        outboundRelationships: []
      },
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: [],
        outboundRelationships: []
      },
      task: {
        logicalName: "task",
        entitySetName: "tasks",
        primaryIdAttribute: "activityid",
        primaryNameAttribute: "subject",
        fieldLogicalNames: [],
        outboundRelationships: []
      }
    }
  };
}

suite("traversalRoutePickerService", () => {
  test("opens graph view from quick pick and closes the picker flow", async () => {
    const ctx = createStubContext();
    const graph = buildGraph();
    const bestRoute = buildRoute({
      routeId: "route-a",
      entities: ["account", "contact"],
      edgeNames: ["primarycontactid"]
    });
    const alternativeRoute = buildRoute({
      routeId: "route-b",
      entities: ["account", "task"],
      edgeNames: ["regardingobjectid_task"]
    });

    const graphCalls: Array<{ selectedRouteId?: string; orderedRouteIds: string[] }> = [];
    const pickLabels: string[][] = [];

    const selected = await pickTraversalRouteFromQuickPick(ctx, graph, [bestRoute, alternativeRoute], {
      showRouteGroupQuickPick: async (picks) => {
        pickLabels.push(picks.map((item) => item.label));
        return picks.find((item) => item.choiceKind === "open_graph");
      },
      openGraphView: async ({ orderedRoutes, selectedRouteId }) => {
        graphCalls.push({
          selectedRouteId,
          orderedRouteIds: orderedRoutes.map((route) => route.routeId)
        });
      }
    });

    assert.strictEqual(selected, undefined);
    assert.strictEqual(graphCalls.length, 1);
    assert.deepStrictEqual(graphCalls[0], {
      selectedRouteId: bestRoute.routeId,
      orderedRouteIds: [bestRoute.routeId, alternativeRoute.routeId]
    });
    assert.ok(pickLabels[0]?.includes("Open graph view"));
  });
});
