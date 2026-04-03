import * as assert from "assert";
import { buildFilterPreviewFromInsight } from "../../refinement/filterBuilder/preview.js";
import type { BuildFilterInsight } from "../../refinement/filterBuilder/models.js";

function makeInsight(clause: string, mergeStrategy: "replace" | "appendAnd"): BuildFilterInsight {
  const [fieldLogicalName, operator, value] = clause.split(/\s+/);
  return {
    kind: "query.mutate.filterExpression",
    expression: {
      combinator: "and",
      clauses: [
        {
          fieldLogicalName,
          fieldType: "choice",
          operator: operator as any,
          valueKind: "single",
          value
        }
      ]
    },
    mergeStrategy
  };
}

suite("filterBuilderPreview", () => {
  test("appendAnd wraps existing compound filter once", () => {
    const result = buildFilterPreviewFromInsight(
      "contacts?$top=5&$filter=startswith(fullname,'y') and endswith(fullname,'sample')",
      makeInsight("statecode eq 0", "appendAnd")
    );

    assert.ok(result.previewQuery.includes("$filter=(startswith(fullname,'y') and endswith(fullname,'sample')) and statecode eq 0"));
  });

  test("appendAnd does not double-wrap existing parenthesized filter", () => {
    const result = buildFilterPreviewFromInsight(
      "contacts?$top=5&$filter=(startswith(fullname,'y') and endswith(fullname,'sample'))",
      makeInsight("statecode eq 0", "appendAnd")
    );

    assert.ok(result.previewQuery.includes("$filter=(startswith(fullname,'y') and endswith(fullname,'sample')) and statecode eq 0"));
    assert.ok(!result.previewQuery.includes("$filter=((startswith(fullname,'y') and endswith(fullname,'sample')))"));
  });
});
