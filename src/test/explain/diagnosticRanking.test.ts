import * as assert from "assert";
import { runDiagnostics } from "../../commands/router/actions/shared/diagnostics/diagnosticRuleEngine.js";
import type { ParsedDataverseQuery } from "../../commands/router/actions/explain/explainQueryTypes.js";

const parsed: ParsedDataverseQuery = {
  raw: "accounts?$filter=name gt 'abc'",
  normalized: "accounts?$filter=name gt 'abc'",
  pathPart: "accounts",
  queryPart: "$filter=name gt 'abc'",
  entitySetName: "accounts",
  isSingleRecord: false,
  isCollection: true,
  params: [],
  select: [],
  filter: "name gt 'abc'",
  orderBy: [],
  expand: [],
  unknownParams: []
};

suite("diagnosticRanking", () => {
  test("ranks semantic warnings ahead of generic shape guidance", async () => {
    const result = await runDiagnostics(
      {
        parsed,
        entityLogicalName: "account",
        loadFieldsForEntity: async () => ([{ logicalName: "name", attributeType: "String", isValidForAdvancedFind: true }] as any)
      },
      { insightLevel: 2, canApplyFix: false }
    );

    assert.ok(result.findings.length >= 3);
    assert.ok(result.findings[0].message.includes("text field"));
    assert.strictEqual(result.findings[1].message, "Query does not specify $select.");
    assert.strictEqual(result.findings[2].message, "Collection query does not specify $top.");
  });
});
