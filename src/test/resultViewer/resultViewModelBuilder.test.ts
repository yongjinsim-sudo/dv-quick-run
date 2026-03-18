import * as assert from "assert";
import { buildResultViewerModel } from "../../services/resultViewModelBuilder.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";

suite("resultViewModelBuilder", () => {
  test("builds unioned columns across sparse rows", () => {
    const result = {
      value: [
        { contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", fullname: "John" },
        { contactid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", emailaddress1: "j@example.com" }
      ]
    };

    const model = buildResultViewerModel(result, "contacts?$select=fullname,emailaddress1", {
      primaryIdField: "contactid",
      entitySetName: "contacts"
    });

    assert.strictEqual(model.mode, "collection");
    assert.deepStrictEqual(model.columns, ["contactid", "emailaddress1", "fullname"]);
    assert.strictEqual(model.rows.length, 2);
    assert.strictEqual(model.rows[0]["fullname"]?.value, "John");
    assert.strictEqual(model.rows[0]["emailaddress1"]?.value, "");
    assert.strictEqual(model.rows[1]["fullname"]?.value, "");
    assert.strictEqual(model.rows[1]["emailaddress1"]?.value, "j@example.com");
  });

  test("prioritises primary id field as first column", () => {
    const result = {
      value: [
        {
          fullname: "John",
          createdon: "2026-03-18T00:00:00Z",
          contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa"
        }
      ]
    };

    const model = buildResultViewerModel(result, "contacts?$select=fullname,createdon,contactid", {
      primaryIdField: "contactid"
    });

    assert.strictEqual(model.columns[0], "contactid");
  });

  test("flattens a single expanded object into aliased dot-path columns", () => {
    const result = {
      value: [
        {
          contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          parentcustomerid_account: {
            name: "Acme",
            accountnumber: "A100"
          }
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "contacts?$expand=parentcustomerid_account($select=name,accountnumber)",
      {
        primaryIdField: "contactid",
        entitySetName: "contacts"
      }
    );

    assert.deepStrictEqual(model.columns, ["contactid", "pa.accountnumber", "pa.name"]);
    assert.strictEqual(model.rows[0]["pa.name"]?.value, "Acme");
    assert.strictEqual(model.rows[0]["pa.accountnumber"]?.value, "A100");
    assert.ok(model.legend);
    assert.deepStrictEqual(model.legend, [
      { alias: "pa", fullName: "parentcustomerid_account" }
    ]);
  });

  test("flattens supported single-item object arrays", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          contact_customer_accounts: [
            {
              fullname: "John Smith",
              emailaddress1: "john@example.com"
            }
          ]
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "accounts?$expand=contact_customer_accounts($select=fullname,emailaddress1)",
      {
        primaryIdField: "accountid",
        entitySetName: "accounts"
      }
    );

    assert.deepStrictEqual(model.columns, ["accountid", "cca.emailaddress1", "cca.fullname"]);
    assert.strictEqual(model.rows[0]["cca.fullname"]?.value, "John Smith");
    assert.strictEqual(model.rows[0]["cca.emailaddress1"]?.value, "john@example.com");
    assert.notStrictEqual(model.rows[0]["cca.fullname"]?.value, "[Object]");
  });

  test("keeps multi-item object arrays summarised instead of flattening", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          contact_customer_accounts: [
            { fullname: "John" },
            { fullname: "Jane" }
          ]
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "accounts?$expand=contact_customer_accounts($select=fullname)",
      {
        primaryIdField: "accountid",
        entitySetName: "accounts"
      }
    );

    assert.deepStrictEqual(model.columns, ["accountid", "contact_customer_accounts"]);
    assert.strictEqual(model.rows[0]["contact_customer_accounts"]?.value, "2 records • fullname");
    assert.deepStrictEqual(model.rows[0]["contact_customer_accounts"]?.rawValue, [
      { fullname: "John" },
      { fullname: "Jane" }
    ]);
    assert.strictEqual(model.rows[0]["contact_customer_accounts"]?.actions, undefined);
  });

  test("supports depth-2 flattening without over-flattening deeper levels", () => {
    const result = {
      value: [
        {
          contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          parentcustomerid_account: {
            primarycontactid: {
              fullname: "Nested Person",
              contactid: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb"
            }
          }
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "contacts?$expand=parentcustomerid_account($expand=primarycontactid($select=fullname,contactid))",
      {
        primaryIdField: "contactid",
        entitySetName: "contacts"
      }
    );

    assert.deepStrictEqual(model.columns, ["contactid", "pa.p.contactid", "pa.p.fullname"]);
    assert.strictEqual(model.rows[0]["pa.p.fullname"]?.value, "Nested Person");
    assert.strictEqual(model.rows[0]["pa.p.contactid"]?.value, "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb");
  });

  test("filters out @odata child fields during flattening", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          primarycontactid: {
            "@odata.etag": "W/\"123\"",
            fullname: "Alice"
          }
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "accounts?$expand=primarycontactid($select=fullname)",
      {
        primaryIdField: "accountid"
      }
    );

    assert.deepStrictEqual(model.columns, ["accountid", "p.fullname"]);
    assert.strictEqual(model.rows[0]["p.fullname"]?.value, "Alice");
    assert.ok(!model.columns.includes("p.@odata.etag"));
  });

  test("filters out lookup _x_value child fields during flattening", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          parentcustomerid_account: {
            _primarycontactid_value: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
            name: "Acme"
          }
        }
      ]
    };

    const model = buildResultViewerModel(
      result,
      "accounts?$expand=parentcustomerid_account($select=name)",
      {
        primaryIdField: "accountid"
      }
    );

    assert.deepStrictEqual(model.columns, ["accountid", "pa.name"]);
    assert.strictEqual(model.rows[0]["pa.name"]?.value, "Acme");
    assert.ok(!model.columns.includes("pa._primarycontactid_value"));
  });

  test("generates deterministic shortened aliases and legend mapping", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          parentcustomerid_account: {
            name: "Acme",
            accountnumber: "A100"
          },
          primarycontactid: {
            fullname: "Alice"
          }
        }
      ]
    };

    const modelA = buildResultViewerModel(
      result,
      "accounts?$expand=parentcustomerid_account($select=name,accountnumber),primarycontactid($select=fullname)",
      {
        primaryIdField: "accountid"
      }
    );

    const modelB = buildResultViewerModel(
      result,
      "accounts?$expand=parentcustomerid_account($select=name,accountnumber),primarycontactid($select=fullname)",
      {
        primaryIdField: "accountid"
      }
    );

    assert.deepStrictEqual(modelA.columns, modelB.columns);
    assert.deepStrictEqual(modelA.legend, modelB.legend);
    assert.deepStrictEqual(modelA.legend, [
      { alias: "pa", fullName: "parentcustomerid_account" },
      { alias: "p", fullName: "primarycontactid" }
    ]);
  });

  test("resolves choice labels while keeping raw and copy values", () => {
    const fields: FieldDef[] = [
      {
        logicalName: "statuscode",
        attributeType: "status"
      }
    ];

    const choiceMetadata: ChoiceMetadataDef[] = [
      {
        entityLogicalName: "contact",
        fieldLogicalName: "statuscode",
        attributeType: "status",
        kind: "status",
        options: [
          {
            value: 1,
            label: "Active",
            normalizedLabel: "active"
          }
        ]
      }
    ];

    const result = {
      value: [
        {
          contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          statuscode: 1
        }
      ]
    };

    const model = buildResultViewerModel(result, "contacts?$select=statuscode", {
      primaryIdField: "contactid",
      fields,
      choiceMetadata
    });

    assert.strictEqual(model.rows[0]["statuscode"]?.value, "Active");
    assert.strictEqual(model.rows[0]["statuscode"]?.rawValue, 1);
    assert.strictEqual(model.rows[0]["statuscode"]?.copyValue, "1");
  });

  test("keeps raw payload for non-flattened object cells", () => {
    const result = {
      value: [
        {
          accountid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          metadataBlob: {
            region: "AU",
            owner: "Team A"
          }
        }
      ]
    };

    const model = buildResultViewerModel(result, "accounts?$select=metadataBlob", {
      primaryIdField: "accountid"
    });

    assert.deepStrictEqual(model.columns, ["accountid", "m.owner", "m.region"]);
    assert.strictEqual(model.rows[0]["m.region"]?.value, "AU");
    assert.strictEqual(model.rows[0]["m.owner"]?.value, "Team A");
  });

  test("primitive arrays show summary text and keep raw payload", () => {
    const result = {
      value: [
        {
          contactid: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
          tags: ["a", "b", "c"]
        }
      ]
    };

    const model = buildResultViewerModel(result, "contacts?$select=tags", {
      primaryIdField: "contactid"
    });

    assert.strictEqual(model.rows[0]["tags"]?.value, "3 values • a, b");
    assert.deepStrictEqual(model.rows[0]["tags"]?.rawValue, ["a", "b", "c"]);
    assert.strictEqual(model.rows[0]["tags"]?.actions, undefined);
  });

  test("returns raw mode for primitive top-level results", () => {
    const model = buildResultViewerModel("hello", "whoami");

    assert.strictEqual(model.mode, "raw");
    assert.strictEqual(model.columns.length, 0);
    assert.strictEqual(model.rows.length, 0);
    assert.strictEqual(model.rowCount, 0);
  });
});