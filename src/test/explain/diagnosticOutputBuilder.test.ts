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
    assert.ok(lines.includes("    - Suggested query: msemr_active eq true"));
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

  test("renders recommended next step with star, action, and preview query", () => {
    const lines = buildDiagnosticMarkdownLines({
      findings: [{
        message: "Observed repeated values on this result page.",
        severity: "info",
        suggestion: "Narrow on `Marital Status (familystatuscode)` using eq Married.",
        suggestedQuery: {
          query: "?$filter=familystatuscode eq 2"
        },
        narrowingSuggestions: [{
          field: "familystatuscode",
          kind: "categorical",
          rationale: "narrow on `Marital Status (familystatuscode)` using eq Married.",
          reasons: [
            "Based on 13 returned rows, this is the clearest first server-side filter.",
            "`Marital Status` shows repeated values: Married × 5, Single × 5, Divorced × 3"
          ],
          tier: "recommended"
        }, {
          field: "gendercode",
          kind: "categorical",
          rationale: "secondary repeated value pattern observed on the current result page",
          reasons: ["value Male appears 7 times"],
          tier: "secondary"
        }],
        confidence: 0.82
      }]
    });

    assert.ok(lines.includes("### ⭐ Recommended next step"));
    assert.ok(lines.includes("- Action: Narrow on `Marital Status (familystatuscode)` using eq Married."));
    assert.ok(lines.includes("- Preview query: ?$filter=familystatuscode eq 2"));
    assert.ok(lines.includes("    - Why this field:"));
    assert.ok(!lines.some((line) => line.includes("Suggestion: Recommended next step")));
  });

  test("uses action label and preview query for advisory groups without duplicating suggestion text", () => {
    const lines = buildDiagnosticMarkdownLines({
      findings: [{
        message: "Query does not specify $select.",
        severity: "warning",
        suggestion: "Add $select to reduce payload size and improve result clarity.",
        suggestedFix: {
          label: "Add a focused $select clause",
          detail: "Limit the response to the fields you actually need so the query is easier to inspect and cheaper to run.",
          example: "contacts?$select=fullname,contactid"
        },
        confidence: 0.95
      }]
    });

    assert.ok(lines.includes("### Advisory: Query shape missing $select"));
    assert.ok(lines.includes("- Action: Add $select to reduce payload size and improve result clarity."));
    assert.ok(lines.includes("- Preview query: contacts?$select=fullname,contactid"));
    assert.ok(!lines.some((line) => line.includes("Suggestion: Add $select to reduce payload size and improve result clarity.")));
  });
});
