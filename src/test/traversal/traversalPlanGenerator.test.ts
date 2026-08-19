import * as assert from "assert";
import {
  analyzeTraversalBreakpoints,
  buildPlannedTraversalRoute,
  buildTraversalExecutionPlans
} from "../../commands/router/actions/shared/traversal/traversalPlanGenerator.js";
import type { TraversalRoute } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildRoute(): TraversalRoute {
  return {
    routeId: "account-contact-patient-careplans-tasks",
    sourceEntity: "account",
    targetEntity: "tasks",
    entities: ["account", "contact", "patient", "careplans", "tasks"],
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
        toEntity: "patient",
        navigationPropertyName: "contact_patient",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        referencingAttribute: "contactid"
      },
      {
        fromEntity: "patient",
        toEntity: "careplans",
        navigationPropertyName: "patient_careplans",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        referencingAttribute: "patientid"
      },
      {
        fromEntity: "careplans",
        toEntity: "tasks",
        navigationPropertyName: "careplan_tasks",
        relationshipType: "OneToMany",
        direction: "oneToMany",
        referencingAttribute: "careplanid"
      }
    ],
    hopCount: 4,
    meetingEntity: "patient",
    confidence: "high"
  };
}

suite("traversalPlanGenerator", () => {
  test("prefers business breakpoints over generic ones", () => {
    const breakpoints = analyzeTraversalBreakpoints(buildRoute());

    assert.strictEqual(breakpoints[0]?.entity, "patient");
    assert.strictEqual(breakpoints[1]?.entity, "careplans");
  });

  test("builds compact, mixed, and detailed plans", () => {
    const plans = buildTraversalExecutionPlans(buildRoute());

    assert.deepStrictEqual(
      plans.map((plan) => plan.label),
      ["Compact", "Mixed", "Detailed"]
    );

    const compact = plans.find((plan) => plan.label === "Compact");
    const mixed = plans.find((plan) => plan.label === "Mixed");
    const detailed = plans.find((plan) => plan.label === "Detailed");

    assert.deepStrictEqual(
      compact?.steps.map((step) => step.stageLabel),
      ["account → patient", "patient → tasks"]
    );

    assert.deepStrictEqual(
      mixed?.steps.map((step) => step.stageLabel),
      ["account → patient", "patient → careplans", "careplans → tasks"]
    );

    assert.deepStrictEqual(
      detailed?.steps.map((step) => step.stageLabel),
      ["account → contact", "contact → patient", "patient → careplans", "careplans → tasks"]
    );
  });


  test("workspace Preferred Business Path preserves every saved hop as an exact itinerary", () => {
    const preferred: TraversalRoute = {
      ...buildRoute(),
      routeId: "preferred-care-path",
      selectionAuthority: "workspacePreferred"
    };

    const plans = buildTraversalExecutionPlans(preferred);

    assert.strictEqual(plans.length, 1);
    assert.strictEqual(plans[0]?.preserveExactHops, true);
    assert.strictEqual(plans[0]?.recommended, true);
    assert.ok(plans[0]?.planId.endsWith(":preferred-exact"));
    assert.deepStrictEqual(
      plans[0]?.steps.map((step) => step.stageLabel),
      ["account → contact", "contact → patient", "patient → careplans", "careplans → tasks"]
    );
    assert.ok(plans[0]?.steps.every((step) => step.hopCount === 1));
  });

  test("marks mixed as recommended for a 4-hop route", () => {
    const planned = buildPlannedTraversalRoute(buildRoute());

    assert.strictEqual(planned.recommendedPlanId?.endsWith(":mixed"), true);
    assert.strictEqual(
      planned.candidatePlans.find((plan) => plan.label === "Mixed")?.recommended,
      true
    );
  });
});