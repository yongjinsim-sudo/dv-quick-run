import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import { IdentityParticipationDiffProvider } from "../../pro/comparison/index.js";

suite("IdentityParticipationDiffProvider", () => {
  test("surfaces confidence-based identity participation drift from comparison snapshots", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Access Context",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [
          {
            displayName: "service_account_dev",
            isApplicationUser: true,
            roles: ["Integration Role"],
            teams: ["Platform Team"]
          }
        ]
      }
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Access Context",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [
          {
            displayName: "service_account_sit",
            isApplicationUser: true,
            roles: ["Integration Role"],
            teams: ["Platform Team"]
          }
        ]
      }
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.providerId, "identity-participation-diff");
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Identity Participation Drift");
    assert.strictEqual(result.groups[0].differences[0].significance, "Medium");
    assert.ok(result.groups[0].differences[0].title.includes("Likely corresponding identity"));
  });

  test("ignores display-name-only entity subjects that leaked into older identity snapshots", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [{ displayName: "Account" }]
      }
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [{ displayName: "Contact" }]
      }
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.groups.length, 0);
  });

  test("keeps display-name service identities when app-user evidence marks them as automation", async () => {
    const provider = new IdentityParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Access Context",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [{ displayName: "service_account_dev", isApplicationUser: true }]
      }
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "IdentityParticipation",
      sourceFeature: "Access Context",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        identities: [{ displayName: "service_account_sit", isApplicationUser: true }]
      }
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.groups.length, 1);
  });

});
