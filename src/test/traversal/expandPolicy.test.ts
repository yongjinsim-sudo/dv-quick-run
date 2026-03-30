import * as assert from "assert";
import {
  MAX_SIBLING_EXPANDS,
  validateCandidateForSiblingExpand,
  validateExpandPlan,
  validateSelectedExpandFields
} from "../../commands/router/actions/shared/expand/expandPolicy.js";
import type { ExpandCandidate, ExpandPlan } from "../../commands/router/actions/shared/expand/expandTypes.js";

suite("expandPolicy", () => {
  test("rejects collection-valued sibling expand candidates", () => {
    const candidate: ExpandCandidate = {
      sourceEntityLogicalName: "contact",
      navigationPropertyName: "contact_accounts",
      targetEntityLogicalName: "account",
      relationshipType: "OneToMany",
      isCollection: true,
      displayLabel: "contact_accounts"
    };

    assert.strictEqual(
      validateCandidateForSiblingExpand(candidate),
      "Collection expansions are not supported for sibling expand."
    );
  });

  test("requires at least one selected field", () => {
    assert.strictEqual(
      validateSelectedExpandFields({
        navigationPropertyName: "createdby",
        selectedFieldLogicalNames: []
      }),
      "At least one field must be selected."
    );
  });

  test("blocks sibling plans above the configured maximum", () => {
    const plan: ExpandPlan = {
      kind: "sibling",
      sourceEntityLogicalName: "contact",
      entries: Array.from({ length: MAX_SIBLING_EXPANDS + 1 }, (_, index) => ({
        navigationPropertyName: `nav${index + 1}`,
        targetEntityLogicalName: `entity${index + 1}`,
        selectedFieldLogicalNames: ["name"],
        depth: 0
      }))
    };

    assert.strictEqual(
      validateExpandPlan(plan),
      `A maximum of ${MAX_SIBLING_EXPANDS} sibling expands are allowed per step.`
    );
  });

  test("blocks nested depth for sibling plans", () => {
    const plan: ExpandPlan = {
      kind: "sibling",
      sourceEntityLogicalName: "contact",
      entries: [
        {
          navigationPropertyName: "createdby",
          targetEntityLogicalName: "systemuser",
          selectedFieldLogicalNames: ["fullname"],
          depth: 1
        }
      ]
    };

    assert.strictEqual(
      validateExpandPlan(plan),
      "Sibling expand only supports one expand level."
    );
  });
});
