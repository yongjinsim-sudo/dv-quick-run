import * as assert from "assert";
import { deriveRelationshipReasoningNotes } from "../../commands/router/actions/explain/relationshipReasoningAdvice.js";

suite("relationshipReasoningAdvice", () => {
  test("extracts related-entity notes from enriched validation issues", () => {
    const notes = deriveRelationshipReasoningNotes([
      {
        severity: "error",
        message: "Field `revenue` in $select was not found on `contact`. It exists on related entity `account`.",
        suggestion: "You may be looking for: `contacts?$select=fullname&$expand=parentcustomerid_account($select=revenue)`"
      }
    ]);

    assert.strictEqual(notes.length, 1);
    assert.strictEqual(notes[0]?.field, "revenue");
    assert.strictEqual(notes[0]?.clause, "$select");
    assert.strictEqual(notes[0]?.baseEntity, "contact");
    assert.strictEqual(notes[0]?.relatedEntity, "account");
  });
});
