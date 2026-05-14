import * as assert from "assert";
import { buildEntityInvestigationContext, buildQueryInvestigationContext } from "../../investigation/context/investigationContextBuilder.js";
import { formatInvestigationContextSummary } from "../../investigation/context/investigationContextFormatter.js";
import { InvestigationContextStore } from "../../investigation/context/investigationContextStore.js";

suite("investigationContextStore", () => {
  test("creates safe empty session-scoped context", () => {
    const store = new InvestigationContextStore(() => "2026-05-11T00:00:00.000Z");
    const context = store.getCurrent();

    assert.ok(context.id.startsWith("ctx-"));
    assert.strictEqual(context.source, "unknown");
    assert.strictEqual(context.lastUpdatedUtc, "2026-05-11T00:00:00.000Z");
  });

  test("updates query context and detects query type", () => {
    const store = new InvestigationContextStore(() => "initial");

    const updated = store.update(
      buildQueryInvestigationContext("contacts?$select=fullname&$top=5"),
      () => "updated"
    );

    assert.strictEqual(updated.source, "resultViewer");
    assert.strictEqual(updated.currentQuery?.queryType, "odata");
    assert.strictEqual(updated.currentQuery?.queryText, "contacts?$select=fullname&$top=5");
    assert.strictEqual(updated.lastUpdatedUtc, "updated");
  });

  test("updates entity context without dropping existing query context", () => {
    const store = new InvestigationContextStore(() => "initial");

    store.update(buildQueryInvestigationContext("<fetch><entity name=\"account\" /></fetch>"), () => "query");
    const updated = store.update(buildEntityInvestigationContext("account", "Account", "accountid"), () => "entity");

    assert.strictEqual(updated.currentQuery?.queryType, "fetchxml");
    assert.strictEqual(updated.currentEntity?.logicalName, "account");
    assert.strictEqual(updated.currentEntity?.displayName, "Account");
    assert.strictEqual(updated.currentEntity?.primaryIdAttribute, "accountid");
  });

  test("returns defensive copies", () => {
    const store = new InvestigationContextStore(() => "initial");
    const updated = store.update({ runtime: { providerIds: ["pluginTrace"] } }, () => "updated");
    updated.runtime?.providerIds?.push("asyncoperation");

    assert.deepStrictEqual(store.getCurrent().runtime?.providerIds, ["pluginTrace"]);
  });


  test("preserves capability execution context as investigation anchor", () => {
    const store = new InvestigationContextStore(() => "initial");
    const updated = store.update({
      source: "capabilityExplorer",
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
    }, () => "updated");

    assert.strictEqual(updated.source, "capabilityExplorer");
    assert.strictEqual(updated.capabilityExecution?.operationUniqueName, "new_CalculateScore");
    assert.strictEqual(updated.capabilityExecution?.status, "completed");
    assert.strictEqual(
      formatInvestigationContextSummary(updated),
      "Capability: new_CalculateScore • Correlation: correlation-1"
    );
  });

  test("notifies listeners when context changes", () => {
    const store = new InvestigationContextStore(() => "initial");
    const observed: string[] = [];

    const subscription = store.onDidChange((context) => {
      observed.push(context.currentEntity?.logicalName ?? "none");
    });

    store.update({ currentEntity: { logicalName: "contact" } }, () => "updated");
    subscription.dispose();
    store.update({ currentEntity: { logicalName: "account" } }, () => "ignored");

    assert.deepStrictEqual(observed, ["contact"]);
  });


  test("keeps final Result Viewer open state after replacement transition", () => {
    const store = new InvestigationContextStore(() => "initial");

    store.update({
      source: "resultViewer",
      surfaceState: {
        resultViewerOpen: true,
        recoverable: true
      }
    }, () => "open-1");

    store.update({
      source: "resultViewer",
      surfaceState: {
        resultViewerOpen: false,
        recoverable: true
      }
    }, () => "old-dispose");

    store.update({
      source: "resultViewer",
      surfaceState: {
        resultViewerOpen: true,
        recoverable: true
      }
    }, () => "open-2");

    assert.strictEqual(store.getCurrent().surfaceState?.resultViewerOpen, true);
  });

  test("formats a compact context summary", () => {
    const store = new InvestigationContextStore(() => "initial");
    const context = store.update({
      environmentName: "DEV",
      currentEntity: { logicalName: "contact" },
      currentQuery: { queryType: "odata" },
      runtime: { correlationId: "abc" }
    }, () => "updated");

    assert.strictEqual(
      formatInvestigationContextSummary(context),
      "Environment: DEV • Entity: contact • Query: odata • Correlation: abc"
    );
  });
});
