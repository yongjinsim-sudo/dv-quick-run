import * as assert from "assert";
import { buildResultViewerModel } from "../../services/resultViewModelBuilder.js";
import { resolveResultViewerActions } from "../../providers/resultViewerActions/registry.js";

suite("resultViewerActionEligibility", () => {
  test("primary id cell exposes record-level and helper actions", () => {
    const actions = resolveResultViewerActions({
      guid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "contactid",
      rawValue: "8129eec7-4414-4f11-8341-6045bdc42f8b"
    });

    assert.deepStrictEqual(actions.map((action) => action.id), [
      "investigate-record",
      "open-in-dataverse-ui",
      "copy-record-url",
      "preview-odata-filter"
    ]);
  });

  test("non-primary guid field does not expose record-level actions", () => {
    const actions = resolveResultViewerActions({
      guid: "",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "_ownerid_value",
      rawValue: "8129eec7-4414-4f11-8341-6045bdc42f8b"
    });

    assert.deepStrictEqual(actions.map((action) => action.id), [
      "preview-odata-filter"
    ]);
  });

  test("scalar string value exposes helper actions only", () => {
    const actions = resolveResultViewerActions({
      guid: "",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "fullname",
      rawValue: "Alice"
    });

    assert.deepStrictEqual(actions.map((action) => action.id), [
      "preview-odata-filter"
    ]);
  });

  test("empty value returns no actions", () => {
    const actions = resolveResultViewerActions({
      guid: "",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "fullname",
      rawValue: ""
    });

    assert.deepStrictEqual(actions, []);
  });

  test("system columns return no actions", () => {
    const actions = resolveResultViewerActions({
      guid: "",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "@odata.etag",
      rawValue: "W/\"123\""
    });

    assert.deepStrictEqual(actions, []);
  });

  test("guid detection is case-insensitive", () => {
    const actions = resolveResultViewerActions({
      guid: "8129EEC7-4414-4F11-8341-6045BDC42F8B",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "contactid",
      rawValue: "8129EEC7-4414-4F11-8341-6045BDC42F8B"
    });

    assert.ok(actions.some((action) => action.id === "investigate-record"));
    assert.ok(actions.some((action) => action.id === "open-in-dataverse-ui"));
  });

  test("model builder does not attach actions to arrays", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          tags: ["a", "b"]
        }
      ]
    }, "contacts?$select=tags", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    assert.strictEqual(model.rows[0]["tags"]?.actions, undefined);
  });

  test("model builder does not attach actions to multi-item object arrays", () => {
    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          contact_customer_accounts: [
            { fullname: "John" },
            { fullname: "Jane" }
          ]
        }
      ]
    }, "accounts?$expand=contact_customer_accounts($select=fullname)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    assert.strictEqual(model.rows[0]["contact_customer_accounts"]?.actions, undefined);
  });

  test("aliased flattened columns still resolve helper actions from source column identity", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          parentcustomerid_account: {
            accountnumber: "A100"
          }
        }
      ]
    }, "contacts?$expand=parentcustomerid_account($select=accountnumber)", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const actions = model.rows[0]["pa.accountnumber"]?.actions ?? [];

    assert.deepStrictEqual(actions.map((action) => action.id), [
    ]);

    actions.forEach((action) => {
      assert.strictEqual(action.payload.columnName, "parentcustomerid_account.accountnumber");
      assert.strictEqual(action.payload.rawValue, "A100");
    });
  });

  test("primary id cell in built model exposes record actions", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          fullname: "Alice"
        }
      ]
    }, "contacts?$select=contactid,fullname", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const actions = model.rows[0]["contactid"]?.actions ?? [];

    assert.ok(actions.some((action) => action.id === "investigate-record"));
    assert.ok(actions.some((action) => action.id === "open-in-dataverse-ui"));
    assert.ok(actions.some((action) => action.id === "copy-record-url"));
  });

  test("traversal row exposes continue action only when required carry field matches", () => {
    const actions = resolveResultViewerActions({
      columnName: "contactid",
      rawValue: "contact-1",
      traversal: {
        traversalSessionId: "session-1",
        legIndex: 0,
        hasNextLeg: true,
        nextLegEntityName: "task",
        requiredCarryField: "contactid",
        isFinalLeg: false
      }
    });

    assert.deepStrictEqual(actions.map((action) => action.id), [
      "continue-traversal"
    ]);

    assert.strictEqual(actions[0]?.placement, "primary");
    assert.strictEqual(actions[0]?.payload.traversalSessionId, "session-1");
    assert.strictEqual(actions[0]?.payload.traversalLegIndex, 0);
    assert.strictEqual(actions[0]?.payload.carryField, "contactid");
    assert.strictEqual(actions[0]?.payload.carryValue, "contact-1");
  });

  test("traversal row hides continue action when current column is not the required carry field", () => {
    const actions = resolveResultViewerActions({
      columnName: "fullname",
      rawValue: "Alice",
      traversal: {
        traversalSessionId: "session-1",
        legIndex: 0,
        hasNextLeg: true,
        nextLegEntityName: "task",
        requiredCarryField: "contactid",
        isFinalLeg: false
      }
    });

    assert.deepStrictEqual(actions, []);
  });

  test("traversal row hides continue action for final leg", () => {
    const actions = resolveResultViewerActions({
      columnName: "contactid",
      rawValue: "contact-1",
      traversal: {
        traversalSessionId: "session-1",
        legIndex: 1,
        hasNextLeg: false,
        nextLegEntityName: undefined,
        requiredCarryField: "contactid",
        isFinalLeg: true
      }
    });

    assert.deepStrictEqual(actions, []);
  });

  test("traversal row hides all standard record actions and shows continuation only", () => {
    const actions = resolveResultViewerActions({
      guid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid",
      queryMode: "odata",
      columnName: "contactid",
      rawValue: "8129eec7-4414-4f11-8341-6045bdc42f8b",
      traversal: {
        traversalSessionId: "session-1",
        legIndex: 0,
        hasNextLeg: true,
        nextLegEntityName: "task",
        requiredCarryField: "contactid",
        isFinalLeg: false
      }
    });

    assert.deepStrictEqual(actions.map((action) => action.id), [
      "continue-traversal"
    ]);
  });
});