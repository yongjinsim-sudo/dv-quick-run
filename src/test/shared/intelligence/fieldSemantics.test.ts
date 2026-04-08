import * as assert from "assert";
import { getBaseFieldLogicalName, getBusinessSemanticBoost, isLookupBackingField } from "../../../commands/router/actions/shared/intelligence/classification/fieldSemantics.js";

suite("fieldSemantics", () => {
  test("unwraps lookup backing field names", () => {
    assert.strictEqual(getBaseFieldLogicalName("_ownerid_value"), "ownerid");
    assert.strictEqual(isLookupBackingField("_ownerid_value"), true);
  });

  test("applies stronger business boost to status-like fields", () => {
    assert.ok(getBusinessSemanticBoost("statuscode") > getBusinessSemanticBoost("new_mode"));
    assert.ok(getBusinessSemanticBoost("bu_intent") >= 2.2);
  });
});
