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
});
