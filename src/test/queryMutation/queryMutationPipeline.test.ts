import * as assert from "assert";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { appendOrderByExpression, setQueryOption, upsertCsvQueryOption } from "../../commands/router/actions/shared/queryMutation/queryOptionMutator.js";

suite("queryMutationPipeline", () => {
  test("parses and rebuilds query with leading slash", () => {
    const parsed = parseEditorQuery("/contacts?$select=fullname&$top=10");

    assert.strictEqual(parsed.leadingSlash, true);
    assert.strictEqual(parsed.entityPath, "contacts");
    assert.strictEqual(buildEditorQuery(parsed), "/contacts?$select=fullname&$top=10");
  });

  test("normalizes parenthesized select clause", () => {
    const parsed = parseEditorQuery("contacts?$select=(fullname,emailaddress1)");
    assert.strictEqual(parsed.queryOptions.get("$select"), "fullname,emailaddress1");
  });

  test("upserts csv option without duplicates", () => {
    const parsed = parseEditorQuery("contacts?$select=fullname");
    upsertCsvQueryOption(parsed, "$select", ["emailaddress1", "fullname"], "appendCsv");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=fullname,emailaddress1");
  });

  test("replaces csv option when replace mode used", () => {
    const parsed = parseEditorQuery("contacts?$select=fullname");
    upsertCsvQueryOption(parsed, "$select", ["emailaddress1"], "replace");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=emailaddress1");
  });

  test("appends orderby expression when existing order present", () => {
    const parsed = parseEditorQuery("contacts?$orderby=createdon desc");
    appendOrderByExpression(parsed, "fullname asc", false);

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$orderby=createdon desc,fullname asc");
  });

  test("replaces orderby expression when replaceExisting is true", () => {
    const parsed = parseEditorQuery("contacts?$orderby=createdon desc");
    appendOrderByExpression(parsed, "fullname asc", true);

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$orderby=fullname asc");
  });

  test("setQueryOption preserves single instance of option", () => {
    const parsed = parseEditorQuery("contacts?$select=fullname&$top=10");
    setQueryOption(parsed, "$top", "25");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=fullname&$top=25");
  });
});
