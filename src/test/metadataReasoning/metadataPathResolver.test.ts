import * as assert from "assert";
import { resolveMetadataReasoning } from "../../commands/router/actions/shared/metadataReasoning/metadataPathResolver.js";
import type { MetadataReasoningGraph } from "../../commands/router/actions/shared/metadataReasoning/metadataReasoningTypes.js";

function buildGraph(): MetadataReasoningGraph {
  return {
    entities: {
      account: {
        logicalName: "account",
        fieldLogicalNames: ["accountid", "name"],
        outboundRelationships: [
          {
            fromEntity: "account",
            toEntity: "contact",
            navigationPropertyName: "primarycontactid",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          },
          {
            fromEntity: "account",
            toEntity: "sample_lookup",
            navigationPropertyName: "sample_lookupid",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          }
        ]
      },
      contact: {
        logicalName: "contact",
        fieldLogicalNames: ["contactid", "jobtitle", "fullname"],
        outboundRelationships: [
          {
            fromEntity: "contact",
            toEntity: "bu_patient",
            navigationPropertyName: "sample_patientid",
            relationshipType: "OneToMany",
            direction: "oneToMany"
          }
        ]
      },
      bu_patient: {
        logicalName: "bu_patient",
        fieldLogicalNames: ["bu_patientid", "bu_patientnumber"],
        outboundRelationships: [
          {
            fromEntity: "bu_patient",
            toEntity: "msemr_careplan",
            navigationPropertyName: "msemr_careplans",
            relationshipType: "OneToMany",
            direction: "oneToMany"
          },
          {
            fromEntity: "bu_patient",
            toEntity: "bu_patientextension",
            navigationPropertyName: "bu_patientextensions",
            relationshipType: "OneToMany",
            direction: "oneToMany"
          }
        ]
      },
      bu_patientextension: {
        logicalName: "bu_patientextension",
        fieldLogicalNames: ["bu_extensionfield"],
        outboundRelationships: []
      },
      msemr_careplan: {
        logicalName: "msemr_careplan",
        fieldLogicalNames: ["msemr_careplanid", "msemr_name"],
        outboundRelationships: [
          {
            fromEntity: "msemr_careplan",
            toEntity: "msemr_careplanactivity",
            navigationPropertyName: "msemr_careplanactivities",
            relationshipType: "OneToMany",
            direction: "oneToMany"
          }
        ]
      },
      msemr_careplanactivity: {
        logicalName: "msemr_careplanactivity",
        fieldLogicalNames: ["msemr_careplanactivityid"],
        outboundRelationships: [
          {
            fromEntity: "msemr_careplanactivity",
            toEntity: "bu_task",
            navigationPropertyName: "bu_tasks",
            relationshipType: "OneToMany",
            direction: "oneToMany"
          },
          {
            fromEntity: "msemr_careplanactivity",
            toEntity: "account",
            navigationPropertyName: "sample_account_backref",
            relationshipType: "ManyToOne",
            direction: "manyToOne"
          }
        ]
      },
      bu_task: {
        logicalName: "bu_task",
        fieldLogicalNames: ["bu_taskstatus"],
        outboundRelationships: []
      },
      sample_lookup: {
        logicalName: "sample_lookup",
        fieldLogicalNames: ["jobtitle"],
        outboundRelationships: []
      }
    }
  };
}

suite("metadataPathResolver", () => {
  test("classifies local fields as Local", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "name");

    assert.strictEqual(result.classification, "Local");
    assert.strictEqual(result.confidence, "High");
    assert.strictEqual(result.matchedEntity, "account");
    assert.strictEqual(result.hopCount, 0);
  });

  test("classifies one-hop related fields as Direct", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "fullname");

    assert.strictEqual(result.classification, "Direct");
    assert.strictEqual(result.matchedEntity, "contact");
    assert.strictEqual(result.hopCount, 1);
    assert.strictEqual(result.confidence, "High");
  });

  test("classifies two-hop related fields as TwoHop", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "bu_patientnumber");

    assert.strictEqual(result.classification, "TwoHop");
    assert.strictEqual(result.matchedEntity, "bu_patient");
    assert.strictEqual(result.hopCount, 2);
    assert.strictEqual(result.confidence, "Medium");
  });

  test("classifies deeper reachable fields as TooDeep", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "bu_taskstatus");

    assert.strictEqual(result.classification, "TooDeep");
    assert.strictEqual(result.matchedEntity, "bu_task");
    assert.strictEqual(result.hopCount, 5);
    assert.strictEqual(result.confidence, "Low");
    assert.ok(result.assistCandidates.length === 0);
    assert.ok(result.advisoryCandidates.length > 0);
  });

  test("classifies same-depth competing matches as Ambiguous", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "jobtitle");

    assert.strictEqual(result.classification, "Ambiguous");
    assert.strictEqual(result.confidence, "Low");
    assert.strictEqual(result.assistCandidates.length, 2);
  });

  test("returns NotFound when no field match exists", () => {
    const result = resolveMetadataReasoning(buildGraph(), "account", "missing_field");

    assert.strictEqual(result.classification, "NotFound");
    assert.strictEqual(result.confidence, "Low");
    assert.strictEqual(result.bestCandidate, undefined);
  });

  test("does not loop forever on cyclic graphs", () => {
    const result = resolveMetadataReasoning(buildGraph(), "msemr_careplanactivity", "bu_extensionfield", {
      queryAssistMaxDepth: 2,
      advisoryMaxDepth: 4
    });

    assert.strictEqual(result.classification, "TooDeep");
    assert.strictEqual(result.matchedEntity, "bu_patientextension");
    assert.strictEqual(result.hopCount, 4);
  });
});
