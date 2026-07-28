import * as assert from "assert";
import { findRelationshipPaths, rankRelationshipPaths, type McpRelationshipGraph } from "../../mcp/mcpRelationshipIntelligence.js";

suite("mcpRelationshipIntelligence", () => {
  const graph: McpRelationshipGraph = {
    nodes: ["contact", "careplan", "careplanactivity", "task", "activitypointer"],
    edges: [
      { fromTable: "contact", toTable: "careplan", navigationProperty: "contact_careplans", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true },
      { fromTable: "careplan", toTable: "careplanactivity", navigationProperty: "careplan_activities", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true },
      { fromTable: "careplanactivity", toTable: "task", navigationProperty: "activity_task", relationshipType: "ManyToOne", direction: "manyToOne", collectionValued: false, referencingAttribute: "taskid" },
      { fromTable: "contact", toTable: "activitypointer", navigationProperty: "contact_activities", relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true },
      { fromTable: "activitypointer", toTable: "task", navigationProperty: "activity_task", relationshipType: "ManyToOne", direction: "manyToOne", collectionValued: false }
    ]
  };

  test("finds bounded bridge paths without cycles", () => {
    const paths = findRelationshipPaths(graph, "contact", "task", { maxDepth: 4, maxPaths: 10 });
    assert.strictEqual(paths.length, 2);
    assert.ok(paths.some((path) => path.map((edge) => edge.toTable).join("/") === "careplan/careplanactivity/task"));
  });

  test("penalises generic activity detours deterministically", () => {
    const ranked = rankRelationshipPaths(findRelationshipPaths(graph, "contact", "task", { maxDepth: 4 }));
    assert.deepStrictEqual(ranked[0].tables, ["contact", "careplan", "careplanactivity", "task"]);
    assert.strictEqual(ranked[0].scoreKind, "DeterministicTraversalScore");
    assert.ok(ranked[1].penalties.some((reason) => reason.code === "generic_activity_detour"));
  });
});
