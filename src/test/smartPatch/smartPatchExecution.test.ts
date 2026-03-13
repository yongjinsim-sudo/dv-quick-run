import * as assert from "assert";
import { executeSmartPatchWithDeps } from "../../commands/router/actions/smartPatch/smartPatchExecution.js";
import type { SmartPatchState } from "../../commands/router/actions/smartPatch/smartPatchTypes.js";

suite("smartPatchExecution", () => {
  test("saves state, executes patch, and emits safe logging summaries", async () => {
    const infoLogs: string[] = [];
    const debugLogs: string[] = [];
    const shown: Array<{ name: string; data: any }> = [];
    let saved = 0;
    let patched = 0;

    const state: SmartPatchState = {
      entityLogicalName: "contact",
      entitySetName: "contacts",
      id: "id-1",
      fields: [{ logicalName: "firstname", attributeType: "String", rawValue: "Alice" }],
      ifMatch: "*"
    };

    const client = {
      patch: async (path: string, token: string, body: any, ifMatch?: string) => {
        patched++;
        assert.strictEqual(path, "contacts(id-1)");
        assert.strictEqual(token, "token-1");
        assert.deepStrictEqual(body, { firstname: "Alice" });
        assert.strictEqual(ifMatch, "*");
        return { ok: true };
      }
    } as any;

    await executeSmartPatchWithDeps({ output: {} } as any, client, "token-1", state, {
      buildPath: () => "contacts(id-1)",
      buildBody: () => ({ firstname: "Alice" }),
      saveState: async () => { saved++; },
      logInfoMessage: (_output, message) => { infoLogs.push(message); },
      logDebugMessage: (_output, message) => { debugLogs.push(message); },
      showJson: async (name, data) => { shown.push({ name, data }); }
    });

    assert.strictEqual(saved, 1);
    assert.strictEqual(patched, 1);
    assert.deepStrictEqual(infoLogs, ["Smart PATCH: entity=contacts fields=1"]);
    assert.ok(debugLogs.includes("PATCH contacts(id-1)"));
    assert.ok(debugLogs.includes("Payload fields: firstname"));
    assert.ok(!infoLogs.join(" ").includes("Alice"));
    assert.ok(!debugLogs.join(" ").includes("\"Alice\""));
    assert.strictEqual(shown[0].name, "DVQR_PATCH_contacts_id-1");
    assert.deepStrictEqual(shown[0].data.payload, { firstname: "Alice" });
  });
});
