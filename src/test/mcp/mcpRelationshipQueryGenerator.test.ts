import * as assert from "assert";
import { rankRelationshipPath, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";
import { generateRelationshipQuery } from "../../mcp/mcpRelationshipQueryGenerator.js";

suite("mcpRelationshipQueryGenerator", () => {
  test("generates a direct bounded expand using verified shapes", () => {
    const edges: McpRelationshipEdge[] = [{ fromTable: "contact", toTable: "task", navigationProperty: "Contact_Tasks", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true, referencingAttribute: "regardingobjectid", polymorphicTargetQualified: true }];
    const generated = generateRelationshipQuery(rankRelationshipPath(edges), [
      { logicalName: "contact", entitySetName: "contacts", primaryIdAttribute: "contactid", primaryNameAttribute: "fullname" },
      { logicalName: "task", entitySetName: "tasks", primaryIdAttribute: "activityid", primaryNameAttribute: "subject" }
    ], "00000000-0000-0000-0000-000000000001");
    assert.strictEqual(generated.recommendedMode, "direct-expand");
    assert.ok(generated.rootQueryTemplate.includes("$expand=Contact_Tasks($select=activityid,subject)"));
    assert.ok(generated.stagedQueries[0].queryTemplate.includes("/Contact_Tasks?"));
    assert.ok(generated.variants.minimal.includes("/Contact_Tasks?"));
    assert.strictEqual(generated.variants.recommended, generated.rootQueryTemplate);
  });

  test("recommends staged traversal across an intermediate collection", () => {
    const edges: McpRelationshipEdge[] = [
      { fromTable: "contact", toTable: "careplan", navigationProperty: "contact_careplans", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true },
      { fromTable: "careplan", toTable: "task", navigationProperty: "careplan_tasks", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true }
    ];
    const generated = generateRelationshipQuery(rankRelationshipPath(edges), [
      { logicalName: "contact", entitySetName: "contacts", primaryIdAttribute: "contactid" },
      { logicalName: "careplan", entitySetName: "careplans", primaryIdAttribute: "careplanid" },
      { logicalName: "task", entitySetName: "tasks", primaryIdAttribute: "activityid" }
    ]);
    assert.strictEqual(generated.recommendedMode, "staged-traversal");
    assert.strictEqual(generated.stagedQueries.length, 2);
    assert.ok(generated.explanation.some((line) => line.includes("intermediate collection")));
  });
});
