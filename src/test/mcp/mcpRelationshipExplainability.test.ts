import * as assert from "node:assert";
import { describeRelationshipPurpose, explainRelationshipPath } from "../../mcp/mcpRelationshipExplainability.js";
import { rankRelationshipPath, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

suite("mcpRelationshipExplainability", () => {
  test("explains parentcustomerid as CRM parent customer", () => {
    const edge: McpRelationshipEdge = { fromTable:"contact", toTable:"account", navigationProperty:"parentcustomerid_account", relationshipSchemaName:"contact_customer_accounts", referencingAttribute:"parentcustomerid", relationshipType:"ManyToOne", direction:"manyToOne", collectionValued:false, polymorphicTargetQualified:true };
    const purpose = describeRelationshipPurpose(edge);
    assert.strictEqual(purpose.category, "CRM");
    assert.strictEqual(purpose.label, "Parent customer");
    assert.strictEqual(purpose.categoryLabel, "CRM Relationship");
  });

  test("reports explicit intent and direct-path confidence", () => {
    const edge: McpRelationshipEdge = { fromTable:"contact", toTable:"account", navigationProperty:"parentcustomerid_account", referencingAttribute:"parentcustomerid", relationshipType:"ManyToOne", direction:"manyToOne", collectionValued:false, polymorphicTargetQualified:true };
    const result = explainRelationshipPath(rankRelationshipPath([edge]), { relationshipHintHonoured:true, rank:1 });
    assert.strictEqual(result.confidence, 100);
    assert.strictEqual(result.confidenceKind, "MetadataConfidence");
    assert.strictEqual(result.businessConfidence, "UnknownFromMetadata");
    assert.ok(result.whySelected.some((item) => item.includes("Explicit relationship intent")));
    assert.strictEqual(result.rating, 5);
    assert.strictEqual(result.ratingStars, "★★★★★");
    assert.strictEqual(result.confidenceDisplay, "★★★★★ Very High");
  });
});
