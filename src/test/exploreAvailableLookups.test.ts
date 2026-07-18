import * as assert from "assert";
import { buildAvailableLookups } from "../commands/router/actions/queryMutation/exploreAvailableLookupsAction.js";

suite("Available Lookup Discovery", () => {
  test("classifies Contact parentcustomerid as polymorphic", () => {
    const lookups = buildAvailableLookups(
      "contact",
      [{
        logicalName: "parentcustomerid",
        displayName: "Company Name",
        attributeType: "Customer",
        lookupTargets: ["account", "contact"]
      }],
      [
        { referencingAttribute: "parentcustomerid", referencedEntity: "account", referencingEntity: "contact", navigationPropertyName: "parentcustomerid_account" },
        { referencingAttribute: "parentcustomerid", referencedEntity: "contact", referencingEntity: "contact", navigationPropertyName: "parentcustomerid_contact" }
      ],
      new Map([["account", "Account"], ["contact", "Contact"]])
    );

    assert.strictEqual(lookups.length, 1);
    assert.strictEqual(lookups[0].selectToken, "_parentcustomerid_value");
    assert.strictEqual(lookups[0].isPolymorphic, true);
    assert.deepStrictEqual(
      lookups[0].targets.map((target) => target.navigationPropertyName),
      ["parentcustomerid_account", "parentcustomerid_contact"]
    );
  });

  test("classifies Account primarycontactid as standard", () => {
    const lookups = buildAvailableLookups(
      "account",
      [{
        logicalName: "primarycontactid",
        displayName: "Primary Contact",
        attributeType: "Lookup",
        lookupTargets: ["contact"]
      }],
      [{ referencingAttribute: "primarycontactid", referencedEntity: "contact", referencingEntity: "account", navigationPropertyName: "primarycontactid" }],
      new Map([["contact", "Contact"]])
    );

    assert.strictEqual(lookups.length, 1);
    assert.strictEqual(lookups[0].isPolymorphic, false);
    assert.strictEqual(lookups[0].targets[0].navigationPropertyName, "primarycontactid");
  });

  test("excludes primary keys even when metadata incorrectly labels them as lookups", () => {
    const lookups = buildAvailableLookups(
      "account",
      [{
        logicalName: "accountid",
        displayName: "Account",
        attributeType: "Lookup",
        lookupTargets: ["account"]
      }],
      [],
      new Map([["account", "Account"]]),
      "accountid"
    );

    assert.deepStrictEqual(lookups, []);
  });

  test("excludes lookup-like fields without a usable navigation property", () => {
    const lookups = buildAvailableLookups(
      "account",
      [{
        logicalName: "orphanlookupid",
        displayName: "Orphan Lookup",
        attributeType: "Lookup",
        lookupTargets: ["contact"]
      }],
      [],
      new Map([["contact", "Contact"]])
    );

    assert.deepStrictEqual(lookups, []);
  });

  test("ignores incoming relationships that reuse the same lookup attribute name", () => {
    const lookups = buildAvailableLookups(
      "contact",
      [{
        logicalName: "parentcustomerid",
        displayName: "Company Name",
        attributeType: "Customer",
        lookupTargets: ["account", "contact"]
      }],
      [
        { referencingAttribute: "parentcustomerid", referencedEntity: "account", referencingEntity: "contact", navigationPropertyName: "parentcustomerid_account" },
        { referencingAttribute: "parentcustomerid", referencedEntity: "contact", referencingEntity: "contact", navigationPropertyName: "parentcustomerid_contact" },
        { referencingAttribute: "parentcustomerid", referencedEntity: "contact", referencingEntity: "powerpagesusermapping", navigationPropertyName: "powerpagesusermapping_customer_contacts" }
      ],
      new Map([["account", "Account"], ["contact", "Contact"], ["powerpagesusermapping", "Power Pages User Mapping"]])
    );

    assert.strictEqual(lookups.length, 1);
    assert.deepStrictEqual(
      lookups[0].targets.map((target) => target.logicalName),
      ["account", "contact"]
    );
    assert.strictEqual(lookups[0].isPolymorphic, true);
  });

});
