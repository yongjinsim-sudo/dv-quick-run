import * as assert from "assert";
import { resolveCapabilities } from "../../product/capabilities/capabilityResolver.js";
import { normalizeEntitlementPlan } from "../../product/capabilities/entitlementTypes.js";

suite("capabilityResolver", () => {
  test("resolves free capability profile", () => {
    const result = resolveCapabilities({ plan: "free" });

    assert.deepStrictEqual(result, {
      queryDoctor: 1,
      investigationDepth: 1,
      traversalDepth: 0
    });
  });

  test("resolves pro capability profile", () => {
    const result = resolveCapabilities({ plan: "pro" });

    assert.deepStrictEqual(result, {
      queryDoctor: 3,
      investigationDepth: 2,
      traversalDepth: 1
    });
  });

  test("normalizes unknown plan values to dev", () => {
    assert.strictEqual(normalizeEntitlementPlan("mystery"), "dev");
    assert.strictEqual(normalizeEntitlementPlan(undefined), "dev");
  });
});
