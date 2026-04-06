import * as assert from "assert";
import { clearExecutionEvidenceStore, extractExecutionEvidence, getExecutionEvidenceForQuery, recordExecutionEvidence } from "../../commands/router/actions/shared/diagnostics/executionEvidence.js";

suite("executionEvidence", () => {
  teardown(() => {
    clearExecutionEvidenceStore();
  });

  test("extracts summary evidence from an executed OData query", () => {
    const evidence = extractExecutionEvidence(
      "contacts?$select=fullname,contactid&$filter=statecode eq 0&$top=2",
      { value: [{ contactid: "1" }, { contactid: "2" }] },
      180
    );

    assert.strictEqual(evidence.returnedRowCount, 2);
    assert.strictEqual(evidence.requestedTop, 2);
    assert.strictEqual(evidence.returnedFullPage, true);
    assert.strictEqual(evidence.selectedColumnCount, 2);
    assert.deepStrictEqual(evidence.filterFieldNames, ["statecode"]);
  });

  test("stores and retrieves evidence by normalized query signature", () => {
    const evidence = extractExecutionEvidence("/contacts?$top=1", { value: [{ contactid: "1" }] }, 25);
    recordExecutionEvidence(evidence);

    const stored = getExecutionEvidenceForQuery("contacts?$top=1");
    assert.ok(stored);
    assert.strictEqual(stored?.executionTimeMs, 25);
  });
});
