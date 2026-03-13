import * as assert from "assert";
import {
  findChoiceMetadataForField,
  resolveChoiceValueFromMetadata,
  matchChoiceLabelFromMetadata
} from "../../commands/router/actions/shared/valueAwareness.js";

suite("valueAwareness", () => {
  const values = [
    {
      fieldLogicalName: "statecode",
      options: [
        { value: 0, label: "Active", normalizedLabel: "active" },
        { value: 1, label: "Inactive", normalizedLabel: "inactive" }
      ]
    }
  ];

  test("finds metadata for field", () => {
    const result = findChoiceMetadataForField(values as any, "statecode");
    assert.ok(result);
    assert.strictEqual(result?.fieldLogicalName, "statecode");
  });

  test("resolves numeric choice value", () => {
    const result = resolveChoiceValueFromMetadata(values as any, "statecode", 1);
    assert.ok(result);
    assert.strictEqual(result?.option.label, "Inactive");
  });

  test("resolves string numeric choice value", () => {
    const result = resolveChoiceValueFromMetadata(values as any, "statecode", "0");
    assert.ok(result);
    assert.strictEqual(result?.option.label, "Active");
  });

  test("matches choice label", () => {
    const result = matchChoiceLabelFromMetadata(values as any, "statecode", "Inactive");
    assert.ok(result);
    assert.strictEqual(result?.option.value, 1);
  });

  test("returns undefined for unknown label", () => {
    const result = matchChoiceLabelFromMetadata(values as any, "statecode", "Archived");
    assert.strictEqual(result, undefined);
  });
});