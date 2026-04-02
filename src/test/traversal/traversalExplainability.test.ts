import * as assert from "assert";
import {
  buildLegExplanationLines,
  buildNoResultGuidanceLines,
  buildRouteExplanationLines,
  buildTraversalBannerContext
} from "../../commands/router/actions/traversal/traversalExplainability.js";
import type { TraversalExecutionPlan, TraversalExecutionStep, TraversalRoute } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildRoute(): TraversalRoute {
  return {
    routeId: "account-contact",
    sourceEntity: "account",
    targetEntity: "contact",
    entities: ["account", "systemuser", "contact"],
    edges: [
      {
        fromEntity: "account",
        toEntity: "systemuser",
        navigationPropertyName: "createdby",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        referencingAttribute: "createdby"
      },
      {
        fromEntity: "systemuser",
        toEntity: "contact",
        navigationPropertyName: "primarycontactid",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        referencingAttribute: "primarycontactid"
      }
    ],
    hopCount: 2,
    confidence: "high"
  };
}

function buildStep(): TraversalExecutionStep {
  return {
    stepNumber: 1,
    fromEntity: "account",
    toEntity: "systemuser",
    entities: ["account", "systemuser"],
    edges: [
      {
        fromEntity: "account",
        toEntity: "systemuser",
        navigationPropertyName: "createdby",
        relationshipType: "ManyToOne",
        direction: "manyToOne",
        referencingAttribute: "createdby"
      }
    ],
    hopCount: 1,
    stageLabel: "account → systemuser"
  };
}

function buildPlan(): TraversalExecutionPlan {
  return {
    planId: "compact",
    label: "Compact",
    rationale: "test",
    steps: [
      buildStep(),
      {
        stepNumber: 2,
        fromEntity: "systemuser",
        toEntity: "contact",
        entities: ["systemuser", "contact"],
        edges: [
          {
            fromEntity: "systemuser",
            toEntity: "contact",
            navigationPropertyName: "primarycontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "primarycontactid"
          }
        ],
        hopCount: 1,
        stageLabel: "systemuser → contact"
      }
    ]
  };
}

suite("traversalExplainability", () => {
  test("builds verbose route explanation with sql hints", () => {
    const lines = buildRouteExplanationLines(buildRoute(), "verbose");

    assert.ok(lines.some((line) => line.includes("Traversal route selected")));
    assert.ok(lines.some((line) => line.includes("SQL mental model")));
    assert.ok(lines.some((line) => line.includes("account.createdby = systemuser.systemuserid")));
  });

  test("builds minimal leg explanation", () => {
    const lines = buildLegExplanationLines({
      itinerary: buildPlan(),
      step: buildStep(),
      stepIndex: 0,
      rowCount: 11,
      verbosity: "minimal"
    });

    assert.ok(lines[0]?.includes("Traversal leg summary: 1/2 account → systemuser via createdby."));
    assert.ok(lines.some((line) => line.includes("Rows returned: 11.")));
    assert.ok(lines.some((line) => line.includes("Next step: systemuser → contact.")));
  });

  test("turns banner off when verbosity is off", () => {
    const banner = buildTraversalBannerContext({
      itinerary: buildPlan(),
      currentStepIndex: 0,
      currentEntityName: "systemuser",
      requiredCarryField: "systemuserid",
      canSiblingExpand: true,
      verbosity: "off"
    });

    assert.strictEqual(banner.showBanner, false);
  });

  test("builds explicit no-result guidance", () => {
    const lines = buildNoResultGuidanceLines({
      step: buildStep(),
      verbosity: "verbose"
    });

    assert.ok(lines.some((line) => line.includes("valid routes do not guarantee matching data")));
  });
});
