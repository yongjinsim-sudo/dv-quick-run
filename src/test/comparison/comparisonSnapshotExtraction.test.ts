import * as assert from "assert";
import { buildIdentityParticipationSnapshotPayloadFromProfile } from "../../product/comparison/comparisonSnapshotExtraction.js";
import type { OperationalProfileModel } from "../../product/operationalProfile/operationalProfileTypes.js";

function baseProfile(): OperationalProfileModel {
  return {
    kind: "entityOperationalProfile",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    headlineBand: "moderate",
    headlineLabel: "Moderate complexity",
    summary: "Profile summary",
    dimensions: [],
    evidence: [],
    guidance: [],
    navigationActions: [],
    futureSurfaces: [],
    investigationGuidance: [],
    invariants: {
      entityScoped: true,
      explicitlyUserTriggered: true,
      advisoryOnly: true,
      evidenceBacked: true
    }
  };
}

suite("comparison snapshot extraction", () => {
  test("does not treat entity/profile subjects as identity participation", () => {
    const profile = baseProfile();
    profile.operationalContext = {
      subject: { type: "entity", logicalName: "account", displayName: "Account" },
      guardrails: [],
      sections: [
        {
          id: "automationContext",
          label: "Automation Context",
          summary: "Entity-scoped automation participation with no identity anchor.",
          evidence: [
            {
              subject: { type: "entity", logicalName: "account", displayName: "Account" },
              evidenceType: "AutomationParticipation",
              title: "Entity automation participation",
              summary: "Account has automation evidence, but no participating identity evidence.",
              source: "dataverse",
              scope: "currentSubject",
              confidence: "direct",
              raw: { label: "Account", count: 1 }
            }
          ]
        }
      ]
    };

    assert.strictEqual(buildIdentityParticipationSnapshotPayloadFromProfile(profile), undefined);
  });

  test("extracts identity participation from anchored access context evidence", () => {
    const profile = baseProfile();
    profile.operationalContext = {
      subject: { type: "entity", logicalName: "account", displayName: "Account" },
      guardrails: [],
      sections: [
        {
          id: "accessContext",
          label: "Access Context",
          summary: "Observed access topology.",
          evidence: [
            {
              subject: { type: "principal", displayName: "# Admin", id: "user-1" },
              evidenceType: "AccessTopology",
              title: "Observed access topology participation",
              summary: "# Admin participates as Human User.",
              source: "dataverse",
              scope: "currentPrincipal",
              confidence: "direct",
              raw: {
                accessContext: {
                  principalSummary: {
                    id: "user-1",
                    displayName: "# Admin",
                    uniqueName: "admin@example.com",
                    principalType: "Human User"
                  },
                  directRoles: [{ roleName: "System Administrator" }],
                  teamMemberships: [{ teamName: "Owner Team" }]
                }
              }
            }
          ]
        }
      ]
    };

    const payload = buildIdentityParticipationSnapshotPayloadFromProfile(profile);

    assert.strictEqual(payload?.identities.length, 1);
    assert.strictEqual(payload?.identities[0].displayName, "# Admin");
    assert.deepStrictEqual(payload?.identities[0].roles, ["System Administrator"]);
    assert.deepStrictEqual(payload?.identities[0].teams, ["Owner Team"]);
  });
});
