import * as assert from "assert";
import type { CommandContext } from "../../commands/context/commandContext.js";
import {
  buildSuccessfulRouteBadgeText,
  buildTraversalEnvironmentKey,
  buildTraversalPathSignature,
  getSuccessfulTraversalRouteMap,
  recordSuccessfulTraversalRoute,
  sortRoutesByHistoricalSuccess
} from "../../commands/router/actions/shared/traversal/traversalHistoryStore.js";
import type { TraversalRoute } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function createStubContext(args?: {
  environmentName?: string;
  environmentUrl?: string;
}): CommandContext {
  const environmentName = args?.environmentName ?? "TEST";
  const environmentUrl = args?.environmentUrl ?? "https://example.crm.dynamics.com";

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
      getEnvironmentName: () => environmentName,
      getBaseUrl: () => environmentUrl,
      getScope: () => `${environmentUrl}/.default`,
      getActiveEnvironment: () => ({
        name: environmentName,
        url: environmentUrl
      })
    } as CommandContext["envContext"],
    getBaseUrl: async () => environmentUrl,
    getScope: () => `${environmentUrl}/.default`,
    getToken: async () => "token",
    getClient: () => ({}) as any
  };
}

function buildRoute(args?: {
  routeId?: string;
  sourceEntity?: string;
  targetEntity?: string;
  schemaName?: string;
}): TraversalRoute {
  const sourceEntity = args?.sourceEntity ?? "account";
  const targetEntity = args?.targetEntity ?? "contact";

  return {
    routeId: args?.routeId ?? "route-1",
    sourceEntity,
    targetEntity,
    entities: [sourceEntity, targetEntity],
    edges: [
      {
        fromEntity: sourceEntity,
        toEntity: targetEntity,
        navigationPropertyName: "primarycontactid",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        schemaName: args?.schemaName ?? "account_primary_contact"
      }
    ],
    hopCount: 1,
    confidence: "high"
  };
}

suite("traversalHistoryStore", () => {
  test("buildTraversalEnvironmentKey prefers active environment url", () => {
    const ctx = createStubContext({
      environmentName: "DEV",
      environmentUrl: "https://Org.crm.dynamics.com"
    });

    assert.strictEqual(
      buildTraversalEnvironmentKey(ctx),
      "https://org.crm.dynamics.com"
    );
  });

  test("buildTraversalPathSignature normalizes route edge path", () => {
    const route = buildRoute({
      sourceEntity: "Account",
      targetEntity: "Contact",
      schemaName: " Account_Primary_Contact "
    });

    assert.strictEqual(
      buildTraversalPathSignature(route),
      "account:account_primary_contact:contact"
    );
  });

  test("recordSuccessfulTraversalRoute stores success for the current environment", () => {
    const ctx = createStubContext({
      environmentUrl: "https://env-a.crm.dynamics.com"
    });

    const route = buildRoute({
      routeId: "route-history-a"
    });

    recordSuccessfulTraversalRoute(ctx, route);

    const successMap = getSuccessfulTraversalRouteMap(ctx, "account", "contact");
    const entry = successMap.get("route-history-a");

    assert.ok(entry);
    assert.strictEqual(entry?.successCount, 1);
    assert.strictEqual(entry?.environmentKey, "https://env-a.crm.dynamics.com");
  });

  test("recordSuccessfulTraversalRoute increments success count for repeat success", () => {
    const ctx = createStubContext({
      environmentUrl: "https://env-repeat.crm.dynamics.com"
    });

    const route = buildRoute({
      routeId: "route-repeat"
    });

    recordSuccessfulTraversalRoute(ctx, route);
    recordSuccessfulTraversalRoute(ctx, route);

    const successMap = getSuccessfulTraversalRouteMap(ctx, "account", "contact");
    const entry = successMap.get("route-repeat");

    assert.ok(entry);
    assert.strictEqual(entry?.successCount, 2);
    assert.ok((entry?.lastSucceededAt ?? 0) > 0);
  });

  test("getSuccessfulTraversalRouteMap filters by environment and source/target", () => {
    const envA = createStubContext({
      environmentUrl: "https://env-a.crm.dynamics.com"
    });

    const envB = createStubContext({
      environmentUrl: "https://env-b.crm.dynamics.com"
    });

    recordSuccessfulTraversalRoute(envA, buildRoute({
      routeId: "route-env-a"
    }));

    recordSuccessfulTraversalRoute(envB, buildRoute({
      routeId: "route-env-b"
    }));

    const envAResult = getSuccessfulTraversalRouteMap(envA, "account", "contact");
    const envBResult = getSuccessfulTraversalRouteMap(envB, "account", "contact");

    assert.ok(envAResult.has("route-env-a"));
    assert.strictEqual(envAResult.has("route-env-b"), false);

    assert.ok(envBResult.has("route-env-b"));
    assert.strictEqual(envBResult.has("route-env-a"), false);
  });

  test("sortRoutesByHistoricalSuccess prefers higher success count then recency", () => {
    const routes: TraversalRoute[] = [
      buildRoute({ routeId: "route-low" }),
      buildRoute({ routeId: "route-high" }),
      buildRoute({ routeId: "route-recent" })
    ];

    const successMap = new Map([
      [
        "route-low",
        {
          environmentKey: "env",
          sourceEntity: "account",
          targetEntity: "contact",
          routeId: "route-low",
          pathSignature: "sig-low",
          successCount: 1,
          lastSucceededAt: 100
        }
      ],
      [
        "route-high",
        {
          environmentKey: "env",
          sourceEntity: "account",
          targetEntity: "contact",
          routeId: "route-high",
          pathSignature: "sig-high",
          successCount: 3,
          lastSucceededAt: 50
        }
      ],
      [
        "route-recent",
        {
          environmentKey: "env",
          sourceEntity: "account",
          targetEntity: "contact",
          routeId: "route-recent",
          pathSignature: "sig-recent",
          successCount: 3,
          lastSucceededAt: 200
        }
      ]
    ]);

    const sorted = sortRoutesByHistoricalSuccess(routes, successMap);

    assert.deepStrictEqual(
      sorted.map((route) => route.routeId),
      ["route-recent", "route-high", "route-low"]
    );
  });

  test("buildSuccessfulRouteBadgeText formats single and repeated success", () => {
    assert.strictEqual(buildSuccessfulRouteBadgeText(undefined), undefined);

    assert.strictEqual(
      buildSuccessfulRouteBadgeText({
        environmentKey: "env",
        sourceEntity: "account",
        targetEntity: "contact",
        routeId: "route-1",
        pathSignature: "sig",
        successCount: 1,
        lastSucceededAt: 1
      }),
      "Previously successful"
    );

    assert.strictEqual(
      buildSuccessfulRouteBadgeText({
        environmentKey: "env",
        sourceEntity: "account",
        targetEntity: "contact",
        routeId: "route-1",
        pathSignature: "sig",
        successCount: 4,
        lastSucceededAt: 1
      }),
      "Previously successful · used 4 times"
    );
  });
});