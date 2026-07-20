import * as assert from "assert";
import { parseDataverseQuery } from "../../commands/router/actions/explain/explainQueryParser.js";

suite("explainQueryParser", () => {
  test("parses collection query with select orderby top and expand", () => {
    const parsed = parseDataverseQuery("contacts?$select=fullname,emailaddress1&$orderby=createdon desc&$top=5&$expand=parentcustomerid_account($select=name)");

    assert.strictEqual(parsed.entitySetName, "contacts");
    assert.strictEqual(parsed.isCollection, true);
    assert.deepStrictEqual(parsed.select, ["fullname", "emailaddress1"]);
    assert.deepStrictEqual(parsed.orderBy, [{ field: "createdon", direction: "desc" }]);
    assert.strictEqual(parsed.top, 5);
    assert.strictEqual(parsed.expand[0].navigationProperty, "parentcustomerid_account");
    assert.deepStrictEqual(parsed.expand[0].nestedSelect, ["name"]);
  });

  test("parses single-record query", () => {
    const parsed = parseDataverseQuery("contacts(00000000-0000-0000-0000-000000000001)?$select=fullname");

    assert.strictEqual(parsed.entitySetName, "contacts");
    assert.strictEqual(parsed.isSingleRecord, true);
    assert.strictEqual(parsed.recordId, "00000000-0000-0000-0000-000000000001");
  });

  test("surfaces unknown params", () => {
    const parsed = parseDataverseQuery("contacts?$foo=bar&$select=fullname");
    assert.deepStrictEqual(parsed.unknownParams.map((x) => x.key), ["$foo"]);
  });

  test("parses a full Dataverse Web API URL and preserves the original source", () => {
    const source = "GET https://org.crm.dynamics.com/api/data/v9.2/contacts?$select=fullname&$expand=parentcustomerid_account($select=name;$filter=statecode eq 0)#example";
    const parsed = parseDataverseQuery(source);

    assert.strictEqual(parsed.entitySetName, "contacts");
    assert.strictEqual(parsed.sourceKind, "absolute-url");
    assert.strictEqual(parsed.raw, source);
    assert.strictEqual(parsed.expand[0].navigationProperty, "parentcustomerid_account");
    assert.deepStrictEqual(parsed.expand[0].nestedSelect, ["name"]);
  });

  test("reports duplicate and malformed query options without discarding them", () => {
    const parsed = parseDataverseQuery("contacts?$select=fullname&select=emailaddress1&$select=contactid");

    assert.deepStrictEqual(parsed.duplicateParams?.map((item) => item.key), ["$select", "$select"]);
    assert.ok(parsed.parseDiagnostics?.some((item) => item.code === "DuplicateQueryOption"));
    assert.ok(parsed.parseDiagnostics?.some((item) => item.code === "MalformedQueryOption" && item.optionName === "select"));
  });
});
