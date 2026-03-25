import * as assert from "assert";
import { buildDiagnosticMarkdownLines } from "../../commands/router/actions/shared/diagnostics/diagnosticOutputBuilder.js";

suite("diagnosticOutputBuilder", () => {
  test("renders suggested fix details, example, and speculative note when present", () => {
    const lines = buildDiagnosticMarkdownLines({
      findings: [{
        message: "Field `msemr_active` is not recognised as a standard attribute on `contact`.",
        severity: "warning",
        suggestion: "Verify the schema name, or use the closest known field suggested by Validation.",
        suggestedFix: {
          label: "Use true or false without quotes",
          detail: "Boolean fields should be compared using the literal true or false, not a quoted string.",
          example: "msemr_active eq true",
          confidence: 0.6,
          isSpeculative: true
        },
        confidence: 0.9
      }]
    });

    assert.ok(lines.includes("    - Suggested Fix: Use true or false without quotes — Boolean fields should be compared using the literal true or false, not a quoted string."));
    assert.ok(lines.includes("    - Example: msemr_active eq true"));
    assert.ok(lines.includes("    - Note: This fix is advisory because the field or path could not be resolved confidently."));
  });

  test("groups guid and date literal mismatches under explicit root cause titles", () => {
    const lines = buildDiagnosticMarkdownLines({
      findings: [{
        message: "Field `contactid` appears to be a GUID or lookup field on `contact`, but the literal `'00000000-0000-0000-0000-000000000001'` is not a GUID.",
        severity: "warning",
        suggestion: "Use a GUID value, or apply the correct lookup/navigation filtering syntax.",
        suggestedFix: {
          label: "Use a valid GUID literal",
          detail: "GUID and lookup fields should be compared using a valid GUID-shaped value, or the filter should switch to the correct navigation pattern.",
          example: "contactid eq 00000000-0000-0000-0000-000000000000"
        },
        confidence: 0.9
      }, {
        message: "Field `createdon` appears to be a date/time field on `contact`, but the literal `'hello'` does not look like a date or datetime value.",
        severity: "warning",
        suggestion: "Use an ISO-style date or datetime literal that matches the Dataverse field type.",
        suggestedFix: {
          label: "Use an ISO-style date or datetime literal",
          detail: "Date and datetime fields are safest when filtered with an ISO-style literal that matches the Dataverse field type.",
          example: "createdon eq 2026-03-25T00:00:00Z"
        },
        confidence: 0.88
      }]
    });

    assert.ok(lines.includes("### Root Cause: Invalid GUID literal"));
    assert.ok(lines.includes("### Root Cause: Invalid date/datetime literal"));
  });

});
