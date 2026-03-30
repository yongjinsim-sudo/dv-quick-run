import * as assert from "assert";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { runFindPathToTableWorkflow } from "../../commands/router/actions/traversal/findPathToTableAction.js";
import type {
  PlannedTraversalRoute,
  TraversalExecutionPlan,
  TraversalGraph,
  TraversalRoute
} from "../../commands/router/actions/shared/traversal/traversalTypes.js";
import { TraversalCacheService } from "../../commands/router/actions/shared/traversal/traversalCacheService.js";

function createStubContext(logs?: string[]): CommandContext {
  return {
    ext: {} as CommandContext["ext"],
    output: {
      append: () => undefined,
      appendLine: (value: string) => {
        logs?.push(value);
      },
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
    getClient: () =>
      ({
        get: async () => ({ value: [] })
      }) as any
  };
}

function buildSelectedRoute(): TraversalRoute {
  return {
    routeId: "account-patient",
    sourceEntity: "account",
    targetEntity: "patient",
    entities: ["account", "patient"],
    edges: [
      {
        fromEntity: "account",
        toEntity: "patient",
        navigationPropertyName: "account_patient",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        referencingAttribute: "accountid"
      }
    ],
    hopCount: 1,
    confidence: "high"
  };
}

function buildPlannedRoute(route: TraversalRoute): PlannedTraversalRoute {
  return {
    route,
    breakpoints: [],
    candidatePlans: [
      {
        planId: "compact",
        label: "Compact",
        rationale: "Single-step route.",
        recommended: true,
        steps: [
          {
            stepNumber: 1,
            fromEntity: "account",
            toEntity: "patient",
            entities: ["account", "patient"],
            edges: route.edges,
            hopCount: 1,
            stageLabel: "account → patient"
          }
        ]
      }
    ],
    recommendedPlanId: "compact"
  };
}

suite("findPathToTableAction", () => {
  test("shows info when no route is found", async () => {
    const messages: string[] = [];

    await runFindPathToTableWorkflow(createStubContext(), {
      loadEntityOptions: async () => [
        { logicalName: "account", entitySetName: "accounts", fieldLogicalNames: [] },
        { logicalName: "contact", entitySetName: "contacts", fieldLogicalNames: [] }
      ],
      pickSourceEntity: async (options) => options[0],
      pickTargetEntity: async (options) => options[1],
      buildTraversalGraph: async () => ({ entities: {} } satisfies TraversalGraph),
      pickTraversalRoute: async (_graph, _routes) => undefined,
      pickExecutionPlan: async (_graph, _plannedRoute) => undefined,
      executeFirstStep: async () => undefined,
      showInfoMessage: (message) => {
        messages.push(message);
      }
    });

    assert.strictEqual(messages.length, 1);
    assert.strictEqual(messages[0], "DV Quick Run: No route found from account to contact.");
  });


  test("applies traversal scope logging once per workflow run", async () => {
    const logs: string[] = [];
    const selectedRoute = buildSelectedRoute();
    const plannedRoute = buildPlannedRoute(selectedRoute);
    const selectedPlan = plannedRoute.candidatePlans[0] as TraversalExecutionPlan;

    const graph: TraversalGraph = {
      entities: {
        account: {
          logicalName: "account",
          entitySetName: "accounts",
          primaryIdAttribute: "accountid",
          primaryNameAttribute: "name",
          fieldLogicalNames: [],
          outboundRelationships: []
        },
        patient: {
          logicalName: "patient",
          entitySetName: "patients",
          primaryIdAttribute: "patientid",
          primaryNameAttribute: "name",
          fieldLogicalNames: [],
          outboundRelationships: []
        }
      }
    };

    await runFindPathToTableWorkflow(createStubContext(logs), {
      loadEntityOptions: async () => [
        { logicalName: "account", entitySetName: "accounts", fieldLogicalNames: [] },
        { logicalName: "patient", entitySetName: "patients", fieldLogicalNames: [] }
      ],
      pickSourceEntity: async (options) => options[0],
      pickTargetEntity: async (options) => options[1],
      buildTraversalGraph: async () => graph,
      pickTraversalRoute: async () => selectedRoute,
      pickExecutionPlan: async () => selectedPlan,
      executeFirstStep: async () => undefined,
      showInfoMessage: () => undefined
    });

    const scopeLogs = logs.filter((entry) => entry.includes("[Traversal] Scope applied:"));
    assert.strictEqual(scopeLogs.length, 1);
  });

    test("executes first step for the selected route and itinerary", async () => {
    const executedRouteIds: string[] = [];
    const executedPlanLabels: string[] = [];

    const selectedRoute = buildSelectedRoute();
    const plannedRoute = buildPlannedRoute(selectedRoute);
    const selectedPlan = plannedRoute.candidatePlans[0] as TraversalExecutionPlan;

    const environmentKey = "https://example.crm.dynamics.com";

    const graph: TraversalGraph = {
      entities: {
        account: {
          logicalName: "account",
          entitySetName: "accounts",
          primaryIdAttribute: "accountid",
          primaryNameAttribute: "name",
          fieldLogicalNames: [],
          outboundRelationships: [
            {
              fromEntity: "account",
              toEntity: "patient",
              navigationPropertyName: "account_patient",
              relationshipType: "OneToMany",
              direction: "oneToMany",
              referencingAttribute: "accountid"
            }
          ]
        },
        patient: {
          logicalName: "patient",
          entitySetName: "patients",
          primaryIdAttribute: "patientid",
          primaryNameAttribute: "name",
          fieldLogicalNames: [],
          outboundRelationships: []
        }
      }
    };

    TraversalCacheService.clearAll();
    TraversalCacheService.setMetadata(environmentKey, graph);
    TraversalCacheService.setRoute(
      {
        environmentId: environmentKey,
        sourceTable: "account",
        targetTable: "patient",
        maxDepth: 5
      },
      [selectedRoute]
    );

    await runFindPathToTableWorkflow(createStubContext(), {
      loadEntityOptions: async () => [
        { logicalName: "account", entitySetName: "accounts", fieldLogicalNames: [] },
        { logicalName: "patient", entitySetName: "patients", fieldLogicalNames: [] }
      ],
      pickSourceEntity: async (options) => options[0],
      pickTargetEntity: async (options) => options[1],
      buildTraversalGraph: async () => graph,
      pickTraversalRoute: async (resolvedGraph, routes) => {
        assert.ok(routes.length >= 1);
        assert.ok(resolvedGraph.entities.account);
        assert.ok(resolvedGraph.entities.patient);
        return selectedRoute;
      },
      pickExecutionPlan: async (resolvedGraph, planned) => {
        assert.ok(resolvedGraph.entities.account);
        assert.ok(resolvedGraph.entities.patient);
        assert.strictEqual(planned.route.routeId, selectedRoute.routeId);
        return selectedPlan;
      },
      executeFirstStep: async (_ctx, _graph, route, itinerary) => {
        executedRouteIds.push(route.routeId);
        executedPlanLabels.push(itinerary.label);
      },
      showInfoMessage: () => undefined
    });

    assert.deepStrictEqual(executedRouteIds, [selectedRoute.routeId]);
    assert.deepStrictEqual(executedPlanLabels, [selectedPlan.label]);

    TraversalCacheService.clearAll();
  });
});