import * as assert from "assert";
import { buildRuntimeObservation, rankRuntimeObservations, relationshipPathFamily, selectDiverseRelationshipPaths } from "../../mcp/mcpRelationshipRuntimeEvidence.js";
import { rankRelationshipPath, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

function edge(fromTable: string, toTable: string, navigationProperty: string, referencingAttribute?: string): McpRelationshipEdge {
  return { fromTable, toTable, navigationProperty, referencingAttribute, relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true, polymorphicTargetQualified: true };
}

suite("MCP relationship runtime evidence", () => {
  const regarding = rankRelationshipPath([edge("contact", "task", "Contact_Tasks", "regardingobjectid")]);
  const role = rankRelationshipPath([edge("contact", "task", "msemr_contact_task_PerformerOwnerPatient", "msemr_performerownerpatient")]);
  const carePlan = rankRelationshipPath([
    edge("contact", "msemr_careplan", "msemr_contact_msemr_careplans"),
    edge("msemr_careplan", "msemr_careplanactivity", "msemr_careplanactivities"),
    edge("msemr_careplanactivity", "sample_task", "sample_tasks")
  ]);

  test("groups materially different path families", () => {
    assert.strictEqual(relationshipPathFamily(regarding), "direct-activity-regarding");
    assert.strictEqual(relationshipPathFamily(role), "direct-role-specific");
    assert.strictEqual(relationshipPathFamily(carePlan), "bridged-care-plan-workflow");
    const selected = selectDiverseRelationshipPaths([regarding, role, carePlan], { maxFamilies: 3, maxCandidates: 3 });
    assert.deepStrictEqual(selected.map((path) => path.pathId), [regarding.pathId, role.pathId, carePlan.pathId]);
  });

  test("preserves a bridged workflow family when direct paths dominate metadata ranking", () => {
    const directPaths = Array.from({ length: 12 }, (_, index) =>
      rankRelationshipPath([edge("contact", "task", `contact_task_role_${index}`, `taskrole${index}`)])
    );
    const selected = selectDiverseRelationshipPaths([...directPaths, carePlan], { maxFamilies: 5, maxCandidates: 5 });
    assert.ok(selected.some((path) => path.pathId === carePlan.pathId), "a materially different workflow bridge must survive the candidate budget");
  });

  test("raises an observed workflow above an empty metadata leader for the investigation only", () => {
    const empty = buildRuntimeObservation({ path: regarding, reachedTarget: false, completedHops: 1, intermediateRowsObserved: 0, finalTargetRecordCount: 0 });
    const observed = buildRuntimeObservation({ path: carePlan, reachedTarget: true, completedHops: 3, intermediateRowsObserved: 4, finalTargetRecordCount: 3 });
    const ranked = rankRuntimeObservations([empty, observed]);
    assert.strictEqual(ranked[0].pathId, carePlan.pathId);
    assert.strictEqual(regarding.score, 100, "metadata score remains unchanged");
    assert.strictEqual(empty.runtimeEvidenceScore, -10);
    assert.ok(observed.runtimeEvidenceScore > 30);
  });

  test("does not claim a runtime recommendation when every candidate is empty", () => {
    const observations = [regarding, role].map((path) => buildRuntimeObservation({ path, reachedTarget: false, completedHops: 1, intermediateRowsObserved: 0, finalTargetRecordCount: 0 }));
    assert.strictEqual(rankRuntimeObservations(observations).some((item) => item.reachedTarget), false);
  });
});
