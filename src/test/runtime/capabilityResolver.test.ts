import * as assert from "assert";
import { canApplyQueryDoctorFix, canRunTraversalBatch, getCapabilityProfile, getCurrentProductPlan, getQueryDoctorCapabilities, getQueryDoctorInsightLevel } from "../../product/capabilities/capabilityResolver.js";
import { normalizeEntitlementPlan } from "../../product/capabilities/entitlementTypes.js";

suite("capabilityResolver", () => {
  test("resolves free capability profile", () => {
    const result = getCapabilityProfile("free");

    assert.deepStrictEqual(result, {
      queryDoctor: {
        insightLevel: 1,
        canApplyFix: false
      },
      traversal: {
        canRunBatch: true,
        canRunOptimizedBatch: false
      }
    });
  });

  test("resolves pro capability profile", () => {
    const result = getCapabilityProfile("pro");

    assert.deepStrictEqual(result, {
      queryDoctor: {
        insightLevel: 3,
        canApplyFix: true
      },
      traversal: {
        canRunBatch: true,
        canRunOptimizedBatch: true
      }
    });
  });

  test("resolves query doctor helpers", () => {
    assert.deepStrictEqual(getQueryDoctorCapabilities("free"), { insightLevel: 1, canApplyFix: false });
    assert.deepStrictEqual(getQueryDoctorCapabilities("pro"), { insightLevel: 3, canApplyFix: true });
    assert.strictEqual(getQueryDoctorInsightLevel("free"), 1);
    assert.strictEqual(getQueryDoctorInsightLevel("pro"), 3);
    assert.strictEqual(canApplyQueryDoctorFix("free"), false);
    assert.strictEqual(canApplyQueryDoctorFix("pro"), true);
    assert.strictEqual(canRunTraversalBatch("free"), true);
    assert.strictEqual(canRunTraversalBatch("pro"), true);
  });

  test("getCurrentProductPlan uses normalized configuration plan", () => {
    assert.strictEqual(typeof getCurrentProductPlan(), "string");
  });

  test("normalizes unknown plan values to dev", () => {
    assert.strictEqual(normalizeEntitlementPlan("mystery"), "dev");
    assert.strictEqual(normalizeEntitlementPlan(undefined), "dev");
  });
});
