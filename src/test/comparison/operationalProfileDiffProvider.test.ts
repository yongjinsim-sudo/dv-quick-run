import * as assert from "assert";
import { OperationalProfileDiffProvider } from "../../pro/comparison/providers/operationalProfileDiffProvider.js";

suite("OperationalProfileDiffProvider", () => {
  test("surfaces DVQR Score and operational profile dimension drift from snapshots", async () => {
    const provider = new OperationalProfileDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: [
        {
          environment: { label: "DEV" },
          evidenceType: "OperationalProfile",
          evidence: {
            entityLogicalName: "account",
            dvqrScore: { displayScore: 42, band: "Moderate" },
            dimensions: [
              {
                id: "automation",
                label: "Automation (Plugin Steps)",
                band: "moderate",
                valueLabel: "12 synchronous plugin steps",
                evidenceStateLabel: "Moderate"
              }
            ]
          }
        },
        {
          environment: { label: "SIT" },
          evidenceType: "OperationalProfile",
          evidence: {
            entityLogicalName: "account",
            dvqrScore: { displayScore: 67, band: "High" },
            dimensions: [
              {
                id: "automation",
                label: "Automation (Plugin Steps)",
                band: "high",
                valueLabel: "28 synchronous plugin steps",
                evidenceStateLabel: "High"
              }
            ]
          }
        }
      ]
    });

    assert.strictEqual(result.providerId, "operational-profile-diff");
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].id, "operational-profile-drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.id === "operational-profile-diff-dvqr-score"));
    assert.ok(result.groups[0].differences.some((difference) => difference.id === "operational-profile-diff-automation-changed"));
    assert.ok(result.groups[0].differences.every((difference) => !difference.summary.includes("incorrect")));
  });

  test("keeps missing operational profile evidence quiet", async () => {
    const provider = new OperationalProfileDiffProvider();
    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: []
    });

    assert.deepStrictEqual(result.groups, []);
  });
});
