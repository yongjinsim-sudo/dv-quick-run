import * as assert from "assert";
import { runSmartPatchReviewLoopWithDeps } from "../../commands/router/actions/smartPatch/smartPatchReview.js";
import type { SmartField, SmartPatchState } from "../../commands/router/actions/smartPatch/smartPatchTypes.js";

const initial: SmartPatchState = {
  entityLogicalName: "contact",
  entitySetName: "contacts",
  id: "abc-123",
  fields: [{ logicalName: "firstname", attributeType: "String", rawValue: "Alice" }],
  ifMatch: "*"
};
const fields: SmartField[] = [
  { logicalName: "firstname", attributeType: "String", isValidForRead: true },
  { logicalName: "lastname", attributeType: "String", isValidForRead: true }
];

suite("smartPatchReview", () => {
  test("open in Run GET adds history entry and executes runGet", async () => {
    const history: string[] = [];
    const commands: string[] = [];

    const result = await runSmartPatchReviewLoopWithDeps({ ext: {} } as any, {} as any, "t", "https://x", {} as any, initial, fields, {
      showQuickPick: async () => ({ choice: { kind: "openInRunGet" } } as any),
      writeClipboard: async () => undefined,
      showInformationMessage: async () => undefined,
      executeCommand: (async (command: string) => { commands.push(command); return undefined; }) as any,
      addQueryHistory: async (_ext: any, query: string) => { history.push(query); },
      getDefs: async () => [],
      pickEntityDef: async () => undefined,
      promptId: async () => undefined,
      getFields: async () => [],
      pickFields: async () => undefined,
      promptValues: async () => undefined
    });

    assert.strictEqual(result, undefined);
    assert.deepStrictEqual(history, ["contacts(abc-123)"]);
    assert.deepStrictEqual(commands, ["dvQuickRun.runGet"]);
  });

  test("edit values updates current state and can then run", async () => {
    let calls = 0;
    const result = await runSmartPatchReviewLoopWithDeps({ ext: {} } as any, {} as any, "t", "https://x", {} as any, initial, fields, {
      showQuickPick: async () => {
        calls++;
        return calls === 1
          ? ({ choice: { kind: "editValues" } } as any)
          : ({ choice: { kind: "preview" } } as any);
      },
      writeClipboard: async () => undefined,
      showInformationMessage: async () => undefined,
      executeCommand: (async () => undefined) as any,
      addQueryHistory: async () => undefined,
      getDefs: async () => [],
      pickEntityDef: async () => undefined,
      promptId: async () => undefined,
      getFields: async () => [],
      pickFields: async () => undefined,
      promptValues: async () => [{ logicalName: "firstname", attributeType: "String", rawValue: "Bob" } as any]
    });
    assert.ok(result);
    assert.strictEqual(result!.state.fields[0].rawValue, "Bob");
  });
});
