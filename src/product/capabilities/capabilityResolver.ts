import { resolveEntitlement } from "./entitlementResolver.js";
import type {
  ActionableInsightCapabilityProfile,
  CapabilityProfile,
  QueryDoctorCapabilityProfile,
  TraversalCapabilityProfile
} from "./capabilityTypes.js";
import { defaultCapabilityProfiles } from "./defaultCapabilityProfiles.js";
import type { EntitlementPlan } from "./entitlementTypes.js";

export type ProductPlan = EntitlementPlan;

export function getCurrentProductPlan(): ProductPlan {
  return resolveEntitlement().plan;
}

export function getCapabilityProfile(plan?: ProductPlan): CapabilityProfile {
  return defaultCapabilityProfiles[plan ?? getCurrentProductPlan()];
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
  return getActionableInsightCapabilities(plan).canApply;
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
  return getTraversalCapabilities(plan).canRunBatch;
}

export function canRunTraversalOptimizedBatch(plan?: ProductPlan): boolean {
  return getTraversalCapabilities(plan).canRunOptimizedBatch;
}
