import type { CapabilityId } from "./capabilityIds.js";
import { createCapabilityManifest, type CapabilityManifest } from "./capabilityManifest.js";
import { getDefaultEnabledCapabilityIds } from "./capabilityRegistry.js";
import { resolveEntitlement } from "./entitlementResolver.js";
import type {
  ActionableInsightCapabilityProfile,
  CapabilityProfile,
  ComparisonCapabilityProfile,
  QueryDoctorCapabilityProfile,
  ResultViewerCapabilityProfile,
  TraversalCapabilityProfile
} from "./capabilityTypes.js";
import { defaultCapabilityProfiles } from "./defaultCapabilityProfiles.js";
import type { EntitlementContext, EntitlementPlan } from "./entitlementTypes.js";

export type ProductPlan = EntitlementPlan;

export interface CapabilityState {
  capabilityId: CapabilityId;
  enabled: boolean;
  plan: ProductPlan;
  reason?: string;
}

export function getCurrentProductPlan(): ProductPlan {
  return resolveEntitlement().plan;
}

export function getCapabilityProfile(plan?: ProductPlan): CapabilityProfile {
  return defaultCapabilityProfiles[plan ?? getCurrentProductPlan()];
}

function mergeManifestWithDefaultCapabilities(manifest: CapabilityManifest): CapabilityManifest {
  if (manifest.edition !== "pro") {
    return manifest;
  }

  const enabledCapabilityIds = new Set(getDefaultEnabledCapabilityIds("pro"));

  for (const grant of manifest.grants) {
    if (grant.enabled === true) {
      enabledCapabilityIds.add(grant.capabilityId);
    }
  }

  return createCapabilityManifest("pro", [...enabledCapabilityIds], "entitlement");
}

export function getDefaultCapabilityManifest(plan: ProductPlan): CapabilityManifest {
  const source = plan === "pro" ? "default-pro" : "default-free";

  return createCapabilityManifest(plan, getDefaultEnabledCapabilityIds(plan), source);
}

export function resolveCapabilityManifest(entitlement: EntitlementContext = resolveEntitlement()): CapabilityManifest {
  if (entitlement.status !== undefined && entitlement.status !== "valid" && entitlement.status !== "stale") {
    return getDefaultCapabilityManifest("free");
  }

  return entitlement.manifest !== undefined
    ? mergeManifestWithDefaultCapabilities(entitlement.manifest)
    : getDefaultCapabilityManifest(entitlement.plan);
}

export function resolveCapabilityState(capabilityId: CapabilityId, entitlement: EntitlementContext = resolveEntitlement()): CapabilityState {
  const manifest = resolveCapabilityManifest(entitlement);
  const grant = manifest.grants.find((candidate) => candidate.capabilityId === capabilityId);

  if (grant?.enabled === true) {
    return {
      capabilityId,
      enabled: true,
      plan: manifest.edition
    };
  }

  return {
    capabilityId,
    enabled: false,
    plan: manifest.edition,
    reason: manifest.edition === "free"
      ? "Pro capability unavailable. DVQR has continued in Free mode."
      : "Capability is not enabled by the current entitlement."
  };
}

export function canUse(capabilityId: CapabilityId, entitlement?: EntitlementContext): boolean {
  return resolveCapabilityState(capabilityId, entitlement).enabled;
}

export function getQueryDoctorCapabilities(plan?: ProductPlan): QueryDoctorCapabilityProfile {
  return getCapabilityProfile(plan).queryDoctor;
}

export function getQueryDoctorInsightLevel(plan?: ProductPlan): QueryDoctorCapabilityProfile["insightLevel"] {
  return getQueryDoctorCapabilities(plan).insightLevel;
}

export function getActionableInsightCapabilities(plan?: ProductPlan): ActionableInsightCapabilityProfile {
  return getCapabilityProfile(plan).actionableInsights;
}

export function canApplyActionableInsight(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("actionableInsightApply")
    : getActionableInsightCapabilities(plan).canApply;
}

/**
 * Compatibility alias for older Query Doctor call sites.
 * New code should call canApplyActionableInsight().
 */
export function canApplyQueryDoctorFix(plan?: ProductPlan): boolean {
  return canApplyActionableInsight(plan);
}

export function getTraversalCapabilities(plan?: ProductPlan): TraversalCapabilityProfile {
  return getCapabilityProfile(plan).traversal;
}

export function canRunTraversalBatch(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("traversalBatch")
    : getTraversalCapabilities(plan).canRunBatch;
}

export function canRunTraversalOptimizedBatch(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("traversalOptimizedBatch")
    : getTraversalCapabilities(plan).canRunOptimizedBatch;
}

export function getComparisonCapabilities(plan?: ProductPlan): ComparisonCapabilityProfile {
  return getCapabilityProfile(plan).comparison;
}

export function canRunCrossEnvironmentDiff(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("crossEnvironmentDiff")
    : getComparisonCapabilities(plan).canRunCrossEnvironmentDiff;
}

export function canExportComparison(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("comparisonReportExport")
    : getComparisonCapabilities(plan).canExportComparison;
}

export function shouldShowComparisonTeaser(plan?: ProductPlan): boolean {
  return plan === undefined
    ? !canUse("crossEnvironmentDiff")
    : getComparisonCapabilities(plan).showWhatIsComingTeaser;
}

export function getResultViewerCapabilities(plan?: ProductPlan): ResultViewerCapabilityProfile {
  return getCapabilityProfile(plan).resultViewer;
}

export function canExportDvburArtifact(plan?: ProductPlan): boolean {
  return plan === undefined
    ? canUse("exportDvburArtifact")
    : getResultViewerCapabilities(plan).canExportDvburArtifact;
}
