import * as assert from "assert";
import type { CommandContext } from "../../commands/context/commandContext.js";
import { runContinueTraversalAction } from "../../commands/router/actions/traversal/continueTraversalAction.js";
import {
  clearActiveTraversalProgress,
  setActiveTraversalProgress
} from "../../commands/router/actions/shared/traversal/traversalProgressStore.js";
import type { ActiveTraversalProgress } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function createStubContext(logs: string[]): CommandContext {
  return {
    ext: {} as CommandContext["ext"],
    output: {
      append: () => undefined,
      appendLine: (value: string) => {
        logs.push(value);
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
    getClient: () => ({}) as any
  };
}

function buildProgress(args?: {
  sessionId?: string;
  currentStepIndex?: number;
  stepCount?: number;
}): ActiveTraversalProgress {
  const stepCount = args?.stepCount ?? 2;

  const steps = Array.from({ length: stepCount }, (_, index) => ({
    stepNumber: index + 1,
    fromEntity: index === 0 ? "account" : "contact",
    toEntity: index === 0 ? "contact" : "task",
    entities: index === 0 ? ["account", "contact"] : ["contact", "task"],
    edges: [],
    hopCount: 1,
    stageLabel: index === 0 ? "account → contact" : "contact → task"
  }));

  return {
    sessionId: args?.sessionId ?? "session-1",
    debugLabel: "debug-session-1",
    route: {
      routeId: "route-1",
      sourceEntity: "account",
      targetEntity: "task",
      entities: ["account", "contact", "task"],
      edges: [],
      hopCount: 2,
      confidence: "high"
    },
    itinerary: {
      planId: "plan-1",
      label: "Compact",
      rationale: "test",
      steps
    },
    currentStepIndex: args?.currentStepIndex ?? 0,
    graph: {
      entities: {
        contact: {
          logicalName: "contact",
          entitySetName: "contacts",
          primaryIdAttribute: "contactid",
          primaryNameAttribute: "fullname",
          fieldLogicalNames: ["contactid", "fullname"],
          outboundRelationships: []
        },
        task: {
          logicalName: "task",
          entitySetName: "tasks",
          primaryIdAttribute: "activityid",
          primaryNameAttribute: "subject",
          fieldLogicalNames: ["activityid", "subject"],
          outboundRelationships: []
        }
      }
    },
    lastLanding: {
      entityName: "account",
      ids: ["account-1"]
    },
    nextQuerySequenceNumber: 1
  };
}

suite("continueTraversalAction", () => {
  test("logs when no active traversal is available", async () => {
    clearActiveTraversalProgress();

    const logs: string[] = [];
    await runContinueTraversalAction(createStubContext(logs));

    assert.ok(
      logs.some((entry) => entry.includes("No active traversal is available to continue."))
    );
  });

  test("blocks stale traversal session requests", async () => {
    clearActiveTraversalProgress();
    setActiveTraversalProgress(buildProgress({
      sessionId: "active-session"
    }));

    const logs: string[] = [];
    await runContinueTraversalAction(createStubContext(logs), {
      traversalSessionId: "stale-session",
      legIndex: 0,
      carryField: "contactid",
      carryValue: "contact-1"
    });

    assert.ok(
      logs.some((entry) => entry.includes("This traversal session is no longer active."))
    );

    clearActiveTraversalProgress();
  });

  test("clears progress and logs when traversal is already complete", async () => {
    clearActiveTraversalProgress();
    setActiveTraversalProgress(buildProgress({
      sessionId: "complete-session",
      currentStepIndex: 1,
      stepCount: 2
    }));

    const logs: string[] = [];
    await runContinueTraversalAction(createStubContext(logs), {
      traversalSessionId: "complete-session",
      legIndex: 1,
      carryField: "activityid",
      carryValue: "task-1"
    });

    assert.ok(
      logs.some((entry) => entry.includes("Traversal is already complete."))
    );

    assert.strictEqual(
      clearActiveTraversalProgress(),
      undefined
    );
  });
});