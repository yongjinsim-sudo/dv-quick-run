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

    const principal = payload?.identities.find((identity) => identity.subjectType === "user");

    assert.strictEqual(payload?.identities.length, 3);
    assert.strictEqual(principal?.displayName, "# Admin");
    assert.deepStrictEqual(principal?.roles, ["System Administrator"]);
    assert.deepStrictEqual(principal?.teams, ["Owner Team"]);
  });
});

test("extracts team and role participation identities from access context evidence", () => {
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
            subject: { type: "principal", displayName: "Operator", id: "user-1" },
            evidenceType: "AccessTopology",
            title: "Observed access topology participation",
            summary: "Operator participates as Human User.",
            source: "dataverse",
            scope: "currentPrincipal",
            confidence: "direct",
            raw: {
              accessContext: {
                principalSummary: {
                  id: "user-1",
                  displayName: "Operator",
                  uniqueName: "operator@example.com",
                  principalType: "Human User"
                },
                directRoles: [{ roleId: "role-direct", roleName: "App Opener" }],
                teamMemberships: [
                  {
                    teamId: "team-1",
                    teamName: "Integration Team",
                    teamType: "AAD security group team",
                    inheritedRoles: [{ roleId: "role-team", roleName: "Integration Role", sourceTeamName: "Integration Team" }]
                  }
                ]
              }
            }
          }
        ]
      }
    ]
  };

  const payload = buildIdentityParticipationSnapshotPayloadFromProfile(profile);
  const team = payload?.identities.find((identity) => identity.subjectType === "team");
  const role = payload?.identities.find((identity) => identity.subjectType === "role" && identity.displayName === "Integration Role");

  assert.ok(team);
  assert.strictEqual(team.displayName, "Integration Team");
  assert.deepStrictEqual(team.directRoles, ["Integration Role"]);
  assert.deepStrictEqual(team.users, ["Operator"]);
  assert.ok(role);
  assert.deepStrictEqual(role.teams, ["Integration Team"]);
  assert.deepStrictEqual(role.users, ["Operator"]);
});

test("extracts business-unit participation identity from access context evidence", () => {
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
            subject: { type: "principal", displayName: "Operator", id: "user-1" },
            evidenceType: "AccessTopology",
            title: "Observed access topology participation",
            summary: "Operator participates as Human User.",
            source: "dataverse",
            scope: "currentPrincipal",
            confidence: "direct",
            raw: {
              accessContext: {
                principalSummary: {
                  id: "user-1",
                  displayName: "Operator",
                  uniqueName: "operator@example.com",
                  principalType: "Human User",
                  businessUnitId: "bu-1",
                  businessUnitName: "Clinical Services"
                },
                directRoles: [],
                teamMemberships: [
                  {
                    teamId: "team-1",
                    teamName: "Clinical Team",
                    teamType: "Owner team",
                    businessUnitId: "bu-1",
                    businessUnitName: "Clinical Services"
                  }
                ]
              }
            }
          }
        ]
      }
    ]
  };

  const payload = buildIdentityParticipationSnapshotPayloadFromProfile(profile);
  const businessUnit = payload?.identities.find((identity) => identity.subjectType === "businessUnit");

  assert.ok(businessUnit);
  assert.strictEqual(businessUnit.displayName, "Clinical Services");
  assert.deepStrictEqual(businessUnit.users, ["Operator"]);
  assert.deepStrictEqual(businessUnit.teams, ["Clinical Team"]);
});
