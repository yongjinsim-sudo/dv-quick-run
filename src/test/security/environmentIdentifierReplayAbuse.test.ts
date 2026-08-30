import * as assert from "assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";
import { buildPreferredBusinessPathRuntimeArgs } from "../../mcp/mcpBusinessPathRuntimeReuse.js";
import { McpBusinessPathPromotionAuthorizationStore } from "../../mcp/mcpBusinessPathPromotionAuthorizationStore.js";
import type { AdversarialCase } from "./adversarialCase.js";
import { runAdversarialCase } from "./adversarialHarness.js";

const activeConfig: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://test.crm.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 30000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

suite("Security adversarial environment, identifier and replay abuse", () => {
  test("A06 rejects a different valid Dataverse environment before provider execution", async () => {
    let providerCalls = 0;
    const freeAdapter = {
      executeOData: async () => {
        providerCalls += 1;
        return { ok: true, structuredContent: { value: [] } };
      }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(activeConfig, freeAdapter as any);
    const testCase: AdversarialCase<{ environmentUrl: string }> = {
      id: "A06-ENVIRONMENT-001",
      family: "A06",
      title: "Model-supplied environment cannot replace active canonical environment",
      input: { environmentUrl: "https://prod.crm.dynamics.com" },
      expectedOutcome: "Rejected",
      forbiddenEffects: ["ProviderCalled", "WrongEnvironmentCalled", "MutationCalled"],
      invariants: ["Active environment is canonical"]
    };

    await runAdversarialCase(testCase, async (input, effects) => {
      const response = await dispatcher.dispatch({
        name: "dvqr_execute_odata",
        arguments: { query: "contacts?$select=contactid&$top=1", maxRecords: 1, environmentUrl: input.environmentUrl }
      });
      if (providerCalls > 0) effects.record("ProviderCalled");
      assert.strictEqual(response.isError, true);
      assert.strictEqual((response.structuredContent as any).code, "EnvironmentAuthorityMismatch");
      assert.match(response.content[0].text, /cannot override the active canonical MCP environment/i);
      return { outcome: "Rejected" };
    });
    assert.strictEqual(providerCalls, 0);
  });

  test("A06 permits an explicitly supplied environment only when it matches active canonical state", async () => {
    let providerCalls = 0;
    const freeAdapter = {
      executeOData: async (args: Record<string, unknown>) => {
        providerCalls += 1;
        assert.strictEqual(args.environmentUrl, "https://test.crm.dynamics.com/");
        return { ok: true, structuredContent: { value: [] } };
      }
    };
    const dispatcher = new DvqrMcpLiveToolDispatcher(activeConfig, freeAdapter as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: {
        query: "contacts?$select=contactid&$top=1",
        maxRecords: 1,
        environmentUrl: "https://test.crm.dynamics.com/"
      }
    });
    assert.strictEqual(response.isError, undefined);
    assert.strictEqual(providerCalls, 1);
  });

  test("A06/A08 rejects replay of a DEV environment argument after canonical context changes to TEST", async () => {
    let providerCalls = 0;
    const dispatcher = new DvqrMcpLiveToolDispatcher(activeConfig, {
      executeOData: async () => {
        providerCalls += 1;
        return { ok: true, structuredContent: { value: [] } };
      }
    } as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: {
        query: "contacts?$select=contactid&$top=1",
        environmentUrl: "https://dev.crm.dynamics.com"
      }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "EnvironmentAuthorityMismatch");
    assert.strictEqual(providerCalls, 0);
  });

  test("A07 rejects delimiter, URL and query-shaped record identifiers before application execution", async () => {
    let runtimeCalls = 0;
    const dispatcher = new DvqrMcpLiveToolDispatcher(activeConfig, {
      testBusinessPath: async () => {
        runtimeCalls += 1;
        return { ok: true, structuredContent: {} };
      }
    } as any);

    for (const sourceRecordId of [
      "00000000-0000-0000-0000-000000000001?$select=fullname",
      "https://test.crm.dynamics.com/api/data/v9.2/contacts(00000000-0000-0000-0000-000000000001)",
      "00000000-0000-0000-0000-000000000001%2Faccounts",
      "00000000-0000-0000-0000-000000000001#fragment"
    ]) {
      const response = await dispatcher.dispatch({
        name: "dvqr_test_business_path",
        arguments: { pathId: "bp_2f4d19cc", sourceRecordId }
      });
      assert.strictEqual(response.isError, true, sourceRecordId);
      assert.strictEqual((response.structuredContent as any).code, "InvalidArguments", sourceRecordId);
    }
    assert.strictEqual(runtimeCalls, 0);
  });

  test("A07 rejects logical-name injection before relationship/traversal execution", async () => {
    let discoveryCalls = 0;
    const dispatcher = new DvqrMcpLiveToolDispatcher(activeConfig, {
      findRelationshipPaths: async () => {
        discoveryCalls += 1;
        return { ok: true, structuredContent: {} };
      }
    } as any);
    const response = await dispatcher.dispatch({
      name: "dvqr_find_relationship_paths",
      arguments: { sourceTable: "contact?$filter=statecode eq 0", targetTable: "account" }
    });
    assert.strictEqual(response.isError, true);
    assert.strictEqual((response.structuredContent as any).code, "InvalidArguments");
    assert.strictEqual(discoveryCalls, 0);
  });

  test("A07 rejects a syntactically valid saved-path identity when revalidation belongs to another path", () => {
    assert.throws(
      () => buildPreferredBusinessPathRuntimeArgs({
        sourceRecordId: "00000000-0000-0000-0000-000000000001",
        artifact: {
          id: "bp_11111111",
          schemaVersion: "dvqr-business-path-v1",
          name: "Contact to Account",
          sourceTable: "contact",
          targetTable: "account",
          state: "preferred",
          hops: []
        } as any,
        revalidation: {
          pathId: "bp_22222222",
          state: "valid",
          historicallyVerifiedInActiveEnvironment: false
        } as any
      }),
      /revalidation result does not belong to the requested saved path/i
    );
  });

  test("A08 consumed promotion authority cannot be replayed", () => {
    const store = new McpBusinessPathPromotionAuthorizationStore(60_000, {
      nowMs: () => 1_000,
      nowIso: () => "2026-08-26T00:00:01.000Z"
    }, () => "bpa_replay_test");
    const authorization = store.issue({
      sourceTable: "contact",
      targetTable: "account",
      sourceRecordId: "00000000-0000-0000-0000-000000000001",
      environmentIdentity: "test.crm.dynamics.com",
      pathId: "contact:relationship:account",
      tables: ["contact", "account"],
      relationshipSchemaNames: ["contact_accounts"],
      hops: [],
      observedTargetRows: 1
    });
    assert.ok(store.get(authorization.authorizationId));
    store.consume(authorization.authorizationId);
    assert.strictEqual(store.get(authorization.authorizationId), undefined);
  });

  test("A08 expired promotion authority is pruned and cannot become current authority again", () => {
    let now = 1_000;
    const store = new McpBusinessPathPromotionAuthorizationStore(100, {
      nowMs: () => now,
      nowIso: () => new Date(now).toISOString()
    }, () => "bpa_expired_test");
    const authorization = store.issue({
      sourceTable: "contact",
      targetTable: "account",
      sourceRecordId: "00000000-0000-0000-0000-000000000001",
      environmentIdentity: "test.crm.dynamics.com",
      pathId: "contact:relationship:account",
      tables: ["contact", "account"],
      relationshipSchemaNames: ["contact_accounts"],
      hops: [],
      observedTargetRows: 1
    });
    assert.ok(store.get(authorization.authorizationId));
    now = 1_101;
    assert.strictEqual(store.get(authorization.authorizationId), undefined);
  });
});
