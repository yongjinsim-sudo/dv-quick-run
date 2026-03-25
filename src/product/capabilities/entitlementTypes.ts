export const entitlementPlans = [
  "free",
  "pro",
  "team",
  "enterprise",
  "dev"
] as const;

export type EntitlementPlan = (typeof entitlementPlans)[number];

export interface EntitlementContext {
  plan: EntitlementPlan;
}

export function normalizeEntitlementPlan(value: string | undefined): EntitlementPlan {
  const normalized = (value ?? "").trim().toLowerCase();

  return entitlementPlans.includes(normalized as EntitlementPlan)
    ? normalized as EntitlementPlan
    : "dev";
}
