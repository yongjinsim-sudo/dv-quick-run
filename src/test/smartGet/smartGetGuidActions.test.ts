import * as assert from "assert";
import {
  runSmartGetFromGuidPickFieldsWorkflowWithDeps,
  runSmartGetFromGuidRawWorkflowWithDeps
} from "../../commands/router/actions/smartGet/smartGetGuidActions.js";
import type { SmartField } from "../../commands/router/actions/smartGet/smartGetTypes.js";

const entityDef = { logicalName: "contact", entitySetName: "contacts" } as any;
const smartFields: SmartField[] = [
  { logicalName: "fullname", attributeType: "String", selectToken: "fullname" },
  { logicalName: "createdon", attributeType: "DateTime" }
];

suite("smartGetGuidActions", () => {
  test("guid raw executes against selected entity", async () => {
    let executed: any[] = [];
    await runSmartGetFromGuidRawWorkflowWithDeps({} as any, {
      getGuid: () => "123",
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      pickEntity: async () => entityDef,
      getSmartFields: async () => smartFields,
      pickFields: async () => smartFields,
      executeRaw: async (_ctx, _client, _token, entitySetName, guid) => { executed.push([entitySetName, guid]); },
      executePickFields: async () => undefined,
      showWarning: async () => undefined
    });

    assert.deepStrictEqual(executed, [["contacts", "123"]]);
  });

  test("guid pick fields warns when no selectable fields were chosen", async () => {
    const warnings: string[] = [];
    let executed = 0;
    await runSmartGetFromGuidPickFieldsWorkflowWithDeps({} as any, {
      getGuid: () => "123",
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      pickEntity: async () => entityDef,
      getSmartFields: async () => smartFields,
      pickFields: async () => [{ logicalName: "createdon", attributeType: "DateTime" } as SmartField],
      executeRaw: async () => undefined,
      executePickFields: async () => { executed++; },
      showWarning: async (message) => { warnings.push(message); return undefined; }
    });

    assert.strictEqual(executed, 0);
    assert.strictEqual(warnings[0], "DV Quick Run: None of the selected fields are selectable via $select.");
  });

  test("guid pick fields executes with select tokens", async () => {
    let got: any[] = [];
    await runSmartGetFromGuidPickFieldsWorkflowWithDeps({} as any, {
      getGuid: () => "123",
      initContext: async () => ({ token: "t", client: {} as any, session: {} as any }),
      pickEntity: async () => entityDef,
      getSmartFields: async () => smartFields,
      pickFields: async () => smartFields,
      executeRaw: async () => undefined,
      executePickFields: async (_ctx, _client, _token, entitySetName, guid, selectTokens) => {
        got = [entitySetName, guid, selectTokens];
      },
      showWarning: async () => undefined
    });

    assert.deepStrictEqual(got, ["contacts", "123", ["fullname"]]);
  });
});
