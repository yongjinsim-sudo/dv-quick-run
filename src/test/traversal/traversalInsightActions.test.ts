import * as assert from "assert";
import { appendTraversalInsightActions } from "../../commands/router/actions/shared/traversal/traversalInsightActions.js";
import type {
  TraversalExecutionPlan,
  TraversalExecutionStep,
  TraversalRoute,
  TraversalStepExecutionPlan
} from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildRoute(): TraversalRoute {
  return {
    routeId: "account-activityparty-task",
    sourceEntity: "account",
    targetEntity: "task",
    entities: ["account", "activityparty", "task"],
    edges: [
      {
        fromEntity: "account",
        toEntity: "activityparty",
        navigationPropertyName: "account_activity_parties",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        referencingAttribute: "partyid"
      },
      {
        fromEntity: "activityparty",
        toEntity: "task",
        navigationPropertyName: "activityid_task",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        referencingAttribute: "activityid"
      }
    ],
    hopCount: 2,
    confidence: "high"
  };
}

function buildItinerary(step: TraversalExecutionStep): TraversalExecutionPlan {
  return {
    planId: "mixed",
    label: "Mixed",
    rationale: "balanced",
    steps: [step]
  };
}

function buildStepExecutionPlan(): TraversalStepExecutionPlan {
  return {
    mode: "direct",
    mainMissionTarget: "activityparty",
    queries: [],
    rationale: ["test"],
    usedFallback: false,
    enrichmentCandidates: [
      {
        sourceEntity: "activityparty",
        targetEntity: "task",
        relationshipName: "activityid_task",
        kind: "reference",
        rationale: "available after landing"
      }
    ]
  };
}

suite("traversalInsightActions", () => {
  test("appends current-leg-only actions for manual testing", () => {
    const step: TraversalExecutionStep = {
      stepNumber: 1,
      fromEntity: "account",
      toEntity: "activityparty",
      entities: ["account", "activityparty"],
      edges: buildRoute().edges.slice(0, 1),
      hopCount: 1,
      stageLabel: "account → activityparty"
    };

    const actions = appendTraversalInsightActions({
      route: buildRoute(),
      itinerary: buildItinerary(step),
      step,
      executionPlan: buildStepExecutionPlan(),
      landing: {
        entityName: "activityparty",
        ids: ["ap-1"]
      }
    });

    assert.ok(actions.length >= 2);
    assert.strictEqual(actions.every((action) => action.appliesToCurrentLegOnly), true);
    assert.strictEqual(actions[0]?.title, "Enhance with task");
    assert.ok(actions.some((action) => action.actionId === "traversal.insight.manual-merge-preview"));
  });
});
