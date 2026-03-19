import * as assert from "assert";
import { buildResultViewerModel } from "../../services/resultViewModelBuilder.js";

suite("resultViewerDrawerRouting", () => {
  test("object array cells preserve exact raw payload for drawer use", () => {
    const relatedContacts = [
      { fullname: "John", emailaddress1: "john@example.com" },
      { fullname: "Jane", emailaddress1: "jane@example.com" }
    ];

    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          contact_customer_accounts: relatedContacts
        }
      ]
    }, "accounts?$expand=contact_customer_accounts($select=fullname,emailaddress1)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    const cell = model.rows[0]["contact_customer_accounts"];

    assert.ok(cell);
    assert.strictEqual(cell?.value, "2 records • fullname, emailaddress1");
    assert.strictEqual(cell?.rawValue, relatedContacts);
  });

  test("primitive array cells preserve exact raw payload for drawer/export use", () => {
    const tags = ["vip", "priority", "followup"];

    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          tags
        }
      ]
    }, "contacts?$select=tags", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const cell = model.rows[0]["tags"];

    assert.ok(cell);
    assert.strictEqual(cell?.value, "3 values • vip, priority");
    assert.strictEqual(cell?.rawValue, tags);
  });

  test("supported single-item expanded arrays map values to the correct flattened cells", () => {
    const relatedRow = {
      fullname: "John Smith",
      emailaddress1: "john@example.com"
    };

    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          contact_customer_accounts: [relatedRow]
        }
      ]
    }, "accounts?$expand=contact_customer_accounts($select=fullname,emailaddress1)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    assert.strictEqual(model.rows[0]["cca.fullname"]?.value, "John Smith");
    assert.strictEqual(model.rows[0]["cca.emailaddress1"]?.value, "john@example.com");
    assert.strictEqual(model.rows[0]["cca.fullname"]?.rawValue, "John Smith");
    assert.strictEqual(model.rows[0]["cca.emailaddress1"]?.rawValue, "john@example.com");
  });

  test("sparse rows do not leak payload ownership across rows", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          tags: ["vip", "priority"]
        },
        {
          contactid: "9229eec7-4414-4f11-8341-6045bdc42f8c"
        }
      ]
    }, "contacts?$select=contactid,tags", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    assert.deepStrictEqual(model.rows[0]["tags"]?.rawValue, ["vip", "priority"]);
    assert.strictEqual(model.rows[1]["tags"]?.rawValue, undefined);
    assert.strictEqual(model.rows[1]["tags"]?.value, "");
  });

  test("complex cell raw payload remains serializable for export fidelity", () => {
    const complexValue = [
      { fullname: "John", emailaddress1: "john@example.com" },
      { fullname: "Jane", emailaddress1: "jane@example.com" }
    ];

    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          contact_customer_accounts: complexValue
        }
      ]
    }, "accounts?$expand=contact_customer_accounts($select=fullname,emailaddress1)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    const cell = model.rows[0]["contact_customer_accounts"];
    const serialized = JSON.stringify(cell?.rawValue);

    assert.strictEqual(serialized, JSON.stringify(complexValue));
    assert.notStrictEqual(cell?.value, serialized);
  });
});