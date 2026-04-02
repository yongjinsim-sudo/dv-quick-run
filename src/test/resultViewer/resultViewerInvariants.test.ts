import * as assert from "assert";
import {
  buildResultViewerModel,
  RESULT_VIEWER_MAX_FLATTEN_DEPTH
} from "../../services/resultViewModelBuilder.js";

suite("resultViewerInvariants", () => {
  test("flattened alias columns keep original source field path in action payloads", () => {
    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          parentcustomerid_account: {
            name: "Acme Pty Ltd"
          }
        }
      ]
    }, "accounts?$expand=parentcustomerid_account($select=name)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    const nameCell = model.rows[0]["pa.name"];
    const filterAction = nameCell?.actions?.find((action) => action.id === "preview-odata-filter");
    const fetchXmlAction = nameCell?.actions?.find((action) => action.id === "copy-fetchxml-condition");

    assert.strictEqual(filterAction, undefined);
    assert.ok(fetchXmlAction);
    assert.strictEqual(fetchXmlAction?.payload.columnName, "parentcustomerid_account.name");
    assert.strictEqual(fetchXmlAction?.payload.rawValue, "Acme Pty Ltd");
  });

  test("depth guardrail stops flattening beyond the configured maximum depth", () => {
    assert.strictEqual(RESULT_VIEWER_MAX_FLATTEN_DEPTH, 2);

    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          parentcustomerid_account: {
            primarycontactid: {
              owningteam: {
                name: "Customer Ops"
              }
            }
          }
        }
      ]
    }, "contacts?$expand=parentcustomerid_account($expand=primarycontactid($expand=owningteam($select=name)))", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    assert.deepStrictEqual(model.columns, ["contactid", "pa.p.owningteam"]);
    assert.strictEqual(model.rows[0]["pa.p.owningteam"]?.value, "[Object]");
    assert.deepStrictEqual(model.rows[0]["pa.p.owningteam"]?.rawValue, {
      name: "Customer Ops"
    });
    assert.strictEqual(model.rows[0]["pa.p.owningteam"]?.actions, undefined);
  });

  test("single-item arrays flatten but multi-item arrays stay drawer-routed", () => {
    const model = buildResultViewerModel({
      value: [
        {
          accountid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          primarycontactid: [
            {
              fullname: "Single Contact"
            }
          ],
          contact_customer_accounts: [
            {
              fullname: "John"
            },
            {
              fullname: "Jane"
            }
          ]
        }
      ]
    }, "accounts?$expand=primarycontactid($select=fullname),contact_customer_accounts($select=fullname)", {
      entitySetName: "accounts",
      entityLogicalName: "account",
      primaryIdField: "accountid"
    });

    assert.ok(model.columns.includes("p.fullname"));
    assert.strictEqual(model.rows[0]["p.fullname"]?.value, "Single Contact");
    assert.strictEqual(model.rows[0]["p.fullname"]?.rawValue, "Single Contact");

    assert.ok(model.columns.includes("contact_customer_accounts"));
    assert.strictEqual(model.rows[0]["contact_customer_accounts"]?.value, "2 records • fullname");
    assert.deepStrictEqual(model.rows[0]["contact_customer_accounts"]?.rawValue, [
      {
        fullname: "John"
      },
      {
        fullname: "Jane"
      }
    ]);
    assert.strictEqual(model.rows[0]["contact_customer_accounts"]?.actions, undefined);
  });

  test("primary id actions remain isolated to the true primary id column", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          _ownerid_value: "9229eec7-4414-4f11-8341-6045bdc42f8c"
        }
      ]
    }, "contacts?$select=contactid,_ownerid_value", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const primaryIds = model.rows[0]["contactid"]?.actions?.map((action) => action.id) ?? [];
    const lookupIds = model.rows[0]["_ownerid_value"]?.actions?.map((action) => action.id) ?? [];

    assert.deepStrictEqual(primaryIds, [
      "investigate-record",
      "open-in-dataverse-ui",
      "copy-record-url",
      "preview-odata-filter",
      "preview-fetchxml-condition"
    ]);
    assert.deepStrictEqual(lookupIds, [
      "preview-odata-filter",
      "preview-fetchxml-condition"
    ]);
  });




  test("model-driven action groups stay aligned with the full action list", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          fullname: "Nancy Anderson"
        }
      ]
    }, "contacts?$select=contactid,fullname", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const idCell = model.rows[0]["contactid"];
    const nameCell = model.rows[0]["fullname"];

    assert.deepStrictEqual(idCell?.primaryActions?.map((action) => action.id), [
      "investigate-record",
      "open-in-dataverse-ui"
    ]);
    assert.deepStrictEqual(idCell?.primaryActions?.map((action) => action.group), [
      "inspection",
      "inspection"
    ]);
    assert.deepStrictEqual(idCell?.overflowActions?.map((action) => action.id), [
      "copy-record-url",
      "preview-odata-filter",
      "preview-fetchxml-condition"
    ]);
    assert.deepStrictEqual(
      idCell?.actions?.map((action) => action.id),
      [
        ...(idCell?.primaryActions?.map((action) => action.id) ?? []),
        ...(idCell?.overflowActions?.map((action) => action.id) ?? [])
      ]
    );

    assert.strictEqual(nameCell?.primaryActions, undefined);
    assert.deepStrictEqual(nameCell?.overflowActions?.map((action) => action.id), [
      "preview-odata-filter",
      "preview-fetchxml-condition"
    ]);
    assert.deepStrictEqual(model.rowActions?.[0]?.actions.map((action) => action.id), [
      "investigate-record",
      "open-in-dataverse-ui",
      "copy-record-url",
      "preview-fetchxml-condition"
    ]);
  });

  test("model-driven export and drawer semantics cover scalar, object, array, and empty cells", () => {
    const complexObject = {
      name: "Customer Ops"
    };
    const tags = ["vip", "priority"];

    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          fullname: "Nancy Anderson",
          tags,
          parentcustomerid_account: {
            primarycontactid: {
              owningteam: complexObject
            }
          }
        },
        {
          contactid: "9229eec7-4414-4f11-8341-6045bdc42f8c"
        }
      ]
    }, "contacts?$select=fullname,tags&$expand=parentcustomerid_account($expand=primarycontactid($expand=owningteam($select=name)))", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const scalarCell = model.rows[0]["fullname"];
    const arrayCell = model.rows[0]["tags"];
    const objectCell = model.rows[0]["pa.p.owningteam"];
    const emptyCell = model.rows[1]["fullname"];

    assert.strictEqual(scalarCell?.valueType, "scalar");
    assert.strictEqual(scalarCell?.exportValue, "Nancy Anderson");
    assert.strictEqual(scalarCell?.drawerPayload, undefined);

    assert.strictEqual(arrayCell?.valueType, "array");
    assert.strictEqual(arrayCell?.exportValue, JSON.stringify(tags));
    assert.strictEqual(arrayCell?.drawerPayload?.column, "tags");
    assert.deepStrictEqual(arrayCell?.drawerPayload?.payload, tags);

    assert.strictEqual(objectCell?.valueType, "object");
    assert.strictEqual(objectCell?.exportValue, JSON.stringify(complexObject));
    assert.strictEqual(objectCell?.drawerPayload?.column, "parentcustomerid_account.primarycontactid.owningteam");
    assert.deepStrictEqual(objectCell?.drawerPayload?.payload, complexObject);

    assert.strictEqual(emptyCell?.valueType, "empty");
    assert.strictEqual(emptyCell?.exportValue, "");
    assert.strictEqual(emptyCell?.drawerPayload, undefined);
  });

  test("builder exposes model-driven cell semantics without changing flattening behaviour", () => {
    const model = buildResultViewerModel({
      value: [
        {
          contactid: "8129eec7-4414-4f11-8341-6045bdc42f8b",
          fullname: "Nancy Anderson",
          account_primary_contact: [
            {
              accountid: "6929eec7-4414-f111-8341-6045bdc42f8b",
              revenue: 100000
            },
            {
              accountid: "6b29eec7-4414-f111-8341-6045bdc42f8b",
              revenue: 20000
            }
          ],
          parentcustomerid_account: {
            name: "Acme Pty Ltd"
          }
        }
      ]
    }, "contacts?$select=fullname&$expand=account_primary_contact($select=accountid,revenue),parentcustomerid_account($select=name)", {
      entitySetName: "contacts",
      entityLogicalName: "contact",
      primaryIdField: "contactid"
    });

    const idCell = model.rows[0]["contactid"];
    const nameCell = model.rows[0]["fullname"];
    const accountArrayCell = model.rows[0]["account_primary_contact"];
    const relatedNameCell = model.rows[0]["pa.name"];

    assert.strictEqual(idCell?.valueType, "scalar");
    assert.strictEqual(idCell?.originalColumnName, "contactid");
    assert.ok((idCell?.primaryActions?.length ?? 0) > 0);
    assert.ok((idCell?.overflowActions?.length ?? 0) > 0);

    assert.strictEqual(nameCell?.valueType, "scalar");
    assert.strictEqual(nameCell?.exportValue, "Nancy Anderson");

    assert.strictEqual(accountArrayCell?.valueType, "array");
    assert.strictEqual(accountArrayCell?.drawerPayload?.column, "account_primary_contact");
    assert.deepStrictEqual(accountArrayCell?.drawerPayload?.payload, [
      {
        accountid: "6929eec7-4414-f111-8341-6045bdc42f8b",
        revenue: 100000
      },
      {
        accountid: "6b29eec7-4414-f111-8341-6045bdc42f8b",
        revenue: 20000
      }
    ]);
    assert.strictEqual(accountArrayCell?.primaryActions, undefined);
    assert.strictEqual(accountArrayCell?.overflowActions, undefined);
    assert.strictEqual(accountArrayCell?.exportValue, JSON.stringify([
      {
        accountid: "6929eec7-4414-f111-8341-6045bdc42f8b",
        revenue: 100000
      },
      {
        accountid: "6b29eec7-4414-f111-8341-6045bdc42f8b",
        revenue: 20000
      }
    ]));

    assert.strictEqual(relatedNameCell?.originalColumnName, "parentcustomerid_account.name");
  });

});
