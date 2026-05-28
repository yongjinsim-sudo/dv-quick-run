import * as assert from "assert";
import { IdentityParticipationDiffProvider } from "../../pro/comparison/providers/identityParticipationDiffProvider.js";

suite("identityParticipationDiffProvider", () => {
  test("reports exact-matched user direct and inherited participation drift", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [
        {
          environment: { label: "DEV" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "user",
                displayName: "Operator",
                azureAdObjectId: "aad-1",
                directRoles: ["Read Account"],
                inheritedTeamRoles: ["Legacy Support"],
                teams: ["Support Team"]
              }
            ]
          }
        },
        {
          environment: { label: "SIT" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "user",
                displayName: "Operator",
                azureAdObjectId: "aad-1",
                directRoles: ["Read Account", "Integration Role"],
                inheritedTeamRoles: ["Platform Support"],
                teams: ["Support Team", "Integration Team"]
              }
            ]
          }
        }
      ]
    });

    assert.strictEqual(result.groups.length, 1);
    const difference = result.groups[0].differences[0];
    assert.strictEqual(difference.kind, "Inheritance Drift");
    assert.strictEqual(difference.significance, "Medium");
    assert.match(difference.summary, /not authority certainty/);
    assert.ok(difference.evidence.some((item) => item.label === "Direct role participation"));
    assert.ok(difference.evidence.some((item) => item.label === "Inherited role participation"));
    assert.ok(difference.evidence.some((item) => item.label === "Team participation"));
  });

  test("does not report exact-matched user when participation evidence is unchanged", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [
        {
          environment: { label: "DEV" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "user",
                displayName: "Operator DEV",
                azureAdObjectId: "aad-1",
                roles: ["Read Account"],
                teams: ["Support Team"]
              }
            ]
          }
        },
        {
          environment: { label: "SIT" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "user",
                displayName: "Operator SIT",
                azureAdObjectId: "aad-1",
                roles: ["Read Account"],
                teams: ["Support Team"]
              }
            ]
          }
        }
      ]
    });

    assert.strictEqual(result.groups.length, 0);
  });

  test("keeps confidence evidence separate from participation drift for likely user matches", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [
        {
          environment: { label: "DEV" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "applicationUser",
                displayName: "service_account_dev",
                isApplicationUser: true,
                roles: ["Read Account"],
                teams: ["Integration Team"]
              }
            ]
          }
        },
        {
          environment: { label: "SIT" },
          evidenceType: "IdentityParticipation",
          evidence: {
            identities: [
              {
                subjectType: "applicationUser",
                displayName: "service_account_sit",
                isApplicationUser: true,
                roles: ["Read Account", "Integration Role"],
                teams: ["Integration Team"]
              }
            ]
          }
        }
      ]
    });

    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].differences.length, 2);
    assert.ok(result.groups[0].differences.some((difference) => difference.kind === "Assignment Drift"));
    assert.ok(result.groups[0].differences.some((difference) => difference.kind === "Changed"));
  });
});

test("reports team role assignment drift without authority semantics", async () => {
  const provider = new IdentityParticipationDiffProvider();
  const result = await provider.compare({
    source: { label: "DEV" },
    target: { label: "SIT" },
    snapshots: [
      {
        environment: { label: "DEV" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "team",
              displayName: "Integration Team DEV",
              teamType: "AAD security group team",
              directRoles: ["Read Account"],
              users: ["Operator"]
            }
          ]
        }
      },
      {
        environment: { label: "SIT" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "team",
              displayName: "Integration Team SIT",
              teamType: "AAD security group team",
              directRoles: ["Read Account", "Integration Role"],
              users: ["Operator"]
            }
          ]
        }
      }
    ]
  });

  assert.strictEqual(result.groups.length, 1);
  const assignmentDrift = result.groups[0].differences.find((difference) => difference.kind === "Assignment Drift");
  assert.ok(assignmentDrift);
  assert.match(assignmentDrift.title, /Team participation changed/);
  assert.match(assignmentDrift.summary, /not authority certainty/);
  assert.ok(assignmentDrift.evidence.some((item) => item.label === "Team role participation"));
});

test("reports role team participation drift as bounded participation orientation", async () => {
  const provider = new IdentityParticipationDiffProvider();
  const result = await provider.compare({
    source: { label: "DEV" },
    target: { label: "SIT" },
    snapshots: [
      {
        environment: { label: "DEV" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "role",
              displayName: "Integration Role",
              teams: ["Integration Team"],
              users: ["Operator"]
            }
          ]
        }
      },
      {
        environment: { label: "SIT" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "role",
              displayName: "Integration Role",
              teams: ["Integration Team", "Support Team"],
              users: ["Operator"]
            }
          ]
        }
      }
    ]
  });

  assert.strictEqual(result.groups.length, 1);
  const assignmentDrift = result.groups[0].differences.find((difference) => difference.kind === "Assignment Drift");
  assert.ok(assignmentDrift);
  assert.match(assignmentDrift.title, /Role participation changed/);
  assert.ok(assignmentDrift.evidence.some((item) => item.label === "Role team participation"));
});

test("reports application user automation participation drift with bounded wording", async () => {
  const provider = new IdentityParticipationDiffProvider();
  const result = await provider.compare({
    source: { label: "DEV" },
    target: { label: "SIT" },
    snapshots: [
      {
        environment: { label: "DEV" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "applicationUser",
              displayName: "FHIR Sync App DEV",
              applicationId: "app-1",
              isApplicationUser: true,
              directRoles: ["FHIR Reader"],
              teams: ["FHIR Integration"]
            }
          ]
        }
      },
      {
        environment: { label: "SIT" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "applicationUser",
              displayName: "FHIR Sync App SIT",
              applicationId: "app-1",
              isApplicationUser: true,
              directRoles: ["FHIR Reader", "FHIR Writer"],
              teams: ["FHIR Integration", "Platform Automation"]
            }
          ]
        }
      }
    ]
  });

  assert.strictEqual(result.groups.length, 1);
  const drift = result.groups[0].differences.find((difference) => difference.kind === "Assignment Drift");
  assert.ok(drift);
  assert.match(drift.title, /Application user participation changed/);
  assert.match(drift.summary, /automation participation changed/);
  assert.match(drift.summary, /not ownership, responsibility, or authority certainty/);
  assert.ok(drift.evidence.some((item) => item.label === "Application user role participation"));
  assert.ok(drift.evidence.some((item) => item.label === "Application user team participation"));
});

test("reports business-unit participation drift as organisational orientation", async () => {
  const provider = new IdentityParticipationDiffProvider();
  const result = await provider.compare({
    source: { label: "DEV" },
    target: { label: "SIT" },
    snapshots: [
      {
        environment: { label: "DEV" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "businessUnit",
              displayName: "Clinical Services DEV",
              businessUnitPath: ["Root", "Clinical Services"],
              teams: ["Clinical Team"],
              users: ["Operator"]
            }
          ]
        }
      },
      {
        environment: { label: "SIT" },
        evidenceType: "IdentityParticipation",
        evidence: {
          identities: [
            {
              subjectType: "businessUnit",
              displayName: "Clinical Services SIT",
              businessUnitPath: ["Root", "Clinical Services"],
              teams: ["Clinical Team", "Automation Team"],
              users: ["Operator", "Integration User"]
            }
          ]
        }
      }
    ]
  });

  assert.strictEqual(result.groups.length, 1);
  const drift = result.groups[0].differences.find((difference) => difference.kind === "Assignment Drift");
  assert.ok(drift);
  assert.match(drift.title, /Business unit participation changed/);
  assert.match(drift.summary, /organisational participation orientation/);
  assert.match(drift.summary, /not hierarchy authority or governance certainty/);
  assert.ok(drift.evidence.some((item) => item.label === "Business-unit team participation"));
  assert.ok(drift.evidence.some((item) => item.label === "Business-unit user participation"));
});
