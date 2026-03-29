import * as assert from "assert";
import { buildTraversalPlan } from "../../commands/router/actions/shared/traversal/traversalPathEngine.js";
import type { TraversalGraph } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildGraph(): TraversalGraph {
  return {
    entities: {
      account: {
        logicalName: "account",
        entitySetName: "accounts",
        primaryIdAttribute: "accountid",
        primaryNameAttribute: "name",
        fieldLogicalNames: ["accountid", "name", "primarycontactid"],
        outboundRelationships: [
          {
            fromEntity: "account",
            toEntity: "contact",
            navigationPropertyName: "primarycontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "primarycontactid"
          },
          {
            fromEntity: "account",
            toEntity: "opportunity",
            navigationPropertyName: "opportunity_customer_accounts",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            referencingAttribute: "customerid"
          }
        ]
      },
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["contactid", "fullname"],
        outboundRelationships: [
          {
            fromEntity: "contact",
            toEntity: "account",
            navigationPropertyName: "parentcustomerid_account",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "parentcustomerid"
          }
        ]
      },
      opportunity: {
        logicalName: "opportunity",
        entitySetName: "opportunities",
        primaryIdAttribute: "opportunityid",
        primaryNameAttribute: "name",
        fieldLogicalNames: ["opportunityid", "name", "parentcontactid", "customerid"],
        outboundRelationships: [
          {
            fromEntity: "opportunity",
            toEntity: "contact",
            navigationPropertyName: "parentcontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "parentcontactid"
          },
          {
            fromEntity: "opportunity",
            toEntity: "account",
            navigationPropertyName: "customerid_account",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "customerid"
          }
        ]
      },
      lead: {
        logicalName: "lead",
        entitySetName: "leads",
        primaryIdAttribute: "leadid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["leadid", "fullname"],
        outboundRelationships: []
      }
    }
  };
}

suite("traversalPathEngine", () => {
  test("builds a direct one-hop candidate path", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "contact"
    });

    assert.strictEqual(result.candidatePaths.length, 2);
    assert.strictEqual(result.candidatePaths[0]?.hops, 1);
    assert.strictEqual(result.candidatePaths[0]?.legs.length, 2);
    assert.strictEqual(result.candidatePaths[0]?.summaryLabel, "account → primarycontactid → contact");
  });

  test("builds a valid two-hop candidate path", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "contact"
    });

    const twoHop = result.candidatePaths.find((path) => path.hops === 2);

    assert.ok(twoHop);
    assert.strictEqual(twoHop?.legs.length, 3);
    assert.strictEqual(twoHop?.legs[0]?.requiredValueField, "accountid");
    assert.strictEqual(twoHop?.legs[1]?.requiredValueField, "parentcontactid");
    assert.strictEqual(twoHop?.legs[2]?.isFinal, true);
  });

  test("prefers fewer hops first", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "contact"
    });

    assert.strictEqual(result.candidatePaths[0]?.hops, 1);
    assert.strictEqual(result.candidatePaths[1]?.hops, 2);
  });

  test("returns no candidates when no valid path exists", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "lead",
      targetEntity: "account"
    });

    assert.strictEqual(result.candidatePaths.length, 0);
  });

  test("does not create duplicate paths from cyclic metadata", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "contact",
      targetEntity: "account"
    });

    assert.strictEqual(result.candidatePaths.length, 1);
    assert.strictEqual(result.candidatePaths[0]?.hops, 1);
  });

  test("generates visible query templates per leg", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "contact"
    });

    const direct = result.candidatePaths[0];

    assert.strictEqual(
      direct?.legs[0]?.queryTemplate,
      "accounts?$select=accountid,name,primarycontactid"
    );

    assert.strictEqual(
      direct?.legs[1]?.queryTemplate,
      "contacts?$select=contactid,fullname&$filter=contactid eq {{LEG1_PRIMARYCONTACTID}}"
    );
  });

  test("uses source primary id for one-to-many continuation", () => {
    const result = buildTraversalPlan(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "contact"
    });

    const twoHop = result.candidatePaths.find((path) => path.hops === 2);

    assert.strictEqual(twoHop?.legs[0]?.requiredValueField, "accountid");
    assert.strictEqual(
      twoHop?.legs[1]?.queryTemplate,
      "opportunities?$select=opportunityid,name,parentcontactid&$filter=customerid eq {{LEG1_ACCOUNTID}}"
    );
  });
});