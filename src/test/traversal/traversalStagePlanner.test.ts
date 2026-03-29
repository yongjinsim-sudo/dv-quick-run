import * as assert from "assert";
import {
  buildPlannedTraversal,
  buildTraversalStages
} from "../../commands/router/actions/shared/traversal/traversalStagePlanner.js";
import type { TraversalPath } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildTwoHopPath(): TraversalPath {
  return {
    pathId: "account-sla-contact",
    hops: 2,
    confidence: "medium",
    summaryLabel: "account → sla → contact",
    legs: [
      {
        legNumber: 1,
        fromEntity: "account",
        toEntity: "sla",
        viaRelationship: "sla_account_sla",
        fromField: "accountid",
        toField: "accountid",
        queryTemplate: "accounts?$select=accountid,name",
        requiredValueField: "accountid",
        nextPlaceholder: "LEG1_ACCOUNTID",
        isFinal: false
      },
      {
        legNumber: 2,
        fromEntity: "sla",
        toEntity: "contact",
        viaRelationship: "manualsla_contact",
        fromField: "contactid",
        toField: "contactid",
        queryTemplate: "slas?$select=slaid,name,contactid&$filter=accountid eq {{LEG1_ACCOUNTID}}",
        requiredValueField: "contactid",
        nextPlaceholder: "LEG2_CONTACTID",
        isFinal: false
      },
      {
        legNumber: 3,
        fromEntity: "contact",
        toEntity: "contact",
        viaRelationship: "manualsla_contact",
        fromField: "contactid",
        toField: "contactid",
        queryTemplate: "contacts?$select=contactid,fullname&$filter=contactid eq {{LEG2_CONTACTID}}",
        requiredValueField: "contactid",
        isFinal: true
      }
    ]
  };
}

suite("traversalStagePlanner", () => {
  test("collapses a two-hop path into one execution stage", () => {
    const path = buildTwoHopPath();
    const stages = buildTraversalStages(path);

    assert.strictEqual(stages.length, 1);
    assert.strictEqual(stages[0]?.stageNumber, 1);
    assert.strictEqual(stages[0]?.fromEntity, "account");
    assert.strictEqual(stages[0]?.toEntity, "contact");
    assert.strictEqual(stages[0]?.relationshipHops, 2);
    assert.strictEqual(stages[0]?.stageLabel, "account → contact");
  });

  test("buildPlannedTraversal preserves original path and adds stages", () => {
    const path = buildTwoHopPath();
    const planned = buildPlannedTraversal(path);

    assert.strictEqual(planned.path.pathId, path.pathId);
    assert.strictEqual(planned.stages.length, 1);
    assert.strictEqual(
      planned.stages[0]?.hopRelationships.join(" → "),
      "sla_account_sla → manualsla_contact → manualsla_contact"
    );
  });
});