import * as assert from "assert";
import { buildStepExecutionPlan } from "../../commands/router/actions/shared/traversal/traversalStepExecutor.js";
import type { TraversalExecutionPlan, TraversalExecutionStep, TraversalGraph } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildGraph(): TraversalGraph {
  return {
    entities: {
      account: {
        logicalName: "account",
        entitySetName: "accounts",
        primaryIdAttribute: "accountid",
        primaryNameAttribute: "name",
        fieldLogicalNames: ["accountid", "name", "primarycontactid"],
        outboundRelationships: []
      },
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["contactid", "fullname", "createdby"],
        outboundRelationships: []
      },
      systemuser: {
        logicalName: "systemuser",
        entitySetName: "systemusers",
        primaryIdAttribute: "systemuserid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: ["systemuserid", "fullname"],
        outboundRelationships: []
      }
    }
  };
}

function buildItinerary(step: TraversalExecutionStep): TraversalExecutionPlan {
  return {
    planId: "compact",
    label: "Compact",
    rationale: "test",
    steps: [step]
  };
}

suite("traversalStepExecutor sibling expand", () => {
  test("injects sibling expand at the landed node for direct routes", () => {
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "account",
      toEntity: "contact",
      entities: ["account", "contact"],
      edges: [
        {
          fromEntity: "account",
          toEntity: "contact",
          navigationPropertyName: "primarycontactid",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "primarycontactid"
        }
      ],
      hopCount: 1,
      stageLabel: "account → contact"
    };

    const plan = buildStepExecutionPlan(
      buildGraph(),
      buildItinerary(step),
      step,
      undefined,
      1,
      "createdby($select=fullname)"
    );

    assert.strictEqual(plan.mode, "direct");
    assert.strictEqual(
      plan.queries[0]?.queryPath,
      "accounts?$select=accountid,name&$expand=primarycontactid($select=contactid,fullname;$expand=createdby($select=fullname))"
    );
  });

  test("injects sibling expand at the final landed node for nested routes", () => {
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "account",
      toEntity: "systemuser",
      entities: ["account", "contact", "systemuser"],
      edges: [
        {
          fromEntity: "account",
          toEntity: "contact",
          navigationPropertyName: "primarycontactid",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "primarycontactid"
        },
        {
          fromEntity: "contact",
          toEntity: "systemuser",
          navigationPropertyName: "createdby",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "createdby"
        }
      ],
      hopCount: 2,
      stageLabel: "account → contact → systemuser"
    };

    const plan = buildStepExecutionPlan(
      buildGraph(),
      buildItinerary(step),
      step,
      undefined,
      1,
      "owningbusinessunit($select=name)"
    );

    assert.strictEqual(plan.mode, "nested_expand");
    assert.strictEqual(
      plan.queries[0]?.queryPath,
      "accounts?$select=accountid,name&$expand=primarycontactid($select=contactid,fullname;$expand=createdby($select=systemuserid,fullname;$expand=owningbusinessunit($select=name)))"
    );
  });
  test("applies continuation filter for nested routes when replaying from a selected landed row", () => {
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "contact",
      toEntity: "systemuser",
      entities: ["contact", "systemuser"],
      edges: [
        {
          fromEntity: "contact",
          toEntity: "systemuser",
          navigationPropertyName: "createdby",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "createdby"
        }
      ],
      hopCount: 1,
      stageLabel: "contact → systemuser"
    };

    const plan = buildStepExecutionPlan(
      buildGraph(),
      buildItinerary(step),
      step,
      { entityName: "contact", ids: ["contact-1"] },
      1
    );

    assert.strictEqual(plan.mode, "direct");
    assert.strictEqual(
      plan.queries[0]?.queryPath,
      "contacts?$select=contactid,fullname&$filter=contactid eq 'contact-1'&$expand=createdby($select=systemuserid,fullname)"
    );
  });

  test("applies continuation filter for nested expand routes when replaying from a selected landed row", () => {
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "contact",
      toEntity: "systemuser",
      entities: ["contact", "systemuser", "account"],
      edges: [
        {
          fromEntity: "contact",
          toEntity: "systemuser",
          navigationPropertyName: "createdby",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "createdby"
        },
        {
          fromEntity: "systemuser",
          toEntity: "account",
          navigationPropertyName: "owningbusinessunit",
          relationshipType: "ManyToOne",
          direction: "manyToOne",
          referencingAttribute: "owningbusinessunit"
        }
      ],
      hopCount: 2,
      stageLabel: "contact → systemuser → account"
    };

    const graph = buildGraph();
    graph.entities.account.fieldLogicalNames = ["accountid", "name"];

    const plan = buildStepExecutionPlan(
      graph,
      buildItinerary(step),
      step,
      { entityName: "contact", ids: ["contact-1"] },
      1
    );

    assert.strictEqual(plan.mode, "nested_expand");
    assert.strictEqual(
      plan.queries[0]?.queryPath,
      "contacts?$select=contactid,fullname&$filter=contactid eq 'contact-1'&$expand=createdby($select=systemuserid,fullname;$expand=owningbusinessunit($select=accountid,name))"
    );
  });

});
