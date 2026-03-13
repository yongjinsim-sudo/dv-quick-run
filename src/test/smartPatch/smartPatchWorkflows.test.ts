import * as assert from "assert";
import {
  runSmartPatchWorkflowWithDeps,
  runSmartPatchRerunLastWorkflowWithDeps,
  runSmartPatchEditLastWorkflowWithDeps
} from "../../commands/router/actions/smartPatch/smartPatchWorkflows.js";
import type { SmartField, SmartPatchState } from "../../commands/router/actions/smartPatch/smartPatchTypes.js";

const state: SmartPatchState = {
  entityLogicalName: "contact",
  entitySetName: "contacts",
  id: "00000000-0000-0000-0000-000000000000",
  fields: [{ logicalName: "firstname", attributeType: "String", rawValue: "John" }],
  ifMatch: "*"
};
const fields: SmartField[] = [{ logicalName: "firstname", attributeType: "String", isValidForRead: true }];

function passthroughRunAction(_ctx: any, _message: string, action: () => Promise<void>) {
  return action();
}

suite("smartPatchWorkflows", () => {
  test("main workflow executes reviewed patch state", async () => {
    let executed = 0;
    await runSmartPatchWorkflowWithDeps({} as any, {
      runActionWrapper: passthroughRunAction as any,
      initContext: async () => ({ token: "t", client: {} as any, baseUrl: "https://x", session: {} as any }),
      buildInitialState: async () => ({ state, fields }),
      reviewLoop: async () => ({ state, fields }),
      executePatch: async (_ctx: any, _client: any, _token: string, s: SmartPatchState) => {
        executed++;
        assert.deepStrictEqual(s, state);
      },
      loadLastState: () => undefined,
      showInformationMessage: async () => undefined
    });

    assert.strictEqual(executed, 1);
  });

  test("rerun last shows info when no saved state exists", async () => {
    const messages: string[] = [];
    let executed = 0;
    await runSmartPatchRerunLastWorkflowWithDeps({} as any, {
      runActionWrapper: passthroughRunAction as any,
      initContext: async () => ({ token: "t", client: {} as any, baseUrl: "https://x", session: {} as any }),
      buildInitialState: async () => undefined,
      reviewLoop: async () => undefined,
      executePatch: async () => { executed++; },
      loadLastState: () => undefined,
      showInformationMessage: async (message: string) => { messages.push(message); return undefined; }
    });

    assert.strictEqual(executed, 0);
    assert.strictEqual(messages.length, 1);
  });

  test("rerun last executes saved state", async () => {
    let executed = 0;
    await runSmartPatchRerunLastWorkflowWithDeps({} as any, {
      runActionWrapper: passthroughRunAction as any,
      initContext: async () => ({ token: "t", client: {} as any, baseUrl: "https://x", session: {} as any }),
      buildInitialState: async () => undefined,
      reviewLoop: async () => undefined,
      executePatch: async (_ctx: any, _client: any, _token: string, s: SmartPatchState) => {
        executed++;
        assert.strictEqual(s.id, state.id);
      },
      loadLastState: () => state,
      showInformationMessage: async () => undefined
    });

    assert.strictEqual(executed, 1);
  });

  test("edit last exits cleanly when review is cancelled", async () => {
    let executed = 0;
    await runSmartPatchEditLastWorkflowWithDeps({} as any, {
      runActionWrapper: passthroughRunAction as any,
      initContext: async () => ({ token: "t", client: {} as any, baseUrl: "https://x", session: {} as any }),
      buildInitialState: async () => ({ state, fields }),
      reviewLoop: async () => undefined,
      executePatch: async () => { executed++; },
      loadLastState: () => state,
      showInformationMessage: async () => undefined
    });

    assert.strictEqual(executed, 0);
  });
});
