import * as assert from "assert";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import {
  buildChoiceRefinementOptions,
  buildFilterReplacementPreviewQuery,
  resolveDeterministicReplaceFilterValueIntent
} from "../../refinement/filterValueReplacement.js";

suite("filterValueReplacement", () => {
  test("builds deterministic intent for a single eq filter", () => {
    const intent = resolveDeterministicReplaceFilterValueIntent(
      parseEditorQuery("contacts?$select=fullname&$filter=statuscode eq 1&$top=5"),
      "statuscode",
      "1",
      "2"
    );

    assert.ok(intent);
    assert.strictEqual(intent?.fieldLogicalName, "statuscode");
    assert.strictEqual(intent?.oldValue, "1");
    assert.strictEqual(intent?.newValue, "2");
  });

  test("supports deterministic replacement inside a multi-clause filter when the target comparison is unique", () => {
    const intent = resolveDeterministicReplaceFilterValueIntent(
      parseEditorQuery("contacts?$filter=statuscode eq 1 and statecode eq 0"),
      "statuscode",
      "1",
      "2"
    );

    assert.ok(intent);
    assert.strictEqual(intent?.fieldLogicalName, "statuscode");
    assert.strictEqual(intent?.oldValue, "1");
    assert.strictEqual(intent?.newValue, "2");
  });

  test("builds preview query semantically using the shared query mutation pipeline", () => {
    const preview = buildFilterReplacementPreviewQuery(
      "contacts?$select=fullname&$filter=statuscode eq 1&$top=5",
      {
        type: "replaceFilterValue",
        fieldLogicalName: "statuscode",
        oldValue: "1",
        newValue: "2"
      }
    );

    assert.ok(preview.startsWith("contacts?"));
    assert.ok(preview.includes("$select=fullname"));
    assert.ok(preview.includes("$filter=statuscode eq 2"));
    assert.ok(preview.includes("$top=5"));
  });

  test("replaces only the matching deterministic comparison inside a multi-clause filter", () => {
    const preview = buildFilterReplacementPreviewQuery(
      "contacts?$filter=statuscode eq 1 and statecode eq 0",
      {
        type: "replaceFilterValue",
        fieldLogicalName: "statecode",
        oldValue: "0",
        newValue: "1"
      }
    );

    assert.ok(preview.includes("$filter=statuscode eq 1 and statecode eq 1"));
  });

  test("builds preview links for boolean and numeric values", () => {
    const options = buildChoiceRefinementOptions({
      parsed: parseEditorQuery("contacts?$filter=donotemail eq true"),
      hoveredWord: "true",
      fieldLogicalName: "donotemail",
      options: [
        { label: "Yes", value: true },
        { label: "No", value: false }
      ],
      documentUri: { toString: () => "file:///tmp/test.http" } as any,
      lineNumber: 3
    });

    assert.strictEqual(options?.length, 1);
    assert.ok(options?.[0]?.commandUri.includes("dvQuickRun.previewReplaceFilterValueAtLine"));
    assert.ok(options?.[0]?.commandUri.includes("false"));
  });
});
