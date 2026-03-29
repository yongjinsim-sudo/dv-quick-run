import * as assert from "assert";
import {
  clearActiveTraversalProgress,
  getActiveTraversalProgress,
  isActiveTraversalSession,
  setActiveTraversalProgress
} from "../../commands/router/actions/shared/traversal/traversalProgressStore.js";
import type { ActiveTraversalProgress } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildProgress(sessionId: string): ActiveTraversalProgress {
  return {
    sessionId,
    debugLabel: `debug-${sessionId}`,
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
  };
}

suite("traversalProgressStore", () => {
  test("setActiveTraversalProgress stores the active traversal", () => {
    clearActiveTraversalProgress();

    const progress = buildProgress("session-1");
    setActiveTraversalProgress(progress);

    assert.deepStrictEqual(getActiveTraversalProgress(), progress);

    clearActiveTraversalProgress();
  });

  test("isActiveTraversalSession returns true only for the active session id", () => {
    clearActiveTraversalProgress();

    setActiveTraversalProgress(buildProgress("session-1"));

    assert.strictEqual(isActiveTraversalSession("session-1"), true);
    assert.strictEqual(isActiveTraversalSession("session-2"), false);

    clearActiveTraversalProgress();
  });

  test("clearActiveTraversalProgress removes active traversal state", () => {
    clearActiveTraversalProgress();

    setActiveTraversalProgress(buildProgress("session-1"));
    clearActiveTraversalProgress();

    assert.strictEqual(getActiveTraversalProgress(), undefined);
    assert.strictEqual(isActiveTraversalSession("session-1"), false);
  });
});