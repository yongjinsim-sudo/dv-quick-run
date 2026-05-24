import * as assert from "assert";
import { canApplyActionableInsight, canApplyQueryDoctorFix, canExportComparison, canRunCrossEnvironmentDiff, canRunTraversalBatch, getActionableInsightCapabilities, getCapabilityProfile, getCurrentProductPlan, getQueryDoctorCapabilities, getQueryDoctorInsightLevel, shouldShowComparisonTeaser } from "../../product/capabilities/capabilityResolver.js";
import { normalizeEntitlementPlan } from "../../product/capabilities/entitlementTypes.js";

suite("capabilityResolver", () => {
  test("resolves free capability profile", () => {
    const result = getCapabilityProfile("free");

    assert.deepStrictEqual(result, {
      queryDoctor: {
        insightLevel: 1
      },
      actionableInsights: {
        canApply: false
      },
      traversal: {
        canRunBatch: true,
        canRunOptimizedBatch: false
      },
      comparison: {
        canRunCrossEnvironmentDiff: false,
        canExportComparison: false,
        showWhatIsComingTeaser: true
      }
    });
  });

  test("resolves pro capability profile", () => {
    const result = getCapabilityProfile("pro");

    assert.deepStrictEqual(result, {
      queryDoctor: {
        insightLevel: 3
      },
      actionableInsights: {
        canApply: true
      },
      traversal: {
        canRunBatch: true,
        canRunOptimizedBatch: true
      },
      comparison: {
        canRunCrossEnvironmentDiff: true,
        canExportComparison: true,
        showWhatIsComingTeaser: false
      }
    });
  });

  test("resolves query doctor helpers", () => {
    assert.deepStrictEqual(getQueryDoctorCapabilities("free"), { insightLevel: 1 });
    assert.deepStrictEqual(getQueryDoctorCapabilities("pro"), { insightLevel: 3 });
    assert.deepStrictEqual(getActionableInsightCapabilities("free"), { canApply: false });
    assert.deepStrictEqual(getActionableInsightCapabilities("pro"), { canApply: true });
    assert.strictEqual(getQueryDoctorInsightLevel("free"), 1);
    assert.strictEqual(getQueryDoctorInsightLevel("pro"), 3);
    assert.strictEqual(canApplyActionableInsight("free"), false);
    assert.strictEqual(canApplyActionableInsight("pro"), true);
    assert.strictEqual(canApplyQueryDoctorFix("free"), false);
    assert.strictEqual(canApplyQueryDoctorFix("pro"), true);
    assert.strictEqual(canRunTraversalBatch("free"), true);
    assert.strictEqual(canRunTraversalBatch("pro"), true);
    assert.strictEqual(canRunCrossEnvironmentDiff("free"), false);
    assert.strictEqual(canRunCrossEnvironmentDiff("pro"), true);
    assert.strictEqual(canExportComparison("free"), false);
    assert.strictEqual(canExportComparison("pro"), true);
    assert.strictEqual(shouldShowComparisonTeaser("free"), true);
    assert.strictEqual(shouldShowComparisonTeaser("pro"), false);
  });

  test("getCurrentProductPlan uses normalized configuration plan", () => {
    assert.strictEqual(typeof getCurrentProductPlan(), "string");
  });

  test("normalizes unknown and premature tier values to dev", () => {
    assert.strictEqual(normalizeEntitlementPlan("mystery"), "dev");
    assert.strictEqual(normalizeEntitlementPlan(undefined), "dev");
    assert.strictEqual(normalizeEntitlementPlan("team"), "dev");
    assert.strictEqual(normalizeEntitlementPlan("enterprise"), "dev");
  });
});
