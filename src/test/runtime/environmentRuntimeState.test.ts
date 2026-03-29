import * as assert from "assert";
import { clearEnvironmentScopedRuntimeCachesWithDeps } from "../../runtime/environmentRuntimeState.js";
import {
  clearActiveTraversalProgress,
  getActiveTraversalProgress,
  setActiveTraversalProgress
} from "../../commands/router/actions/shared/traversal/traversalProgressStore.js";

suite("environmentRuntimeState", () => {
  test("clears all runtime caches and logs when output is present", () => {
    let metadataCleared = 0;
    let relationshipCleared = 0;
    let traversalCleared = 0;
    let hoverCleared = 0;
    let navigationCleared = 0;
    const logs: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => { metadataCleared++; },
        clearRelationshipMetadataMemory: () => { relationshipCleared++; },
        clearTraversalCache: () => { traversalCleared++; },
        clearHoverFieldContextCache: () => { hoverCleared++; },
        clearNavigationHoverEnrichmentCache: () => { navigationCleared++; },
        logInfo: (message: string) => { logs.push(message); }
      },
      {} as any
    );

    assert.strictEqual(metadataCleared, 1);
    assert.strictEqual(relationshipCleared, 1);
    assert.strictEqual(traversalCleared, 1);
    assert.strictEqual(hoverCleared, 1);
    assert.strictEqual(navigationCleared, 1);
    assert.strictEqual(logs.length, 1);
  });

  test("does not log when no output channel is supplied", () => {
    const logs: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => undefined,
        clearRelationshipMetadataMemory: () => undefined,
        clearTraversalCache: () => { undefined; },
        clearHoverFieldContextCache: () => undefined,
        clearNavigationHoverEnrichmentCache: () => undefined,
        logInfo: (message: string) => { logs.push(message); }
      },
      undefined
    );

    assert.deepStrictEqual(logs, []);
  });

  test("clears active traversal progress on environment change", () => {
    setActiveTraversalProgress({
      sessionId: "session-1",
      debugLabel: "debug-session-1",
      route: {
        routeId: "route-1",
        sourceEntity: "account",
        targetEntity: "contact",
        entities: ["account", "contact"],
        edges: [],
        hopCount: 1,
        confidence: "high"
      },
      itinerary: {
        planId: "plan-1",
        label: "Compact",
        rationale: "test",
        steps: [
          {
            stepNumber: 1,
            fromEntity: "account",
            toEntity: "contact",
            entities: ["account", "contact"],
            edges: [],
            hopCount: 1,
            stageLabel: "account → contact"
          }
        ]
      },
      currentStepIndex: 0,
      graph: {
        entities: {}
      }
    });

    assert.ok(getActiveTraversalProgress());

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => undefined,
        clearRelationshipMetadataMemory: () => undefined,
        clearTraversalCache: () => undefined,
        clearHoverFieldContextCache: () => undefined,
        clearNavigationHoverEnrichmentCache: () => undefined,
        logInfo: () => undefined
      },
      undefined
    );

    assert.strictEqual(getActiveTraversalProgress(), undefined);

    clearActiveTraversalProgress();
  });
});