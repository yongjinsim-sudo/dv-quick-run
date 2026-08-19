import * as assert from "assert";
import { buildStepExecutionPlan, executeTraversalStep } from "../../commands/router/actions/shared/traversal/traversalStepExecutor.js";
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

  test("executes Preferred continuation through the exact navigation for every bounded landed branch", async () => {
    const logs: string[] = [];
    const graph = {
      entities: {
        careplan: {
          logicalName: "careplan",
          entitySetName: "careplans",
          primaryIdAttribute: "careplanid",
          fieldLogicalNames: ["careplanid"],
          outboundRelationships: []
        },
        activity: {
          logicalName: "activity",
          entitySetName: "activities",
          primaryIdAttribute: "activityid",
          primaryNameAttribute: "subject",
          fieldLogicalNames: ["activityid", "subject"],
          outboundRelationships: []
        }
      }
    } as TraversalGraph;

    const edge = {
      fromEntity: "careplan",
      toEntity: "activity",
      navigationPropertyName: "careplan_activities",
      relationshipType: "OneToMany",
      direction: "oneToMany",
      schemaName: "careplan_activity_exact",
      referencingAttribute: "careplanid"
    } as const;

    const step: TraversalExecutionStep = {
      stepNumber: 2,
      fromEntity: "careplan",
      toEntity: "activity",
      entities: ["careplan", "activity"],
      edges: [edge],
      hopCount: 1,
      stageLabel: "careplan → activity"
    };

    const itinerary: TraversalExecutionPlan = {
      planId: "preferred:exact",
      label: "Detailed",
      rationale: "exact",
      preserveExactHops: true,
      steps: [step]
    };

    const requested: string[] = [];
    const context = createStubContext(logs, { value: [] });
    context.getClient = () => ({
      get: async (query: string) => {
        requested.push(query);
        if (query.includes("careplans(cp-2)/careplan_activities")) {
          return { value: [{ activityid: "act-2", subject: "Viable" }] };
        }
        return { value: [] };
      }
    }) as any;

    const originalShowResultViewerForQuery = resultViewerLauncher.showResultViewerForQuery;
    let viewerOptions: any;
    (resultViewerLauncher as unknown as { showResultViewerForQuery: (...args: unknown[]) => Promise<void> }).showResultViewerForQuery =
      async (_ctx: unknown, _result: unknown, _path: unknown, options: unknown) => {
        viewerOptions = options;
      };

    try {
      const result = await executeTraversalStep(
        context,
        graph,
        itinerary,
        step,
        {
          entityName: "careplan",
          ids: ["cp-1", "cp-2", "cp-3"]
        },
        4
      );

      assert.deepStrictEqual(result.landing.ids, ["act-2"]);
      assert.strictEqual(result.executionPlan.usedFallback, false);
      assert.ok(result.executionPlan.rationale.some((line) => /exact-hop execution/i.test(line)));
      assert.strictEqual(result.executedQueryCount, 3);
      assert.deepStrictEqual(requested, [
        "/careplans(cp-1)/careplan_activities?$select=activityid,subject&$top=5",
        "/careplans(cp-2)/careplan_activities?$select=activityid,subject&$top=5",
        "/careplans(cp-3)/careplan_activities?$select=activityid,subject&$top=5"
      ]);
      assert.deepStrictEqual(viewerOptions?.landedEntity, {
        entitySetName: "activities",
        logicalName: "activity",
        primaryIdAttribute: "activityid"
      });
    } finally {
      (resultViewerLauncher as unknown as { showResultViewerForQuery: typeof originalShowResultViewerForQuery }).showResultViewerForQuery = originalShowResultViewerForQuery;
    }
  });

  test("keeps multiple landed rows in bounded continuation scope", () => {
    const graph = {
      entities: {
        careplan: {
          logicalName: "careplan",
          entitySetName: "careplans",
          primaryIdAttribute: "careplanid",
          fieldLogicalNames: ["careplanid"],
          outboundRelationships: []
        },
        activity: {
          logicalName: "activity",
          entitySetName: "activities",
          primaryIdAttribute: "activityid",
          fieldLogicalNames: ["activityid"],
          outboundRelationships: []
        }
      }
    } as any;
    const edge = {
      fromEntity: "careplan",
      toEntity: "activity",
      navigationPropertyName: "careplan_activities",
      relationshipType: "OneToMany",
      direction: "oneToMany",
      referencingAttribute: "careplanid"
    } as any;
    const step = {
      stepNumber: 2,
      fromEntity: "careplan",
      toEntity: "activity",
      entities: ["careplan", "activity"],
      edges: [edge],
      hopCount: 1,
      stageLabel: "careplan → activity"
    } as any;
    const itinerary = { planId: "plan", label: "Detailed", rationale: "test", steps: [step] } as any;

    const plan = buildStepExecutionPlan(graph, itinerary, step, {
      entityName: "careplan",
      ids: ["cp-1", "cp-2", "cp-3"]
    });

    assert.strictEqual(plan.mode, "direct");
    assert.match(plan.queries[0]!.queryPath, /careplanid eq 'cp-1'/);
    assert.match(plan.queries[0]!.queryPath, /careplanid eq 'cp-2'/);
    assert.match(plan.queries[0]!.queryPath, /careplanid eq 'cp-3'/);
    assert.match(plan.queries[0]!.queryPath, /\$expand=careplan_activities/);
  });

});
