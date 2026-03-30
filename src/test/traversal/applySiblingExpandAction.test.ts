import * as assert from "assert";
import { buildMergedSiblingExpandClause } from "../../commands/router/actions/traversal/applySiblingExpandAction.js";

suite("applySiblingExpandAction", () => {
  test("merges repeated selections for the same navigation property", () => {
    const clause = buildMergedSiblingExpandClause({
      currentEntityLogicalName: "contact",
      candidates: [
        {
          sourceEntityLogicalName: "contact",
          navigationPropertyName: "createdby",
          targetEntityLogicalName: "systemuser",
          displayLabel: "systemuser",
          relationshipType: "ManyToOne",
          isCollection: false
        }
      ],
      existingClause: "createdby($select=fullname)",
      selectedFieldSets: [
        {
          navigationPropertyName: "createdby",
          selectedFieldLogicalNames: ["address1_city", "fullname"]
        }
      ]
    });

    assert.strictEqual(clause, "createdby($select=address1_city,fullname)");
  });

  test("accumulates different navigation properties for the same leg", () => {
    const clause = buildMergedSiblingExpandClause({
      currentEntityLogicalName: "contact",
      candidates: [
        {
          sourceEntityLogicalName: "contact",
          navigationPropertyName: "createdby",
          targetEntityLogicalName: "systemuser",
          displayLabel: "systemuser",
          relationshipType: "ManyToOne",
          isCollection: false
        },
        {
          sourceEntityLogicalName: "contact",
          navigationPropertyName: "owningbusinessunit",
          targetEntityLogicalName: "businessunit",
          displayLabel: "businessunit",
          relationshipType: "ManyToOne",
          isCollection: false
        }
      ],
      existingClause: "createdby($select=fullname)",
      selectedFieldSets: [
        {
          navigationPropertyName: "owningbusinessunit",
          selectedFieldLogicalNames: ["name"]
        }
      ]
    });

    assert.strictEqual(
      clause,
      "createdby($select=fullname),owningbusinessunit($select=name)"
    );
  });
});
