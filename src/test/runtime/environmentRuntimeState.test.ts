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
    let investigationCleared = 0;
    let hoverCleared = 0;
    let navigationCleared = 0;
    const logs: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps(
      {
        clearMetadataSessionCache: () => { metadataCleared += 1; },
        clearRelationshipMetadataMemory: () => { relationshipCleared += 1; },
        clearTraversalCache: () => { traversalCleared += 1; },
        clearInvestigationContext: () => { investigationCleared += 1; },
        clearHoverFieldContextCache: () => { hoverCleared += 1; },
        clearNavigationHoverEnrichmentCache: () => { navigationCleared += 1; },
        logInfo: (message: string) => { logs.push(message); }
      },
      {} as any
    );

    assert.strictEqual(metadataCleared, 1);
    assert.strictEqual(relationshipCleared, 1);
    assert.strictEqual(traversalCleared, 1);
    assert.strictEqual(investigationCleared, 1);
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
        clearTraversalCache: () => undefined,
        clearInvestigationContext: () => undefined,
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
        clearInvestigationContext: () => undefined,
        clearHoverFieldContextCache: () => undefined,
        clearNavigationHoverEnrichmentCache: () => undefined,
        logInfo: () => undefined
      },
      undefined
    );

    assert.strictEqual(getActiveTraversalProgress(), undefined);

    clearActiveTraversalProgress();
  });

  test("clears investigation context through dependency hook", () => {
    const calls: string[] = [];

    clearEnvironmentScopedRuntimeCachesWithDeps({
      clearMetadataSessionCache: () => calls.push("metadata"),
      clearRelationshipMetadataMemory: () => calls.push("relationships"),
      clearHoverFieldContextCache: () => calls.push("hover"),
      clearNavigationHoverEnrichmentCache: () => calls.push("navHover"),
      clearTraversalCache: () => calls.push("traversal"),
      clearInvestigationContext: () => calls.push("investigation"),
      logInfo: () => undefined
    });

    assert.ok(calls.includes("investigation"));
  });
});
