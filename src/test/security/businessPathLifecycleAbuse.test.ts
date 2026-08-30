import * as assert from "node:assert";
import { DvqrMcpLiveToolDispatcher } from "../../mcp/mcpLiveToolDispatcher.js";
import type { DvqrMcpRuntimeConfiguration } from "../../mcp/mcpRuntimeConfiguration.js";

const config: DvqrMcpRuntimeConfiguration = {
  environmentUrl: "https://example.crm.dynamics.com",
  proEnabled: false,
  requestTimeoutMs: 1000,
  emitTextMirror: false,
  textMirrorMaxCharacters: 32768
};

function response(structuredContent: Record<string, unknown>) {
  return {
    content: [{ type: "text", text: "test" }],
    structuredContent
  } as any;
}

suite("Security adversarial Business Path lifecycle", () => {
  test("A16 empty-frontier STOP blocks alternative runtime tools until explicit new scope", async () => {
    const dispatcher = new DvqrMcpLiveToolDispatcher(config);
    let alternativeExecutions = 0;
    let scopeTransitions = 0;

    const handlers = (dispatcher as any).freeHandlers;
    handlers.testBusinessPath = async () => response({
      scopeBoundary: {
        outcome: "TerminatedAtBoundedFrontier",
        exactPathOnly: true,
        operationTerminated: true,
        automaticBroadeningAllowed: false
      }
    });
    handlers.executeOData = async () => {
      alternativeExecutions += 1;
      return response({ value: [] });
    };
    handlers.probeRelationshipPath = async () => {
      alternativeExecutions += 1;
      return response({ paths: [] });
    };
    handlers.discoverBusinessPaths = async () => {
      alternativeExecutions += 1;
      return response({ paths: [] });
    };
    handlers.startNewBusinessPathScope = async () => {
      scopeTransitions += 1;
      return response({ started: true });
    };

    const exact = await dispatcher.dispatch({
      name: "dvqr_test_business_path",
      arguments: {
        pathId: "bp_deadbeef",
        sourceRecordId: "00000000-0000-0000-0000-000000000001",
        environmentUrl: "https://example.crm.dynamics.com"
      }
    });
    assert.strictEqual(exact.isError, undefined);

    for (const call of [
      {
        name: "dvqr_execute_odata",
        arguments: {
          query: "accounts?$top=1",
          environmentUrl: "https://example.crm.dynamics.com"
        }
      },
      {
        name: "dvqr_probe_relationship_path",
        arguments: {
          sourceTable: "contact",
          targetTable: "account",
          sourceRecordId: "00000000-0000-0000-0000-000000000001",
          environmentUrl: "https://example.crm.dynamics.com"
        }
      },
      {
        name: "dvqr_discover_business_paths",
        arguments: {
          sourceTable: "contact",
          targetTable: "account",
          environmentUrl: "https://example.crm.dynamics.com"
        }
      }
    ]) {
      const blocked = await dispatcher.dispatch(call as any);
      assert.strictEqual(blocked.isError, true, call.name);
      assert.strictEqual((blocked.structuredContent as any).code, "BusinessPathScopeTerminated", call.name);
      assert.strictEqual((blocked.structuredContent as any).automaticBroadeningAllowed, false, call.name);
    }
    assert.strictEqual(alternativeExecutions, 0);

    const transition = await dispatcher.dispatch({ name: "dvqr_start_new_business_path_scope", arguments: {} });
    assert.strictEqual(transition.isError, undefined);
    assert.strictEqual(scopeTransitions, 1);

    const allowed = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: {
        query: "accounts?$top=1",
        environmentUrl: "https://example.crm.dynamics.com"
      }
    });
    assert.strictEqual(allowed.isError, undefined);
    assert.strictEqual(alternativeExecutions, 1);
  });

  test("A18 STOP guard is not established by access/error-like results without exact empty-frontier outcome", async () => {
    const dispatcher = new DvqrMcpLiveToolDispatcher(config);
    let executeCalls = 0;
    const handlers = (dispatcher as any).freeHandlers;
    handlers.testBusinessPath = async () => response({
      currentRuntimeObservation: {
        runtimeStatus: "AccessLimited",
        reachedTarget: false,
        observedTargetRows: null
      },
      scopeBoundary: {
        outcome: "Indeterminate",
        operationTerminated: true,
        automaticBroadeningAllowed: false
      }
    });
    handlers.executeOData = async () => {
      executeCalls += 1;
      return response({ value: [] });
    };

    await dispatcher.dispatch({
      name: "dvqr_test_business_path",
      arguments: {
        pathId: "bp_deadbeef",
        sourceRecordId: "00000000-0000-0000-0000-000000000001",
        environmentUrl: "https://example.crm.dynamics.com"
      }
    });

    const result = await dispatcher.dispatch({
      name: "dvqr_execute_odata",
      arguments: {
        query: "accounts?$top=1",
        environmentUrl: "https://example.crm.dynamics.com"
      }
    });
    assert.strictEqual(result.isError, undefined);
    assert.strictEqual(executeCalls, 1);
  });
});
