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
  test("builds verbose route explanation without sql hints", () => {
    const lines = buildRouteExplanationLines(buildRoute(), "verbose");

    assert.ok(lines.every((line) => !line.includes("Traversal route selected")));
    assert.ok(lines.some((line) => line.includes("Route meaning:")));
    assert.ok(lines.some((line) => line.includes("This path will follow createdby from account to systemuser, then follow primarycontactid from systemuser to contact.")));
    assert.ok(lines.every((line) => !line.includes("SQL mental model")));
  });

  test("builds minimal leg explanation", () => {
    const lines = buildLegExplanationLines({
      itinerary: buildPlan(),
      step: buildStep(),
      stepIndex: 0,
      rowCount: 11,
      verbosity: "minimal"
    });

    assert.ok(lines[0]?.includes("Step 1/2: account → systemuser"));
    assert.ok(lines.some((line) => line.includes("Rows: 11")));
    assert.ok(lines.some((line) => line.includes("Next: systemuser → contact")));
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
