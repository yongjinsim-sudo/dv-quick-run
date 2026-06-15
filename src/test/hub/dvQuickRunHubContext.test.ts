import * as assert from "assert";
import { capabilities } from "../../commands/hub/dvQuickRunHubContent.js";
import { applyCapabilityContextStates, buildInvestigationContinuationModel } from "../../commands/hub/dvQuickRunHubContext.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";

suite("dvQuickRunHubContext", () => {
  const emptyContext: InvestigationContext = {
    id: "test-context",
    source: "unknown",
    lastUpdatedUtc: "2026-05-11T00:00:00.000Z"
  };

  test("marks only self-contained workflows as launchable without context", () => {
    const enriched = applyCapabilityContextStates(capabilities, emptyContext);
    const launchable = enriched.filter((capability) => capability.contextState?.launchable).map((capability) => capability.id);

    assert.deepStrictEqual(launchable, ["guided-traversal", "capability-explorer", "cross-environment-comparison", "community-feedback", "community-discussions"]);
    assert.strictEqual(enriched.find((capability) => capability.id === "explain-query-doctor")?.contextState?.kind, "requiresContext");
    assert.strictEqual(enriched.find((capability) => capability.id === "batch-workflows")?.contextState?.kind, "requiresContext");
  });


  test("surfaces comparison workflow as a Pro Preview entry point", () => {
    const enriched = applyCapabilityContextStates(capabilities, emptyContext);
    const comparison = enriched.find((capability) => capability.id === "cross-environment-comparison");

    assert.strictEqual(comparison?.status, "preview");
    assert.strictEqual(comparison?.contextState?.kind, "launchable");
    assert.strictEqual(comparison?.contextState?.label, "Pro Preview");
    assert.strictEqual(comparison?.contextState?.launchable, true);
    assert.strictEqual(comparison?.commandId, "dvQuickRun.openSnapshotLibrary");
  });

  test("surfaces active query context without making context-dependent workflows directly launchable", () => {
    const enriched = applyCapabilityContextStates(capabilities, {
      ...emptyContext,
      source: "resultViewer",
      currentQuery: {
        queryText: "contacts?$top=5",
        queryType: "odata"
      }
    });

    const explain = enriched.find((capability) => capability.id === "explain-query-doctor");

    assert.strictEqual(explain?.contextState?.kind, "availableInContext");
    assert.strictEqual(explain?.contextState?.launchable, false);
  });

  test("builds a bounded continuation model from available context", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      environmentName: "SIT",
      currentEntity: {
        logicalName: "account",
        displayName: "Account"
      },
      currentQuery: {
        queryType: "odata"
      },
      traversal: {
        sourceEntity: "account",
        targetEntity: "contact"
      }
    });

    assert.strictEqual(continuation.hasContext, true);
    assert.strictEqual(continuation.title, "Continue Investigation");
    assert.ok(continuation.summary.includes("Environment: SIT"));
    assert.ok(continuation.items.some((item) => item.label === "Traversal" && item.value === "account → contact"));
    assert.ok(continuation.items.some((item) => item.label === "Last surface" && item.value === "unknown") === false);
    assert.ok(continuation.actions.some((action) => action.label === "Continue from query context"));
    const entityAction = continuation.actions.find((action) => action.label === "Continue from entity context");
    assert.ok(entityAction);
    assert.strictEqual(entityAction.commandId, "dvQuickRun.openOperationalProfileSurface");
    assert.deepStrictEqual(entityAction.commandArgs, ["account"]);
    assert.strictEqual(entityAction.actionLabel, "Open Operational Profile");

    const exportAction = continuation.actions.find((action) => action.label === "Export entity context");
    assert.ok(exportAction);
    assert.strictEqual(exportAction.commandId, "dvQuickRun.exportOperationalProfileSnapshot");
    assert.deepStrictEqual(exportAction.commandArgs, ["account"]);
    assert.strictEqual(exportAction.actionLabel, "Export Profile Snapshot");

    const traversalAction = continuation.actions.find((action) => action.label === "Continue traversal investigation");
    assert.ok(traversalAction);
    assert.strictEqual(traversalAction.commandId, "dvQuickRun.findPathToTable");
    assert.strictEqual(traversalAction.actionLabel, "Start Guided Traversal");
    assert.ok(continuation.timeline.some((step) => step.label === "Editor Query"));
    assert.ok(continuation.timeline.some((step) => step.label === "Guided Traversal"));
  });



  test("surfaces Custom API execution as continuation context", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "capabilityExplorer",
      environmentName: "DEV",
      capabilityExecution: {
        kind: "customApiExecution",
        operationUniqueName: "new_CalculateScore",
        operationDisplayName: "Calculate Score",
        operationKind: "Function",
        bindingKind: "Unbound",
        status: "completed",
        method: "GET",
        statusCode: 200
      },
      runtime: {
        requestId: "request-1",
        correlationId: "correlation-1"
      }
    });

    assert.strictEqual(continuation.hasContext, true);
    assert.ok(continuation.items.some((item) => item.label === "Capability execution" && item.value === "Calculate Score"));
    assert.ok(continuation.items.some((item) => item.label === "Capability HTTP status" && item.value === "200"));
    assert.ok(continuation.actions.some((action) => action.label === "Continue from capability execution"));
    assert.ok(continuation.timeline.some((step) => step.label === "Capability Execution"));
  });

  test("shows recoverable closed Result Viewer state", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: false,
        recoverable: true
      }
    });

    assert.ok(continuation.items.some((item) => item.label === "Result Viewer status"));
    const recoveryAction = continuation.actions.find((action) => action.label === "Recover investigation surface");
    assert.ok(recoveryAction);
    assert.strictEqual(recoveryAction.commandId, "dvQuickRun.reopenLastResultViewer");
    assert.strictEqual(recoveryAction.actionLabel, "Reopen last Result Viewer");
  });


  test("does not show recovery action when Result Viewer is open", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: true,
        recoverable: true
      }
    });

    assert.ok(continuation.items.some((item) => item.label === "Result Viewer status" && item.value === "Open"));
    assert.ok(!continuation.actions.some((action) => action.label === "Recover investigation surface"));
  });


  test("shows open Result Viewer state without recovery action", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: true,
        recoverable: true
      }
    });

    assert.ok(continuation.items.some((item) => item.label === "Result Viewer status" && item.value === "Open"));
    assert.ok(!continuation.actions.some((action) => action.label === "Recover investigation surface"));
  });

  test("shows expired Result Viewer state without reopen action", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: false,
        recoverable: false,
        expired: true,
        staleReason: "the environment changed"
      }
    });

    assert.ok(continuation.items.some((item) => item.label === "Result Viewer status" && item.value.includes("expired")));
    assert.ok(!continuation.actions.some((action) => action.commandId === "dvQuickRun.reopenLastResultViewer"));
    const restoreAction = continuation.actions.find((action) => action.label === "Restore live investigation context");
    assert.ok(restoreAction);
    assert.strictEqual(restoreAction.actionLabel, "Re-run query to restore live context");
  });


  test("classifies open Result Viewer context as active", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: true,
        recoverable: true
      }
    });

    assert.strictEqual(continuation.trustState.kind, "active");
    assert.strictEqual(continuation.trustState.label, "Active context");
  });

  test("classifies closed recoverable Result Viewer context as recoverable", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: false,
        recoverable: true
      }
    });

    assert.strictEqual(continuation.trustState.kind, "recoverable");
  });

  test("classifies expired Result Viewer context as stale", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentEntity: {
        logicalName: "contact"
      },
      surfaceState: {
        resultViewerOpen: false,
        recoverable: false,
        expired: true,
        staleReason: "the environment changed"
      }
    });

    assert.strictEqual(continuation.trustState.kind, "stale");
  });

  test("uses a safe empty continuation model without context", () => {
    const continuation = buildInvestigationContinuationModel(emptyContext);

    assert.strictEqual(continuation.hasContext, false);
    assert.strictEqual(continuation.title, "No active investigation context");
    assert.strictEqual(continuation.items.length, 0);
    assert.strictEqual(continuation.actions.length, 0);
    assert.strictEqual(continuation.timeline.length, 0);
    assert.strictEqual(continuation.trustState.kind, "empty");
  });

  test("adds bounded runtime continuation actions when runtime evidence exists", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "executionInsights",
      runtime: {
        correlationId: "corr-123",
        providerIds: ["pluginTrace", "asyncoperation"]
      }
    });

    assert.strictEqual(continuation.hasContext, true);
    assert.ok(continuation.items.some((item) => item.label === "Last surface" && item.value === "executionInsights"));
    assert.ok(continuation.actions.some((action) => action.label === "Continue runtime evidence review"));
  });
  test("does not expose executable query actions from the Hub without active editor ownership", () => {
    const continuation = buildInvestigationContinuationModel({
      ...emptyContext,
      source: "resultViewer",
      currentQuery: {
        queryText: "contacts?$top=5",
        queryType: "odata"
      }
    });

    const queryAction = continuation.actions.find((action) => action.label === "Continue from query context");

    assert.ok(queryAction);
    assert.strictEqual(queryAction.commandId, undefined);
    assert.strictEqual(queryAction.actionLabel, undefined);
  });

});

suite("dvQuickRunHubContext batch selection", () => {
  const baseContext: InvestigationContext = {
    id: "batch-context",
    source: "resultViewer",
    environmentName: "SIT",
    currentQuery: {
      queryType: "batch",
      queryText: "GET /contacts\nGET /accounts"
    },
    currentEntity: {
      logicalName: "contact",
      displayName: "Contact"
    },
    batch: {
      activeItemKey: "accounts",
      activeLabel: "accounts (11)",
      activeEntityLogicalName: "account",
      activeEntityDisplayName: "Account",
      activeRowCount: 11,
      totalItems: 2
    },
    lastUpdatedUtc: "2026-05-11T00:00:00.000Z"
  };

  test("prefers the selected batch result as the active entity context", () => {
    const continuation = buildInvestigationContinuationModel(baseContext);

    assert.ok(continuation.summary.includes("Selected batch: accounts (11)"));
    assert.ok(continuation.items.some((item) => item.label === "Entity" && item.value === "Account"));
    assert.ok(continuation.items.some((item) => item.label === "Selected batch result" && item.value === "accounts (11)"));
    assert.ok(continuation.items.some((item) => item.label === "Selected batch rows" && item.value === "11"));
  });

  test("uses selected batch entity for profile continuation and export actions", () => {
    const continuation = buildInvestigationContinuationModel(baseContext);
    const profileAction = continuation.actions.find((action) => action.label === "Continue from entity context");
    const exportAction = continuation.actions.find((action) => action.label === "Export entity context");

    assert.deepStrictEqual(profileAction?.commandArgs, ["account"]);
    assert.ok(profileAction?.detail.includes("accounts (11)"));
    assert.deepStrictEqual(exportAction?.commandArgs, ["account"]);
    assert.ok(exportAction?.detail.includes("accounts (11)"));
    assert.ok(continuation.timeline.some((step) => step.label === "Selected batch result" && step.detail.includes("accounts (11)")));
  });
});
