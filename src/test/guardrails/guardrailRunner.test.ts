import * as assert from "assert";
import { runQueryGuardrailRules } from "../../commands/router/actions/shared/guardrails/queryGuardrailRunner.js";
import type { QueryGuardrailContext } from "../../commands/router/actions/shared/guardrails/queryGuardrailTypes.js";

function makeContext(overrides: Partial<QueryGuardrailContext> = {}): QueryGuardrailContext {
  return {
    parsed: {
      rawQuery: "contacts?$top=10&$select=fullname",
      normalizedQuery: "contacts?$top=10&$select=fullname",
      hadLeadingSlash: false,
      entityPath: "contacts",
      entitySetName: "contacts",
      isSingleRecordPath: false,
      isCollectionQuery: true,
      queryOptions: new URLSearchParams("$top=10&$select=fullname"),
      duplicateOptionCounts: new Map<string, number>()
    },
    knownEntitySetNames: new Set(["contacts", "accounts"]),
    ...overrides
  };
}

suite("guardrailRunner", () => {
  test("returns no issues for focused query", () => {
    const result = runQueryGuardrailRules(makeContext());

    assert.strictEqual(result.issues.length, 0);
    assert.strictEqual(result.hasWarnings, false);
    assert.strictEqual(result.hasErrors, false);
  });

  test("flags missing top on collection query", () => {
    const result = runQueryGuardrailRules(makeContext({
      parsed: {
        ...makeContext().parsed,
        rawQuery: "contacts?$select=fullname",
        normalizedQuery: "contacts?$select=fullname",
        queryOptions: new URLSearchParams("$select=fullname")
      }
    }));

    assert.ok(result.issues.some((x) => x.code === "missing-top"));
    assert.strictEqual(result.hasWarnings, true);
  });

  test("flags unknown entity as error", () => {
    const result = runQueryGuardrailRules(makeContext({
      parsed: {
        ...makeContext().parsed,
        rawQuery: "mysterytable?$top=10&$select=name",
        normalizedQuery: "mysterytable?$top=10&$select=name",
        entityPath: "mysterytable",
        entitySetName: "mysterytable"
      }
    }));

    assert.ok(result.issues.some((x) => x.code === "unknown-entity"));
    assert.strictEqual(result.hasErrors, true);
  });

  test("deduplicates repeated issues", () => {
    const result = runQueryGuardrailRules(makeContext({
      parsed: {
        ...makeContext().parsed,
        duplicateOptionCounts: new Map<string, number>([["$top", 2], ["$top", 2]])
      }
    }));

    const duplicateIssues = result.issues.filter((x) => x.code === "duplicate-single-value-option");
    assert.strictEqual(duplicateIssues.length, 1);
  });
});
