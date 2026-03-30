import * as assert from "assert";
import { buildSiblingExpandPlan } from "../../commands/router/actions/shared/expand/expandPlanBuilder.js";
import type { ExpandCandidate, SelectedExpandFieldSet } from "../../commands/router/actions/shared/expand/expandTypes.js";

suite("expandPlanBuilder", () => {
  test("merges duplicate navigation property selections and sorts fields", () => {
    const candidates: ExpandCandidate[] = [
      {
        sourceEntityLogicalName: "contact",
        navigationPropertyName: "createdby",
        targetEntityLogicalName: "systemuser",
        relationshipType: "ManyToOne",
        isCollection: false,
        displayLabel: "createdby"
      }
    ];

    const selectedFields: SelectedExpandFieldSet[] = [
      {
        navigationPropertyName: "createdby",
        selectedFieldLogicalNames: ["internalemailaddress", "fullname"]
      },
      {
        navigationPropertyName: "CREATEDBY",
        selectedFieldLogicalNames: ["fullname", "systemuserid"]
      }
    ];

    const plan = buildSiblingExpandPlan("contact", candidates, selectedFields);

    assert.strictEqual(plan.entries.length, 1);
    assert.deepStrictEqual(plan.entries[0]?.selectedFieldLogicalNames, [
      "fullname",
      "internalemailaddress",
      "systemuserid"
    ]);
  });

  test("throws when an unknown candidate is selected", () => {
    assert.throws(
      () => buildSiblingExpandPlan(
        "contact",
        [],
        [
          {
            navigationPropertyName: "createdby",
            selectedFieldLogicalNames: ["fullname"]
          }
        ]
      ),
      /Unknown expand candidate: createdby/
    );
  });
  test("preserves multiple navigation properties when building an additive sibling expand plan", () => {
    const candidates: ExpandCandidate[] = [
      {
        sourceEntityLogicalName: "contact",
        navigationPropertyName: "createdby",
        targetEntityLogicalName: "systemuser",
        relationshipType: "ManyToOne",
        isCollection: false,
        displayLabel: "createdby"
      },
      {
        sourceEntityLogicalName: "contact",
        navigationPropertyName: "parentcustomerid_account",
        targetEntityLogicalName: "account",
        relationshipType: "ManyToOne",
        isCollection: false,
        displayLabel: "parentcustomerid_account"
      }
    ];

    const selectedFields: SelectedExpandFieldSet[] = [
      {
        navigationPropertyName: "createdby",
        selectedFieldLogicalNames: ["fullname"]
      },
      {
        navigationPropertyName: "parentcustomerid_account",
        selectedFieldLogicalNames: ["accountnumber"]
      }
    ];

    const plan = buildSiblingExpandPlan("contact", candidates, selectedFields);

    assert.deepStrictEqual(
      plan.entries.map((entry) => entry.navigationPropertyName),
      ["createdby", "parentcustomerid_account"]
    );
  });

});
