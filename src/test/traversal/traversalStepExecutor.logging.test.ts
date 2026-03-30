import * as assert from "assert";
import { executeTraversalStep } from "../../commands/router/actions/shared/traversal/traversalStepExecutor.js";
import * as resultViewerLauncher from "../../commands/router/actions/execution/shared/resultViewerLauncher.js";
import type { CommandContext } from "../../commands/context/commandContext.js";
import type { TraversalExecutionPlan, TraversalExecutionStep, TraversalGraph } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function createStubContext(logs: string[], result: unknown): CommandContext {
  return {
    ext: {
      globalStorageUri: {
        fsPath: "C:/temp/dv-quick-run-test"
      },
      globalState: {
        get: () => undefined,
        update: async () => undefined,
        setKeysForSync: () => undefined
      },
      workspaceState: {
        get: () => undefined,
        update: async () => undefined
      }
    } as unknown as CommandContext["ext"],
    output: {
      append: () => undefined,
      appendLine: (value: string) => { logs.push(value); },
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
      getActiveEnvironment: () => ({ name: "TEST", url: "https://example.crm.dynamics.com" })
    } as CommandContext["envContext"],
    getBaseUrl: async () => "https://example.crm.dynamics.com",
    getScope: () => "https://example.crm.dynamics.com/.default",
    getToken: async () => "token",
    getClient: () => ({
      get: async () => result
    }) as any
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
        fieldLogicalNames: ["accountid", "name", "primarycontactid"],
        outboundRelationships: []
      },
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["contactid", "fullname", "createdby"],
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
  };
}

suite("traversalStepExecutor logging", () => {
  test("logs current leg landing instead of traversal completion for non-final steps", async () => {
    const logs: string[] = [];
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "account",
      toEntity: "contact",
      entities: ["account", "contact"],
      edges: [{
        fromEntity: "account",
        toEntity: "contact",
        navigationPropertyName: "primarycontactid",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        referencingAttribute: "primarycontactid"
      }],
      hopCount: 1,
      stageLabel: "account → contact"
    };

    const itinerary: TraversalExecutionPlan = {
      planId: "plan-1",
      label: "Compact",
      rationale: "test",
      steps: [step, { ...step, stepNumber: 2, fromEntity: "contact", toEntity: "task", stageLabel: "contact → task", entities: ["contact", "task"], edges: [] }]
    };

    const originalShowResultViewerForQuery = resultViewerLauncher.showResultViewerForQuery;
    (resultViewerLauncher as unknown as { showResultViewerForQuery: (...args: unknown[]) => Promise<void> }).showResultViewerForQuery = async () => undefined;

    try {
      await executeTraversalStep(
        createStubContext(logs, { value: [{ primarycontactid: { contactid: "contact-1" } }] }),
        buildGraph(),
        itinerary,
        step,
        undefined,
        1
      );
    } finally {
      (resultViewerLauncher as unknown as { showResultViewerForQuery: typeof originalShowResultViewerForQuery }).showResultViewerForQuery = originalShowResultViewerForQuery;
    }
    assert.ok(logs.some((entry) => entry.includes("Current landing: contact (1 row(s))")));
    assert.ok(!logs.some((entry) => entry.includes("Traversal complete. Final landing: contact")));
  });
});
