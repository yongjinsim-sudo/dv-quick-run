import * as assert from "assert";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import {
  buildChoiceValueHover,
  findChoiceMetadataForField,
  findMatchingScalarComparison,
  getSelectedRawValueForField,
  parseSimpleFilterComparisons
} from "../../providers/hover/hoverFilterAnalysis.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";

function hoverMarkdownText(hover: ReturnType<typeof buildChoiceValueHover>): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverFilterAnalysis", () => {
  test("parseSimpleFilterComparisons extracts scalar comparisons", () => {
    const comparisons = parseSimpleFilterComparisons(
      "statuscode eq 1 and contains(fullname,'john') and statecode ne 0 and donotemail eq true"
    );

    assert.deepStrictEqual(comparisons, [
      { fieldLogicalName: "statuscode", operator: "eq", rawValue: "1" },
      { fieldLogicalName: "statecode", operator: "ne", rawValue: "0" },
      { fieldLogicalName: "donotemail", operator: "eq", rawValue: "true" }
    ]);
  });

  test("getSelectedRawValueForField resolves field comparisons case-insensitively", () => {
    const parsed = parseEditorQuery("contacts?$filter=StatusCode eq 1 and statecode ne 0");
    assert.strictEqual(getSelectedRawValueForField(parsed, " statuscode "), "1");
    assert.strictEqual(getSelectedRawValueForField(parsed, "STATECODE"), "0");
  });

  test("findMatchingScalarComparison matches normalized scalar tokens", () => {
    const parsed = parseEditorQuery("contacts?$filter=statuscode eq 'Active' and statecode ne 0");
    const match = findMatchingScalarComparison(parsed, " 'Active' ");
    assert.deepStrictEqual(match, {
      fieldLogicalName: "statuscode",
      operator: "eq",
      rawValue: "'Active'"
    });
  });

  test("findChoiceMetadataForField matches field names case-insensitively", () => {
    const values: ChoiceMetadataDef[] = [
      { fieldLogicalName: "statuscode", options: [] } as unknown as ChoiceMetadataDef,
      { fieldLogicalName: "statecode", options: [] } as unknown as ChoiceMetadataDef
    ];

    const match = findChoiceMetadataForField(values, " StateCode ");
    assert.strictEqual(match?.fieldLogicalName, "statecode");
  });

  test("buildChoiceValueHover renders field, type, and meaning", () => {
    const hover = buildChoiceValueHover({
      rawValue: "1",
      fieldLogicalName: "statuscode",
      attributeType: "Status",
      label: "Active"
    });

    const markdown = hoverMarkdownText(hover);
    assert.ok(markdown.includes("**Value: `1`**"));
    assert.ok(markdown.includes("Field: `statuscode`"));
    assert.ok(markdown.includes("Type: `Status`"));
    assert.ok(markdown.includes("Meaning: **Active**"));
  });
});
