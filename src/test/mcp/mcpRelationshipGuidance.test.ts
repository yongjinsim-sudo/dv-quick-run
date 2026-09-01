import * as assert from "node:assert";
import { buildRelationshipPathGuidance, classifyProbeOutcome } from "../../mcp/mcpRelationshipGuidance.js";
import { rankRelationshipPath, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

suite("mcpRelationshipGuidance", () => {
  test("describes a bridged business traversal without claiming runtime truth", () => {
    const edges: McpRelationshipEdge[] = [
      { fromTable:"contact", toTable:"msemr_careplan", navigationProperty:"msemr_contact_msemr_careplans", relationshipType:"OneToMany", direction:"oneToMany", collectionValued:true },
      { fromTable:"msemr_careplan", toTable:"msemr_careplanactivity", navigationProperty:"msemr_careplan_msemr_careplanactivities", relationshipType:"OneToMany", direction:"oneToMany", collectionValued:true },
      { fromTable:"msemr_careplanactivity", toTable:"sample_task", navigationProperty:"sample_tasks", relationshipType:"OneToMany", direction:"oneToMany", collectionValued:true }
    ];
    const guidance = buildRelationshipPathGuidance(rankRelationshipPath(edges));
    assert.strictEqual(guidance.pathShape, "Bridged");
    assert.strictEqual(guidance.recommendationBasis, "DeterministicMetadataRanking");
    assert.match(guidance.metadataPathSummary, /msemr_careplan/);
    assert.match(guidance.evidenceBoundary, /Metadata confidence covers/);
    assert.strictEqual(guidance.businessInterpretation.status, "MetadataOnlyUnknown");
    assert.match(guidance.instruction, /not as the definitive business path/);
  });

  test("locks guidance to an explicitly honoured relationship", () => {
    const edge: McpRelationshipEdge = { fromTable:"contact", toTable:"account", navigationProperty:"parentcustomerid_account", referencingAttribute:"parentcustomerid", relationshipType:"ManyToOne", direction:"manyToOne", collectionValued:false, polymorphicTargetQualified:true };
    const guidance = buildRelationshipPathGuidance(rankRelationshipPath([edge]), { relationshipHintHonoured:true });
    assert.strictEqual(guidance.recommendationBasis, "ExplicitRelationshipIntent");
    assert.match(guidance.instruction, /Do not substitute/);
  });

  test("distinguishes no continuation from an invalid metadata path", () => {
    const outcome = classifyProbeOutcome({ reachedTarget:false, completedHops:2, totalHops:3, finalRecordCount:0 });
    assert.strictEqual(outcome.status, "NoContinuationObserved");
    assert.match(outcome.meaning, /does not invalidate/);
    assert.match(outcome.nextAction, /another representative source record/);
  });

  test("reports observed targets explicitly", () => {
    const outcome = classifyProbeOutcome({ reachedTarget:true, completedHops:3, totalHops:3, finalRecordCount:4 });
    assert.strictEqual(outcome.status, "TargetObserved");
    assert.match(outcome.meaning, /all 3 verified hops/);
  });
});
