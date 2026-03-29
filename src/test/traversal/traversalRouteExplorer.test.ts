import * as assert from "assert";
import {
  buildTraversalRoutes,
  exploreTraversalSubpaths
} from "../../commands/router/actions/shared/traversal/traversalRouteExplorer.js";
import type { TraversalGraph } from "../../commands/router/actions/shared/traversal/traversalTypes.js";

function buildGraph(): TraversalGraph {
  return {
    entities: {
      account: {
        logicalName: "account",
        entitySetName: "accounts",
        primaryIdAttribute: "accountid",
        primaryNameAttribute: "name",
        fieldLogicalNames: [],
        outboundRelationships: [
          {
            fromEntity: "account",
            toEntity: "contact",
            navigationPropertyName: "primarycontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne",
            referencingAttribute: "primarycontactid"
          }
        ]
      },
      contact: {
        logicalName: "contact",
        entitySetName: "contacts",
        primaryIdAttribute: "contactid",
        primaryNameAttribute: "fullname",
        fieldLogicalNames: [],
        outboundRelationships: [
          {
            fromEntity: "contact",
            toEntity: "patient",
            navigationPropertyName: "contact_patient",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            referencingAttribute: "contactid"
          }
        ]
      },
      patient: {
        logicalName: "patient",
        entitySetName: "patients",
        primaryIdAttribute: "patientid",
        primaryNameAttribute: "name",
        fieldLogicalNames: [],
        outboundRelationships: [
          {
            fromEntity: "patient",
            toEntity: "careplans",
            navigationPropertyName: "patient_careplans",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            referencingAttribute: "patientid"
          },
          {
            fromEntity: "patient",
            toEntity: "patientextensions",
            navigationPropertyName: "patient_extensions",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            referencingAttribute: "patientid"
          }
        ]
      },
      careplans: {
        logicalName: "careplans",
        entitySetName: "careplans",
        primaryIdAttribute: "careplanid",
        primaryNameAttribute: "name",
        fieldLogicalNames: [],
        outboundRelationships: [
          {
            fromEntity: "careplans",
            toEntity: "tasks",
            navigationPropertyName: "careplan_tasks",
            relationshipType: "OneToMany",
            direction: "oneToMany",
            referencingAttribute: "careplanid"
          }
        ]
      },
      tasks: {
        logicalName: "tasks",
        entitySetName: "tasks",
        primaryIdAttribute: "taskid",
        primaryNameAttribute: "subject",
        fieldLogicalNames: [],
        outboundRelationships: []
      },
      patientextensions: {
        logicalName: "patientextensions",
        entitySetName: "patientextensions",
        primaryIdAttribute: "patientextensionid",
        primaryNameAttribute: "name",
        fieldLogicalNames: [],
        outboundRelationships: []
      }
    }
  };
}

suite("traversalRouteExplorer", () => {
  test("explores bounded forward subpaths", () => {
    const subpaths = exploreTraversalSubpaths(buildGraph(), "account", 2);

    const labels = subpaths.map((path) => path.entities.join(" → "));
    assert.ok(labels.includes("account → contact"));
    assert.ok(labels.includes("account → contact → patient"));
  });

  test("builds a stitched route through a shared anchor", () => {
    const routes = buildTraversalRoutes(buildGraph(), {
      sourceEntity: "account",
      targetEntity: "tasks"
    });

    const route = routes.find(
      (candidate) =>
        candidate.entities.join(" → ") ===
        "account → contact → patient → careplans → tasks"
    );

    assert.ok(route);
    assert.strictEqual(route?.meetingEntity, "patient");
    assert.strictEqual(route?.hopCount, 4);
    assert.strictEqual(route?.confidence, "high");
  });

  test("finds a branch route from patient to patientextensions", () => {
    const routes = buildTraversalRoutes(buildGraph(), {
      sourceEntity: "patient",
      targetEntity: "patientextensions"
    });

    assert.strictEqual(
      routes[0]?.entities.join(" → "),
      "patient → patientextensions"
    );
    assert.strictEqual(routes[0]?.hopCount, 1);
  });
});