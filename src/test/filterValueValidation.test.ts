import * as assert from "assert";
import { validateFilterRawValue } from "../commands/router/actions/shared/queryMutation/filterValueValidation.js";

suite("filterValueValidation", () => {
  test("accepts valid guid for lookup field", () => {
    const result = validateFilterRawValue(
      { logicalName: "ownerid", attributeType: "Lookup" },
      "7d29eec7-4414-f111-8341-6045bdc42f8b"
    );

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value, "7d29eec7-4414-f111-8341-6045bdc42f8b");
    }
  });

  test("rejects invalid guid for lookup field", () => {
    const result = validateFilterRawValue(
      { logicalName: "ownerid", attributeType: "Lookup" },
      "abc"
    );

    assert.strictEqual(result.ok, false);
  });

  test("rejects empty value", () => {
    const result = validateFilterRawValue(
      { logicalName: "fullname", attributeType: "String" },
      "   "
    );

    assert.strictEqual(result.ok, false);
  });

  test("accepts normal string", () => {
    const result = validateFilterRawValue(
      { logicalName: "fullname", attributeType: "String" },
      "O'Reilly"
    );

    assert.strictEqual(result.ok, true);
    if (result.ok) {
      assert.strictEqual(result.value, "O'Reilly");
    }
  });
});