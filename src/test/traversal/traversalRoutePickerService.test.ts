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

  test("shows a valid Preferred Business Path first and removes its exact discovered duplicate from normal groups", async () => {
    const ctx = createStubContext();
    const graph = buildGraph();
    const preferredRoute = buildRoute({
      routeId: "route-preferred",
      entities: ["account", "contact"],
      edgeNames: ["primarycontactid"]
    });
    const alternativeRoute = buildRoute({
      routeId: "route-alternative",
      entities: ["account", "task"],
      edgeNames: ["regardingobjectid_task"]
    });

    const labels: string[][] = [];

    const selected = await pickTraversalRouteFromQuickPick(
      ctx,
      graph,
      [preferredRoute, alternativeRoute],
      {
        showRouteGroupQuickPick: async (picks) => {
          labels.push(picks.map((item) => item.label));
          return picks[0];
        },
        openGraphView: async () => undefined,
        loadBusinessPathOverlay: async (_ctx, _graph, routes) => ({
          discoveredRoutes: routes,
          preferredPaths: [{
            artifact: {
              schemaVersion: "dvqr-business-path-v1",
              id: "bp_12345678",
              name: "Our Account to Contact route",
              sourceTable: "account",
              targetTable: "contact",
              state: "preferred",
              hops: [{
                ordinal: 1,
                fromTable: "account",
                toTable: "contact",
                relationshipSchemaName: "account_primary_contact",
                relationshipType: "ManyToOne",
                direction: "forward",
                navigationProperty: "primarycontactid"
              }],
              provenance: {
                promotedFrom: "runtime-validation",
                promotedAt: "2026-08-18T00:00:00.000Z",
                promotedBy: "user"
              },
              verification: {
                status: "verified",
                verifiedAt: "2026-08-18T00:00:00.000Z",
                bounded: true
              },
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:00.000Z"
            },
            validation: {
              pathId: "bp_12345678",
              state: "valid",
              historicallyVerifiedInActiveEnvironment: null,
              checkedTables: ["account", "contact"],
              checkedHops: 1,
              issues: []
            },
            state: "valid",
            route: preferredRoute,
            duplicateDiscoveredRouteId: preferredRoute.routeId
          }]
        })
      }
    );

    assert.strictEqual(selected?.routeId, preferredRoute.routeId);
    assert.strictEqual(selected?.selectionAuthority, "workspacePreferred");
    assert.ok(labels[0]);
    assert.strictEqual(labels[0]![0], "★ Our Account to Contact route");
    assert.strictEqual(
      labels[0]!.filter((label) => label.includes("account -> contact")).length,
      0,
      "the discovered duplicate must not appear again as a normal route group"
    );
  });

  test("keeps a stale Preferred Business Path top-visible but does not select it", async () => {
    const ctx = createStubContext();
    const graph = buildGraph();
    const route = buildRoute({
      routeId: "route-a",
      entities: ["account", "contact"],
      edgeNames: ["primarycontactid"]
    });

    const labels: string[][] = [];
    const warnings: string[] = [];
    let call = 0;

    const selected = await pickTraversalRouteFromQuickPick(
      ctx,
      graph,
      [route],
      {
        showRouteGroupQuickPick: async (picks) => {
          labels.push(picks.map((item) => item.label));
          call += 1;
          return call === 1
            ? picks.find((item) => item.choiceKind === "preferred_notice")
            : picks.find((item) => item.choiceKind === "route" || item.choiceKind === "route_group");
        },
        openGraphView: async () => undefined,
        showWarningMessage: (message) => {
          warnings.push(message);
          return undefined;
        },
        loadBusinessPathOverlay: async (_ctx, _graph, routes) => ({
          discoveredRoutes: routes,
          preferredPaths: [{
            artifact: {
              schemaVersion: "dvqr-business-path-v1",
              id: "bp_87654321",
              name: "Old preferred route",
              sourceTable: "account",
              targetTable: "contact",
              state: "preferred",
              hops: [{
                ordinal: 1,
                fromTable: "account",
                toTable: "contact",
                relationshipSchemaName: "old_relationship",
                relationshipType: "ManyToOne",
                direction: "forward",
                navigationProperty: "old_navigation"
              }],
              provenance: {
                promotedFrom: "manual-reviewed",
                promotedAt: "2026-08-18T00:00:00.000Z",
                promotedBy: "user"
              },
              createdAt: "2026-08-18T00:00:00.000Z",
              updatedAt: "2026-08-18T00:00:00.000Z"
            },
            validation: {
              pathId: "bp_87654321",
              state: "stale",
              historicallyVerifiedInActiveEnvironment: null,
              checkedTables: ["account", "contact"],
              checkedHops: 1,
              issues: [{
                code: "relationship-missing",
                message: "Saved relationship no longer resolves.",
                hopOrdinal: 1
              }]
            },
            state: "stale"
          }]
        })
      }
    );

    assert.strictEqual(labels[0]?.[0], "★ Old preferred route");
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0] ?? "", /stale/i);
    assert.strictEqual(selected?.routeId, route.routeId);
  });

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
