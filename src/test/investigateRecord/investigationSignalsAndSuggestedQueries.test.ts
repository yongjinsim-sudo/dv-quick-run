import * as assert from "assert";
import { buildInvestigationSignals } from "../../commands/router/actions/investigateRecord/investigationSignalsBuilder.js";
import { buildSuggestedQueries } from "../../commands/router/actions/investigateRecord/investigationSuggestedQueriesBuilder.js";

suite("investigationSignalsAndSuggestedQueries", () => {
  test("buildInvestigationSignals suppresses strong primary candidate confidence signal", () => {
    const result = buildInvestigationSignals({
      recordContext: {
        entityLogicalName: "contact",
        entitySetName: "contacts",
        primaryNameField: "fullname",
        inferenceSource: "jsonContext"
      },
      record: {
        fullname: "Alice Example",
        statecode: 0,
        modifiedon: "2020-01-01T00:00:00Z"
      },
      relatedRecords: [{ logicalName: "Owner", targetEntityLogicalName: "systemuser", recordId: "1" }],
      selectedCandidateType: "primary",
      selectedCandidateConfidence: 96
    });

    assert.strictEqual(result.some(signal => /heuristic/.test(signal.message)), false);
  });

  test("buildInvestigationSignals emits heuristic signal for low-confidence related candidate", () => {
    const result = buildInvestigationSignals({
      recordContext: {
        entityLogicalName: "contact",
        entitySetName: "contacts",
        primaryNameField: "fullname",
        inferenceSource: "jsonContext"
      },
      record: {
        fullname: "Alice Example",
        statecode: 0
      },
      relatedRecords: [],
      selectedCandidateType: "related",
      selectedCandidateConfidence: 45
    });

    assert.ok(result.some(signal => /heuristic/.test(signal.message)));
    assert.ok(result.some(signal => /No lookup relationships were surfaced/.test(signal.message)));
  });

  test("buildSuggestedQueries dedupes and expands polymorphic lookup target paths", () => {
    const result = buildSuggestedQueries({
      recordContext: {
        entityLogicalName: "contact",
        entitySetName: "contacts",
        primaryIdField: "contactid",
        primaryNameField: "fullname",
        inferenceSource: "jsonContext"
      },
      recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
      rawQuery: "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)",
      minimalQuery: "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)?$select=contactid,fullname",
      relatedRecords: [{
        logicalName: "Company Name",
        recordId: "6d29eec7-4414-f111-8341-6045bdc42f8b",
        targetOptions: [
          { logicalName: "account", entitySetName: "accounts" },
          { logicalName: "contact", entitySetName: "contacts" }
        ]
      }]
    });

    assert.ok(result.includes("contacts(8129eec7-4414-f111-8341-6045bdc42f8b)"));
    assert.ok(result.includes("accounts(6d29eec7-4414-f111-8341-6045bdc42f8b)"));
    assert.ok(result.includes("contacts(6d29eec7-4414-f111-8341-6045bdc42f8b)"));
    assert.strictEqual(result.filter(value => value === "contacts(8129eec7-4414-f111-8341-6045bdc42f8b)").length, 1);
  });
});
