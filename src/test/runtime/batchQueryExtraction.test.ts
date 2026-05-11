import * as assert from "assert";
import { extractBatchCandidateQueriesFromText } from "../../commands/router/actions/execution/runBatchQueriesAction.js";

suite("batchQueryExtraction", () => {
  test("keeps duplicate OData queries as separate batch sub-requests", () => {
    const source = [
      "accounts?$select=accountid",
      "accounts?$select=accountid"
    ].join("\n");

    assert.deepStrictEqual(extractBatchCandidateQueriesFromText(source), [
      "accounts?$select=accountid",
      "accounts?$select=accountid"
    ]);
  });

  test("extracts selected OData queries with nested and sibling expand options", () => {
    const source = [
      "accounts?$select=accountid&$expand=primarycontactid($select=contactid;$expand=createdby($select=identityid),owninguser($select=identityid))",
      "accounts?$select=accountid&$expand=primarycontactid($select=contactid;$expand=modifiedby($select=identityid))"
    ].join("\n");

    const queries = extractBatchCandidateQueriesFromText(source);

    assert.strictEqual(queries.length, 2);
    assert.strictEqual(queries[0]?.includes("$expand=primarycontactid"), true);
    assert.strictEqual(queries[0]?.includes("owninguser"), true);
  });

  test("supports explicit GET prefixes while preserving relative query payloads", () => {
    const source = [
      "GET contacts?$select=contactid",
      "GET accounts?$select=accountid"
    ].join("\n");

    assert.deepStrictEqual(extractBatchCandidateQueriesFromText(source), [
      "contacts?$select=contactid",
      "accounts?$select=accountid"
    ]);
  });

  test("ignores CodeLens helper text and non-OData lines", () => {
    const source = [
      "Run Query | Explain",
      "contacts?$select=contactid",
      "// accounts?$select=accountid",
      "<fetch><entity name='contact' /></fetch>",
      "accounts?$select=accountid"
    ].join("\n");

    assert.deepStrictEqual(extractBatchCandidateQueriesFromText(source), [
      "contacts?$select=contactid",
      "accounts?$select=accountid"
    ]);
  });
});
