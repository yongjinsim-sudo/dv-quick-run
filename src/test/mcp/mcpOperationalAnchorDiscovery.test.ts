import * as assert from "assert";
import { rankOperationalAnchors } from "../../mcp/mcpOperationalAnchorDiscovery.js";
import type { McpRelationshipEdge } from "../../mcp/mcpRelationshipIntelligence.js";

const edge = (fromTable: string, toTable: string): McpRelationshipEdge => ({
  fromTable, toTable, navigationProperty: `${fromTable}_${toTable}`, relationshipType: "OneToMany", direction: "oneToMany", collectionValued: true
});

suite("mcpOperationalAnchorDiscovery", () => {
  test("ranks a structurally central business container above a direct work item", () => {
    const entities: any[] = [
      { LogicalName: "contact", OwnershipType: "UserOwned" },
      { LogicalName: "serviceplan", DisplayName: { UserLocalizedLabel: { Label: "Service Plan" } }, OwnershipType: "UserOwned" },
      { LogicalName: "serviceplanactivity", DisplayName: { UserLocalizedLabel: { Label: "Service Plan Activity" } }, OwnershipType: "UserOwned" },
      { LogicalName: "customtask", DisplayName: { UserLocalizedLabel: { Label: "Custom Task" } }, OwnershipType: "UserOwned" }
    ];
    const edges = [
      edge("contact", "serviceplan"),
      edge("serviceplan", "serviceplanactivity"),
      edge("serviceplanactivity", "customtask"),
      edge("contact", "customtask")
    ];
    const ranked = rankOperationalAnchors({
      sourceTable: "contact", entities, edges,
      depthByTable: new Map([["contact", 0], ["serviceplan", 1], ["serviceplanactivity", 2], ["customtask", 1]])
    });
    assert.strictEqual(ranked[0].logicalName, "serviceplan");
    assert.strictEqual(ranked[0].role, "OperationalAnchor");
    const task = ranked.find((item) => item.logicalName === "customtask")!;
    assert.strictEqual(task.role, "WorkItem");
    assert.ok(ranked[0].score > task.score);
    assert.strictEqual(task.primaryCapability, "Execution");
    assert.ok(ranked[0].capabilityProfile.some((item) => item.capability === "Coordination"));
  });

  test("uses structural evidence as the primary reason and preserves evidence boundaries", () => {
    const ranked = rankOperationalAnchors({
      sourceTable: "contact",
      entities: [{ LogicalName: "request", OwnershipType: "UserOwned" }],
      edges: [edge("contact", "request"), edge("request", "appointment")],
      depthByTable: new Map([["contact", 0], ["request", 1], ["appointment", 2]])
    });
    const request = ranked.find((item) => item.logicalName === "request")!;
    assert.ok(request.reasons.some((reason) => reason.signalKind === "structural"));
    assert.ok(request.limitations.some((item) => /does not prove/i.test(item)));
  });

  test("separates governance and execution capability dimensions", () => {
    const ranked = rankOperationalAnchors({
      sourceTable: "contact",
      entities: [
        { LogicalName: "consentrecord", DisplayName: { UserLocalizedLabel: { Label: "Consent" } }, OwnershipType: "UserOwned" },
        { LogicalName: "customtask", DisplayName: { UserLocalizedLabel: { Label: "Custom Task" } }, OwnershipType: "UserOwned" }
      ],
      edges: [edge("contact", "consentrecord"), edge("consentrecord", "customtask")],
      depthByTable: new Map([["contact", 0], ["consentrecord", 1], ["customtask", 2]])
    });
    const consent = ranked.find((item) => item.logicalName === "consentrecord")!;
    const task = ranked.find((item) => item.logicalName === "customtask")!;
    assert.strictEqual(consent.primaryCapability, "Governance");
    assert.strictEqual(task.primaryCapability, "Execution");
  });

  test("penalises platform infrastructure", () => {
    const ranked = rankOperationalAnchors({
      sourceTable: "contact",
      entities: [{ LogicalName: "systemuser" }],
      edges: [edge("contact", "systemuser")],
      depthByTable: new Map([["contact", 0], ["systemuser", 1]])
    });
    assert.strictEqual(ranked[0].role, "Infrastructure");
    assert.ok(ranked[0].score < 40);
  });
});
