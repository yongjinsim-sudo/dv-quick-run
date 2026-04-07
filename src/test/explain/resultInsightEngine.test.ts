import * as assert from "assert";
import { buildResultInsightFinding } from "../../commands/router/actions/shared/diagnostics/resultInsightEngine.js";
import type { ExecutionEvidence } from "../../commands/router/actions/shared/diagnostics/executionEvidence.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";

suite("resultInsightEngine", () => {
  test("prioritises business-like categorical fields", () => {
    const evidence: ExecutionEvidence = {
      querySignature: "contacts",
      entitySetName: "contacts",
      executionTimeMs: 10,
      returnedRowCount: 12,
      requestedTop: 12,
      returnedFullPage: true,
      selectedColumnCount: 3,
      hasExpand: false,
      filterFieldNames: [],
      observedAt: 0,
      fieldObservations: [
        {
          field: "statuscode",
          nonNullCount: 12,
          nullCount: 0,
          distinctCount: 3,
          mostCommonCount: 5,
          kind: "categorical",
          topValues: [
            { value: "Active", count: 5 },
            { value: "Pending", count: 4 },
            { value: "Closed", count: 3 }
          ]
        },
        {
          field: "new_category",
          nonNullCount: 12,
          nullCount: 0,
          distinctCount: 2,
          mostCommonCount: 7,
          kind: "categorical",
          topValues: [
            { value: "A", count: 7 },
            { value: "B", count: 5 }
          ]
        }
      ]
    };

    const fields: FieldDef[] = [
      { logicalName: "statuscode", displayName: "Status", attributeType: "Status" } as never,
      { logicalName: "new_category", displayName: "Category", attributeType: "Picklist" } as never
    ];

    const finding = buildResultInsightFinding({ evidence, fields });

    assert.ok(finding);
    assert.ok((finding?.narrowingSuggestions?.length ?? 0) >= 1);
    assert.strictEqual(finding?.narrowingSuggestions?.[0]?.field, "statuscode");
  });
});
