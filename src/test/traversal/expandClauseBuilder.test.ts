import * as assert from "assert";
import { buildExpandClause } from "../../commands/router/actions/shared/expand/expandClauseBuilder.js";
import type { ExpandPlan } from "../../commands/router/actions/shared/expand/expandTypes.js";

suite("expandClauseBuilder", () => {
  test("builds a comma-separated sibling expand clause", () => {
    const plan: ExpandPlan = {
      kind: "sibling",
      sourceEntityLogicalName: "contact",
      entries: [
        {
          navigationPropertyName: "createdby",
          targetEntityLogicalName: "systemuser",
          selectedFieldLogicalNames: ["fullname", "systemuserid"],
          depth: 0
        },
        {
          navigationPropertyName: "owningteam",
          targetEntityLogicalName: "team",
          selectedFieldLogicalNames: ["name"],
          depth: 0
        }
      ]
    };

    assert.strictEqual(
      buildExpandClause(plan),
      "createdby($select=fullname,systemuserid),owningteam($select=name)"
    );
  });
});
