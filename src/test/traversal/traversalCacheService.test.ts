import * as assert from "assert";
import { TraversalCacheService } from "../../commands/router/actions/shared/traversal/traversalCacheService.js";

suite("traversalCacheService", () => {
  test("stores and returns metadata per environment", () => {
    TraversalCacheService.clearAll();

    const metadata = { graph: { entities: { account: {} } } };

    TraversalCacheService.setMetadata("env-a", metadata);

    assert.deepStrictEqual(
      TraversalCacheService.getMetadata("env-a"),
      metadata
    );
  });

  test("stores and returns routes by composite route key", () => {
    TraversalCacheService.clearAll();

    const routeKey = {
      environmentId: "env-a",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    const routes = [{ routeId: "route-1" }];

    TraversalCacheService.setRoute(routeKey, routes);

    assert.deepStrictEqual(
      TraversalCacheService.getRoute(routeKey),
      routes
    );
  });

  test("isolates route cache by environment", () => {
    TraversalCacheService.clearAll();

    const firstKey = {
      environmentId: "env-a",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    const secondKey = {
      environmentId: "env-b",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    TraversalCacheService.setRoute(firstKey, [{ routeId: "route-a" }]);
    TraversalCacheService.setRoute(secondKey, [{ routeId: "route-b" }]);

    assert.deepStrictEqual(TraversalCacheService.getRoute(firstKey), [{ routeId: "route-a" }]);
    assert.deepStrictEqual(TraversalCacheService.getRoute(secondKey), [{ routeId: "route-b" }]);
  });

  test("clearEnvironment removes metadata and routes only for that environment", () => {
    TraversalCacheService.clearAll();

    const envAKey = {
      environmentId: "env-a",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    const envBKey = {
      environmentId: "env-b",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    TraversalCacheService.setMetadata("env-a", { graph: "a" });
    TraversalCacheService.setMetadata("env-b", { graph: "b" });
    TraversalCacheService.setRoute(envAKey, [{ routeId: "route-a" }]);
    TraversalCacheService.setRoute(envBKey, [{ routeId: "route-b" }]);

    TraversalCacheService.clearEnvironment("env-a");

    assert.strictEqual(TraversalCacheService.getMetadata("env-a"), undefined);
    assert.deepStrictEqual(TraversalCacheService.getMetadata("env-b"), { graph: "b" });

    assert.strictEqual(TraversalCacheService.getRoute(envAKey), undefined);
    assert.deepStrictEqual(TraversalCacheService.getRoute(envBKey), [{ routeId: "route-b" }]);
  });

  test("clearAll removes all metadata and route entries", () => {
    TraversalCacheService.clearAll();

    const routeKey = {
      environmentId: "env-a",
      sourceTable: "account",
      targetTable: "contact",
      maxDepth: 5
    };

    TraversalCacheService.setMetadata("env-a", { graph: {} });
    TraversalCacheService.setRoute(routeKey, [{ routeId: "route-1" }]);

    TraversalCacheService.clearAll();

    assert.strictEqual(TraversalCacheService.getMetadata("env-a"), undefined);
    assert.strictEqual(TraversalCacheService.getRoute(routeKey), undefined);
  });
});