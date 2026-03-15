import * as assert from "assert";
import { extractInvestigationCandidatesFromJson } from "../../commands/router/actions/investigateRecord/investigationCandidateExtractor.js";
import { extractInvestigationCandidatesFromSelection } from "../../commands/router/actions/investigateRecord/investigationSelectionExtractor.js";

suite("investigationCandidateExtractor", () => {
  test("extracts primary and lookup guid candidates from root json", () => {
    const result = extractInvestigationCandidatesFromJson({
      contactid: "8129eec7-4414-f111-8341-6045bdc42f8b",
      _ownerid_value: "22222222-2222-2222-2222-222222222222",
      fullname: "Alice"
    }, "contacts");

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result.map(r => ({ fieldName: r.fieldName, sourceType: r.sourceType })), [
      { fieldName: "contactid", sourceType: "rootField" },
      { fieldName: "_ownerid_value", sourceType: "lookup" }
    ]);
  });

  test("extracts collection row guid candidates with source index", () => {
    const result = extractInvestigationCandidatesFromJson({
      value: [
        { accountid: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", name: "A" },
        { accountid: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", name: "B" }
      ]
    }, "accounts");

    assert.strictEqual(result.length, 2);
    assert.strictEqual(result[0].sourceIndex, 0);
    assert.strictEqual(result[1].sourceIndex, 1);
    assert.strictEqual(result[0].sourceType, "collectionField");
  });

  test("dedupes repeated guid candidates from json", () => {
    const result = extractInvestigationCandidatesFromJson({
      contactid: "8129eec7-4414-f111-8341-6045bdc42f8b",
      duplicate: "8129eec7-4414-f111-8341-6045bdc42f8b",
      _ownerid_value: "22222222-2222-2222-2222-222222222222",
      value: [
        { contactid: "8129eec7-4414-f111-8341-6045bdc42f8b" }
      ]
    }, "contacts");

    assert.strictEqual(result.length, 4);
    assert.ok(result.some(r => r.fieldName === "contactid" && r.sourceType === "rootField"));
    assert.ok(result.some(r => r.fieldName === "contactid" && r.sourceType === "collectionField"));
  });

  test("extracts selection candidates and marks lookup fields", () => {
    const selection = `{
      "contactid": "8129eec7-4414-f111-8341-6045bdc42f8b",
      "_parentcustomerid_value": "33333333-3333-3333-3333-333333333333"
    }`;

    const result = extractInvestigationCandidatesFromSelection(selection, "contacts");

    assert.strictEqual(result.length, 2);
    assert.deepStrictEqual(result.map(r => ({ fieldName: r.fieldName, sourceType: r.sourceType })), [
      { fieldName: "contactid", sourceType: "rootField" },
      { fieldName: "_parentcustomerid_value", sourceType: "lookup" }
    ]);
  });
});
