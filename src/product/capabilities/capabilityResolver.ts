import { resolveEntitlement } from "./entitlementResolver.js";
import type { CapabilityProfile, QueryDoctorCapabilityProfile } from "./capabilityTypes.js";
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

export function canApplyQueryDoctorFix(plan?: ProductPlan): boolean {
  return getQueryDoctorCapabilities(plan).canApplyFix;
}
