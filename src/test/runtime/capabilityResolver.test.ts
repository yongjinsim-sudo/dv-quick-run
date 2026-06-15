import * as assert from "assert";
import { capabilityIds } from "../../product/capabilities/capabilityIds.js";
import { getAllCapabilityDefinitions, getDefaultEnabledCapabilityIds } from "../../product/capabilities/capabilityRegistry.js";
import { canApplyActionableInsight, canApplyQueryDoctorFix, canExportComparison, canExportDvburArtifact, canRunCrossEnvironmentDiff, canRunTraversalBatch, canUse, getActionableInsightCapabilities, getCapabilityProfile, getCurrentProductPlan, getQueryDoctorCapabilities, getQueryDoctorInsightLevel, resolveCapabilityManifest, resolveCapabilityState, shouldShowComparisonTeaser } from "../../product/capabilities/capabilityResolver.js";
import { normalizeEntitlementPlan, type EntitlementContext } from "../../product/capabilities/entitlementTypes.js";

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
      },
      resultViewer: {
        canExportDvburArtifact: false
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
      },
      resultViewer: {
        canExportDvburArtifact: true
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
    assert.strictEqual(canExportDvburArtifact("free"), false);
    assert.strictEqual(canExportDvburArtifact("pro"), true);
  });

  test("getCurrentProductPlan uses normalized configuration plan", () => {
    assert.strictEqual(typeof getCurrentProductPlan(), "string");
  });

  test("normalizes unknown and premature tier values to free", () => {
    assert.strictEqual(normalizeEntitlementPlan("mystery"), "free");
    assert.strictEqual(normalizeEntitlementPlan(undefined), "free");
    assert.strictEqual(normalizeEntitlementPlan("team"), "free");
    assert.strictEqual(normalizeEntitlementPlan("enterprise"), "free");
    assert.strictEqual(normalizeEntitlementPlan("dev"), "free");
  });

  test("declares stable canonical capability ids", () => {
    assert.deepStrictEqual(capabilityIds, [
      "queryDoctorInsights",
      "actionableInsightApply",
      "traversalBatch",
      "traversalOptimizedBatch",
      "crossEnvironmentDiff",
      "timelineDiff",
      "comparisonReportExport",
      "investigationHandoffExport",
      "snapshotReplay",
      "runtimeBehaviourDrift",
      "identityParticipationDrift",
      "exportDvburArtifact"
    ]);
  });

  test("registers every capability id exactly once", () => {
    const definitions = getAllCapabilityDefinitions();

    assert.strictEqual(definitions.length, capabilityIds.length);
    assert.deepStrictEqual(definitions.map((definition) => definition.id), [...capabilityIds]);
  });

  test("uses capability-aware checks for commercial acceleration", () => {
    const validPro: EntitlementContext = {
      plan: "pro",
      status: "valid"
    };

    const validFree: EntitlementContext = {
      plan: "free",
      status: "valid"
    };

    assert.strictEqual(canUse("crossEnvironmentDiff", validFree), false);
    assert.strictEqual(canUse("crossEnvironmentDiff", validPro), true);
    assert.strictEqual(canUse("comparisonReportExport", validFree), false);
    assert.strictEqual(canUse("comparisonReportExport", validPro), true);
    assert.strictEqual(canUse("exportDvburArtifact", validFree), false);
    assert.strictEqual(canUse("exportDvburArtifact", validPro), true);
  });

  test("treats existing Pro entitlements as eligible for newly introduced default Pro capabilities", () => {
    const legacyPro: EntitlementContext = {
      plan: "pro",
      status: "valid",
      manifest: {
        edition: "pro",
        grants: [
          { capabilityId: "crossEnvironmentDiff", enabled: true, source: "entitlement" }
        ]
      }
    };

    const manifest = resolveCapabilityManifest(legacyPro);

    assert.strictEqual(manifest.edition, "pro");
    assert.strictEqual(resolveCapabilityState("exportDvburArtifact", legacyPro).enabled, true);
    assert.ok(manifest.grants.some((grant) => grant.capabilityId === "exportDvburArtifact" && grant.enabled === true));
  });

  test("degrades non-valid entitlement states to free manifest", () => {
    const states: EntitlementContext["status"][] = ["unknown", "invalid", "corrupted", "expired", "unavailable"];

    for (const status of states) {
      const entitlement: EntitlementContext = {
        plan: "pro",
        status
      };

      assert.strictEqual(resolveCapabilityManifest(entitlement).edition, "free");
      assert.strictEqual(resolveCapabilityState("crossEnvironmentDiff", entitlement).enabled, false);
      assert.strictEqual(resolveCapabilityState("crossEnvironmentDiff", entitlement).reason, "Pro capability unavailable. DVQR has continued in Free mode.");
    }
  });

  test("keeps free understanding capabilities separate from pro acceleration", () => {
    assert.deepStrictEqual(getDefaultEnabledCapabilityIds("free"), [
      "queryDoctorInsights",
      "traversalBatch"
    ]);

    assert.ok(getDefaultEnabledCapabilityIds("pro").includes("crossEnvironmentDiff"));
    assert.ok(getDefaultEnabledCapabilityIds("pro").includes("investigationHandoffExport"));
    assert.ok(getDefaultEnabledCapabilityIds("pro").includes("exportDvburArtifact"));
  });
});
