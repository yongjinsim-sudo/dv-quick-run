import * as assert from "node:assert";
import { rankBusinessPathCandidates } from "../../mcp/mcpBusinessPathDiscovery.js";
import { rankRelationshipPath, type McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

const edge = (
  fromTable: string,
  toTable: string,
  navigationProperty: string,
  referencingAttribute?: string,
  direction: McpRelationshipEdge["direction"] = "oneToMany"
): McpRelationshipEdge => ({
  fromTable,
  toTable,
  navigationProperty,
  relationshipSchemaName: `${fromTable}_${toTable}`,
  referencingAttribute,
  relationshipType: direction === "manyToOne" ? "ManyToOne" : "OneToMany",
  direction,
  collectionValued: direction === "oneToMany",
  polymorphicTargetQualified: true
});

suite("mcpBusinessPathDiscovery", () => {
  test("can rank an operational multi-hop route above a direct relationship without claiming runtime viability", () => {
    const direct = rankRelationshipPath([edge("contact", "msemr_careplanactivity", "contact_activities")]);
    const viaPlan = rankRelationshipPath([
      edge("contact", "msemr_careplan", "contact_careplans"),
      edge("msemr_careplan", "msemr_careplanactivity", "careplan_activities")
    ]);
    const entities = [
      { LogicalName: "contact", DisplayName: { UserLocalizedLabel: { Label: "Contact" } } },
      { LogicalName: "msemr_careplan", DisplayName: { UserLocalizedLabel: { Label: "Care Plan" } }, Description: { UserLocalizedLabel: { Label: "Patient care plan" } } },
      { LogicalName: "msemr_careplanactivity", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Activity" } } }
    ] as any[];

    const ranked = rankBusinessPathCandidates([direct, viaPlan], entities);
    assert.strictEqual(ranked[0].tables.join(" -> "), "contact -> msemr_careplan -> msemr_careplanactivity");
    assert.ok(ranked[0].businessPathScore > ranked[1].businessPathScore);
    assert.deepStrictEqual(ranked[0].evidenceState, {
      metadataValid: true,
      runtimeViable: "Unknown",
      businessPreferred: "CandidateOnly"
    });
    assert.ok(ranked[0].limitations.some((item) => /metadata-only/i.test(item)));
  });


  test("prioritizes parent-child ownership over lateral reference bridges", () => {
    const viaPlan = rankRelationshipPath([
      edge("contact", "msemr_careplan", "msemr_contact_msemr_careplan_PatientIdentifier", "msemr_patientidentifier"),
      edge("msemr_careplan", "msemr_careplanactivity", "msemr_msemr_careplan_msemr_careplanactivity_CarePlan", "msemr_careplan")
    ]);
    const viaGoal = rankRelationshipPath([
      edge("contact", "msemr_careplangoal", "bu_contact_msemr_careplangoal_429", "bu_subject"),
      edge("msemr_careplangoal", "msemr_careplanactivity", "msemr_careplanactivity_CarePlanGoal_msemr", "msemr_careplangoal")
    ]);
    const viaAppointment = rankRelationshipPath([
      edge("contact", "msemr_appointmentemr", "contact_msemr_appointmentemrs", "regardingobjectid"),
      edge("msemr_appointmentemr", "msemr_careplanactivity", "msemr_msemr_appointmentemr_msemr_careplanactivity_ReferenceAppointmentIdentifier", "msemr_referenceappointmentidentifier")
    ]);
    const entities = [
      { LogicalName: "msemr_careplan", DisplayName: { UserLocalizedLabel: { Label: "Care Plan" } } },
      { LogicalName: "msemr_careplangoal", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Goal" } } },
      { LogicalName: "msemr_appointmentemr", DisplayName: { UserLocalizedLabel: { Label: "Appointment EMR" } } },
      { LogicalName: "msemr_careplanactivity", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Activity" } } }
    ] as any[];

    const ranked = rankBusinessPathCandidates([viaAppointment, viaGoal, viaPlan], entities);
    assert.strictEqual(ranked[0].bridgeTables[0], "msemr_careplan");
    assert.ok(ranked[0].signals.some((signal) => signal.code === "parent_child_ownership"));
    assert.ok(ranked[0].signals.some((signal) => signal.code === "domain_lineage_ownership"));
    const appointment = ranked.find((candidate) => candidate.bridgeTables[0] === "msemr_appointmentemr")!;
    assert.ok(appointment.signals.some((signal) => signal.code === "reference_link_semantics"));
    assert.ok(ranked[0].businessPathScore > appointment.businessPathScore);
  });

  test("does not treat every typed lookup as lifecycle ownership", () => {
    const viaPlan = rankRelationshipPath([
      edge("contact", "msemr_careplan", "msemr_contact_msemr_careplan_PatientIdentifier", "msemr_patientidentifier"),
      edge("msemr_careplan", "msemr_careplanactivity", "msemr_msemr_careplan_msemr_careplanactivity_CarePlan", "msemr_careplan")
    ]);
    const viaActivityGoal = rankRelationshipPath([
      edge("contact", "msemr_careplanactivitygoal", "msemr_careplanactivitygoal_Patient_Contact", "msemr_patient"),
      edge("msemr_careplanactivitygoal", "msemr_careplanactivity", "msemr_careplanactivity_CarePlanActivityGoal", "msemr_careplanactivitygoal")
    ]);
    const entities = [
      { LogicalName: "msemr_careplan", DisplayName: { UserLocalizedLabel: { Label: "Care Plan" } } },
      { LogicalName: "msemr_careplanactivitygoal", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Activity Goal" } } },
      { LogicalName: "msemr_careplanactivity", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Activity" } } }
    ] as any[];

    const ranked = rankBusinessPathCandidates([viaActivityGoal, viaPlan], entities);
    assert.strictEqual(ranked[0].bridgeTables[0], "msemr_careplan");
    const activityGoal = ranked.find((candidate) => candidate.bridgeTables[0] === "msemr_careplanactivitygoal")!;
    assert.ok(activityGoal.signals.some((signal) => signal.code === "typed_parent_link"));
    assert.ok(!activityGoal.signals.some((signal) => signal.code === "parent_child_ownership"));
  });

  test("prefers patient-subject entry to author-role entry for the same Care Plan ownership chain", () => {
    const viaPatient = rankRelationshipPath([
      edge("contact", "msemr_careplan", "msemr_contact_msemr_careplan_PatientIdentifier", "msemr_patientidentifier"),
      edge("msemr_careplan", "msemr_careplanactivity", "msemr_msemr_careplan_msemr_careplanactivity_CarePlan", "msemr_careplan")
    ]);
    const viaAuthor = rankRelationshipPath([
      edge("contact", "msemr_careplan", "msemr_authorcareplan_contact", "msemr_author"),
      edge("msemr_careplan", "msemr_careplanactivity", "msemr_msemr_careplan_msemr_careplanactivity_CarePlan", "msemr_careplan")
    ]);
    const entities = [
      { LogicalName: "msemr_careplan", DisplayName: { UserLocalizedLabel: { Label: "Care Plan" } } },
      { LogicalName: "msemr_careplanactivity", DisplayName: { UserLocalizedLabel: { Label: "Care Plan Activity" } } }
    ] as any[];

    const ranked = rankBusinessPathCandidates([viaAuthor, viaPatient], entities);
    assert.ok(ranked[0].signals.some((signal) => signal.code === "subject_role_semantics"));
    assert.ok(ranked[1].signals.some((signal) => signal.code === "reference_link_semantics"));
    assert.ok(ranked[0].businessPathScore > ranked[1].businessPathScore);
  });

  test("penalizes infrastructure bridge routes", () => {
    const viaTeam = rankRelationshipPath([
      edge("contact", "team", "contact_team"),
      edge("team", "task", "team_tasks")
    ]);
    const viaCase = rankRelationshipPath([
      edge("contact", "incident", "contact_cases"),
      edge("incident", "task", "case_tasks")
    ]);
    const entities = [
      { LogicalName: "team", DisplayName: { UserLocalizedLabel: { Label: "Team" } } },
      { LogicalName: "incident", DisplayName: { UserLocalizedLabel: { Label: "Case" } } },
      { LogicalName: "task", DisplayName: { UserLocalizedLabel: { Label: "Task" } } }
    ] as any[];
    const ranked = rankBusinessPathCandidates([viaTeam, viaCase], entities);
    assert.strictEqual(ranked[0].bridgeTables[0], "incident");
    assert.ok(ranked[1].signals.some((signal) => signal.code === "infrastructure_bridge"));
  });
});
