import type { CapabilityManifest } from "./capabilityManifest.js";

export const entitlementPlans = [
  "free",
  "pro"
] as const;

export type EntitlementPlan = (typeof entitlementPlans)[number];

export type EntitlementStatus = "unknown" | "valid" | "stale" | "invalid" | "corrupted" | "expired" | "unavailable";

export type EntitlementSource = "configuration" | "online" | "offline" | "manual";

export const entitlementSupporterTags = [
  "Pathfinder"
] as const;

export type EntitlementSupporterTag = (typeof entitlementSupporterTags)[number];

export const entitlementSupporterTagLabels: Record<EntitlementSupporterTag, string> = {
  Pathfinder: "DVQR Pathfinder • Early Supporter"
};

export function normalizeEntitlementSupporterTags(value: unknown): EntitlementSupporterTag[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const tags: EntitlementSupporterTag[] = [];

  for (const candidate of value) {
    if (typeof candidate !== "string") {
      continue;
    }

    const normalized = entitlementSupporterTags.find((tag) => tag.toLowerCase() === candidate.trim().toLowerCase());

    if (normalized !== undefined && !tags.includes(normalized)) {
      tags.push(normalized);
    }
  }

  return tags;
}

export function formatEntitlementSupporterTag(tag: EntitlementSupporterTag): string {
  return entitlementSupporterTagLabels[tag];
}

export interface EntitlementContext {
  plan: EntitlementPlan;
  status?: EntitlementStatus;
  manifest?: CapabilityManifest;
  source?: EntitlementSource;
  cachedAt?: string;
  expiresAt?: string | null;
  lastVerifiedAt?: string;
  refreshDueAt?: string;
  graceExpiresAt?: string;
  message?: string;
  provider?: string;
  providerLicenseId?: string;
  providerInstanceId?: string;
  providerProductId?: string;
  providerVariantId?: string;
  supporterTags?: EntitlementSupporterTag[];
}

export function normalizeEntitlementPlan(value: string | undefined): EntitlementPlan {
  const normalized = (value ?? "").trim().toLowerCase();

  return entitlementPlans.includes(normalized as EntitlementPlan)
    ? normalized as EntitlementPlan
    : "free";
}
