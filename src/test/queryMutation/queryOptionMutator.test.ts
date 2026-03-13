import * as assert from "assert";
import { buildEditorQuery, parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import {
  appendOrderByExpression,
  removeQueryOption,
  upsertCsvQueryOption
} from "../../commands/router/actions/shared/queryMutation/queryOptionMutator.js";

suite("queryOptionMutator", () => {
  test("appendCsv deduplicates case-insensitively while preserving first casing", () => {
    const parsed = parseEditorQuery("contacts?$select=FullName");
    upsertCsvQueryOption(parsed, "$select", ["fullname", "emailaddress1"], "appendCsv");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=FullName,emailaddress1");
  });

  test("removeQueryOption deletes an existing option cleanly", () => {
    const parsed = parseEditorQuery("contacts?$select=fullname&$top=10");
    removeQueryOption(parsed, "$top");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=fullname");
  });

  test("upsertCsvQueryOption ignores empty incoming values", () => {
    const parsed = parseEditorQuery("contacts?$select=fullname");
    upsertCsvQueryOption(parsed, "$select", ["  ", ""], "appendCsv");

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$select=fullname");
  });

  test("appendOrderByExpression ignores blank expressions", () => {
    const parsed = parseEditorQuery("contacts?$orderby=createdon desc");
    appendOrderByExpression(parsed, "   ", false);

    assert.strictEqual(buildEditorQuery(parsed), "contacts?$orderby=createdon desc");
  });
});
