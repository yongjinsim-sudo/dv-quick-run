import * as assert from "assert";
import { pathMatchesRelationshipHint, selectRelationshipPath } from "../../mcp/mcpRelationshipIntent.js";
import { rankRelationshipPaths, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

suite("mcpRelationshipIntentSelection", () => {
  const paths: McpRelationshipEdge[][] = [
    [{ fromTable: "contact", toTable: "account", navigationProperty: "account_primary_contact", relationshipSchemaName: "account_primary_contact", referencingAttribute: "primarycontactid", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true }],
    [{ fromTable: "contact", toTable: "account", navigationProperty: "parentcustomerid_account", relationshipSchemaName: "contact_customer_accounts", referencingAttribute: "parentcustomerid", relationshipType: "ManyToOne", direction: "manyToOne", collectionValued: false, polymorphicTargetQualified: true }]
  ];
  const ranked = rankRelationshipPaths(paths);

  test("honours an explicit lookup logical name over the default top-ranked path", () => {
    const selected = selectRelationshipPath(ranked, undefined, "parentcustomerid");
    assert.ok(selected);
    assert.strictEqual(selected?.hops[0].navigationProperty, "parentcustomerid_account");
  });

  test("matches navigation property and relationship schema hints", () => {
    const parent = ranked.find((path) => path.hops[0].navigationProperty === "parentcustomerid_account");
    assert.ok(parent);
    assert.strictEqual(pathMatchesRelationshipHint(parent!, "parentcustomerid_account"), true);
    assert.strictEqual(pathMatchesRelationshipHint(parent!, "contact_customer_accounts"), true);
  });

  test("returns undefined rather than silently choosing another path when a hint is not found", () => {
    assert.strictEqual(selectRelationshipPath(ranked, undefined, "missing_lookup"), undefined);
  });
});
