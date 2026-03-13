import * as assert from "assert";
import {
  runSmartGetMainWorkflowWithDeps,
  rerunSmartGetLastWorkflowWithDeps,
  editSmartGetLastWorkflowWithDeps
} from "../../commands/router/actions/smartGet/smartGetWorkflows.js";
import type { SmartField, SmartGetState } from "../../commands/router/actions/smartGet/smartGetTypes.js";

const state: SmartGetState = {
  entityLogicalName: "contact",
  entitySetName: "contacts",
  selectedFieldLogicalNames: ["fullname"],
  top: 10
};
const fields: SmartField[] = [{ logicalName: "fullname", attributeType: "String", selectToken: "fullname" }];

suite("smartGetWorkflows", () => {
  test("main workflow executes reviewed state", async () => {
    let executed = 0;
    const ctx = {} as any;
    const deps = {
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      buildState: async () => ({ state, fields }),
      reviewLoop: async () => ({ state, fields }),
      executeState: async (_ctx: any, _client: any, _token: string, s: SmartGetState, f: SmartField[]) => {
        executed++;
        assert.deepStrictEqual(s, state);
        assert.deepStrictEqual(f, fields);
      },
      loadLastState: () => undefined,
      getGuidFields: async () => fields
    };

    await runSmartGetMainWorkflowWithDeps(ctx, deps);
    assert.strictEqual(executed, 1);
  });

  test("main workflow exits when build is cancelled", async () => {
    let reviewed = 0;
    let executed = 0;
    await runSmartGetMainWorkflowWithDeps({} as any, {
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      buildState: async () => undefined,
      reviewLoop: async () => { reviewed++; return undefined; },
      executeState: async () => { executed++; },
      loadLastState: () => undefined,
      getGuidFields: async () => fields
    });

    assert.strictEqual(reviewed, 0);
    assert.strictEqual(executed, 0);
  });

  test("rerun last returns false when no saved state exists", async () => {
    const result = await rerunSmartGetLastWorkflowWithDeps({} as any, {
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      buildState: async () => undefined,
      reviewLoop: async () => undefined,
      executeState: async () => undefined,
      loadLastState: () => undefined,
      getGuidFields: async () => fields
    });

    assert.strictEqual(result, false);
  });

  test("rerun last executes saved state with resolved fields", async () => {
    let gotEntity = "";
    let executed = 0;
    const result = await rerunSmartGetLastWorkflowWithDeps({} as any, {
      initContext: async () => ({ token: "t", client: {} as any, session: { name: "session" } as any }),
      buildState: async () => undefined,
      reviewLoop: async () => undefined,
      executeState: async (_ctx: any, _client: any, _token: string, s: SmartGetState, f: SmartField[]) => {
        executed++;
        assert.strictEqual(s.entityLogicalName, "contact");
        assert.deepStrictEqual(f, fields);
      },
      loadLastState: () => state,
      getGuidFields: async (_session: any, entityLogicalName: string) => {
        gotEntity = entityLogicalName;
        return fields;
      }
    });

    assert.strictEqual(result, true);
    assert.strictEqual(gotEntity, "contact");
    assert.strictEqual(executed, 1);
  });

  test("edit last returns true and skips execute when review is cancelled", async () => {
    let executed = 0;
    const result = await editSmartGetLastWorkflowWithDeps({} as any, {
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      buildState: async () => undefined,
      reviewLoop: async () => undefined,
      executeState: async () => { executed++; },
      loadLastState: () => state,
      getGuidFields: async () => fields
    });

    assert.strictEqual(result, true);
    assert.strictEqual(executed, 0);
  });
});
