import * as assert from "assert";
import { suite, test } from "mocha";
import { runDiagnostics } from "../../commands/router/actions/shared/diagnostics/diagnosticRuleEngine.js";
import { getDiagnosticActionability, isActionableDiagnosticFinding } from "../../commands/router/actions/shared/diagnostics/diagnosticTypes.js";

function createCollectionContext() {
  return {
    parsed: {
      raw: "contacts",
      normalized: "contacts",
      pathPart: "contacts",
      queryPart: "",
      entitySetName: "contacts",
      recordId: undefined,
      isSingleRecord: false,
      isCollection: true,
      params: [],
      select: [],
      filter: undefined,
      orderBy: [],
      top: undefined,
      expand: [],
      unknownParams: []
    },
    validationIssues: []
  };
}

suite("diagnosticActionability", () => {
  test("marks suggested fixes as preview only when apply fix is unavailable", async () => {
    const result = await runDiagnostics(createCollectionContext(), { insightLevel: 1, canApplyFix: false });

    const actionable = result.findings.filter((finding) => !!finding.suggestedQuery?.query);
    assert.ok(actionable.length > 0);
    assert.ok(actionable.every((finding) => getDiagnosticActionability(finding) === "previewOnly"));
    assert.ok(actionable.every((finding) => isActionableDiagnosticFinding(finding)));
    assert.ok(result.findings.some((finding) => finding.message.includes("$select") && getDiagnosticActionability(finding) === "none"));
  });

  test("marks suggested fixes as preview and apply when apply fix is available", async () => {
    const result = await runDiagnostics(createCollectionContext(), { insightLevel: 1, canApplyFix: true });

    const actionable = result.findings.filter((finding) => !!finding.suggestedQuery?.query);
    assert.ok(actionable.length > 0);
    assert.ok(actionable.every((finding) => getDiagnosticActionability(finding) === "previewAndApply"));
    assert.ok(actionable.every((finding) => isActionableDiagnosticFinding(finding)));
    assert.ok(result.findings.some((finding) => finding.message.includes("$select") && getDiagnosticActionability(finding) === "none"));
  });

  test("treats findings without suggested fixes as non-actionable", () => {
    const finding = {
      message: "Example diagnostic",
      severity: "info" as const
    };

    assert.strictEqual(getDiagnosticActionability(finding), "none");
    assert.strictEqual(isActionableDiagnosticFinding(finding), false);
  });
});
