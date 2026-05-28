import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import { SolutionParticipationDiffProvider } from "../../pro/comparison/index.js";

suite("SolutionParticipationDiffProvider", () => {
  test("surfaces version and managed-state drift from operational profile solution evidence", async () => {
    const provider = new SolutionParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "OperationalProfile",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: buildProfileEvidence([
        {
          uniqueName: "Contoso_Core",
          friendlyName: "Contoso Core",
          version: "1.0.0.0",
          isManaged: true
        },
        {
          uniqueName: "Contoso_Local",
          friendlyName: "Contoso Local",
          version: "1.0.0.0",
          isManaged: false
        }
      ])
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "OperationalProfile",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: buildProfileEvidence([
        {
          uniqueName: "Contoso_Core",
          friendlyName: "Contoso Core",
          version: "2.0.0.0",
          isManaged: true
        },
        {
          uniqueName: "Contoso_Local",
          friendlyName: "Contoso Local",
          version: "1.0.0.0",
          isManaged: true
        },
        {
          uniqueName: "Contoso_SITOnly",
          friendlyName: "Contoso SIT Only",
          version: "1.0.0.0",
          isManaged: true
        }
      ])
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.providerId, "solution-participation-diff");
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Solution Participation Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("version changed")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("only in target")));
  });

  test("classifies platform and backup solution drift as lower-priority visible evidence", async () => {
    const provider = new SolutionParticipationDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "OperationalProfile",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: buildProfileEvidence([
        { uniqueName: "ContosoEntities", friendlyName: "Contoso Entities (BKP)", version: "1.0.0.0", isManaged: false },
        { uniqueName: "SprintSolution", friendlyName: "Sprint Solution", version: "1.0.0.0", isManaged: false }
      ])
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "OperationalProfile",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: buildProfileEvidence([
        { uniqueName: "msdynce_AppCommon", friendlyName: "Application Common", version: "9.0.4.0066", isManaged: true }
      ])
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    const differences = result.groups[0].differences;
    const backup = differences.find((difference) => difference.title.includes("Contoso Entities"));
    const platform = differences.find((difference) => difference.title.includes("Application Common"));
    const custom = differences.find((difference) => difference.title.includes("Sprint"));

    assert.ok(backup);
    assert.ok(platform);
    assert.ok(custom);
    assert.strictEqual(backup.significance, "Low");
    assert.strictEqual(platform.significance, "Low");
    assert.strictEqual(custom.significance, "Medium");
    assert.ok(backup.evidence.some((item) => item.label === "Solution classification" && item.value === "Backup / archived solution"));
    assert.ok(platform.evidence.some((item) => item.label === "Solution classification" && item.value === "Microsoft platform solution"));
  });

});

function buildProfileEvidence(solutions: readonly unknown[]) {
  return {
    kind: "entityOperationalProfile",
    entityLogicalName: "account",
    entityDisplayName: "Account",
    operationalContext: {
      sections: [
        {
          id: "solutionContext",
          label: "Solution Context",
          evidence: [
            {
              evidenceType: "SolutionParticipation",
              raw: {
                solutions
              }
            }
          ]
        }
      ]
    }
  };
}
