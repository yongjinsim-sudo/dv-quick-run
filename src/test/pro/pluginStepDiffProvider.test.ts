import * as assert from "assert";
import { createComparisonEvidenceSnapshot } from "../../product/comparison/index.js";
import { PluginStepDiffProvider } from "../../pro/comparison/index.js";

suite("PluginStepDiffProvider", () => {
  test("surfaces plugin step presence and execution pipeline drift without exposing configuration values", async () => {
    const provider = new PluginStepDiffProvider();
    const sourceSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "DEV" },
      evidenceType: "PluginStep",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        entityLogicalName: "account",
        pluginSteps: [
          {
            sdkMessageProcessingStepId: "step-account-sync",
            name: "Account Sync",
            pluginTypeName: "Contoso.Plugins.AccountSync",
            messageName: "Update",
            primaryEntity: "account",
            stage: 20,
            mode: 0,
            rank: 1,
            filteringAttributes: ["name", "telephone1"],
            state: "Enabled",
            secureConfiguration: "dev-secret",
            unsecureConfiguration: "dev-url"
          },
          {
            sdkMessageProcessingStepId: "step-legacy",
            name: "Legacy Account Guard",
            pluginTypeName: "Contoso.Plugins.LegacyGuard",
            messageName: "Create",
            primaryEntity: "account",
            stage: 20,
            mode: 0,
            state: "Enabled"
          }
        ]
      }
    });
    const targetSnapshot = createComparisonEvidenceSnapshot({
      environment: { label: "SIT" },
      evidenceType: "PluginStep",
      sourceFeature: "Operational Profile",
      capturedAt: new Date("2026-05-24T00:00:00.000Z"),
      evidence: {
        entityLogicalName: "account",
        pluginSteps: [
          {
            sdkMessageProcessingStepId: "step-account-sync",
            name: "Account Sync",
            pluginTypeName: "Contoso.Plugins.AccountSync",
            messageName: "Update",
            primaryEntity: "account",
            stage: 40,
            mode: 0,
            rank: 1,
            filteringAttributes: ["name"],
            state: "Enabled",
            secureConfiguration: "sit-secret",
            unsecureConfiguration: "sit-url"
          },
          {
            sdkMessageProcessingStepId: "step-new",
            name: "Account Notify",
            pluginTypeName: "Contoso.Plugins.Notify",
            messageName: "Update",
            primaryEntity: "account",
            stage: 40,
            mode: 1,
            state: "Enabled"
          }
        ]
      }
    });

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      entityLogicalName: "account",
      snapshots: [sourceSnapshot, targetSnapshot]
    });

    assert.strictEqual(result.providerId, "plugin-step-diff");
    assert.strictEqual(result.groups.length, 1);
    assert.strictEqual(result.groups[0].title, "Plugin Step Runtime Behaviour Drift");
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("execution pipeline changed")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("removed from target")));
    assert.ok(result.groups[0].differences.some((difference) => difference.title.includes("added in target")));

    const renderedEvidence = result.groups[0].differences.flatMap((difference) => difference.evidence).map((item) => item.value ?? "").join("\n");
    assert.ok(renderedEvidence.includes("present (value hidden)"));
    assert.ok(!renderedEvidence.includes("dev-secret"));
    assert.ok(!renderedEvidence.includes("sit-secret"));
    assert.ok(!renderedEvidence.includes("dev-url"));
    assert.ok(!renderedEvidence.includes("sit-url"));
  });

  test("keeps missing plugin step evidence quiet", async () => {
    const provider = new PluginStepDiffProvider();

    const result = await provider.compare({
      source: { label: "DEV" },
      target: { label: "SIT" },
      snapshots: []
    });

    assert.deepStrictEqual(result.groups, []);
  });
});
