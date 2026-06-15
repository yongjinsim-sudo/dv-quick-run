import type { CapabilityId } from "./capabilityIds.js";
import { capabilityIds } from "./capabilityIds.js";
import { createCapabilityManifest, type CapabilityManifest } from "./capabilityManifest.js";
import { normalizeEntitlementPlan, normalizeEntitlementSupporterTags, type EntitlementPlan, type EntitlementSource, type EntitlementStatus, type EntitlementSupporterTag } from "./entitlementTypes.js";

export const entitlementCacheKey = "dvQuickRun.entitlement.cache.v1";
export const entitlementCacheSchemaVersion = "entitlement-cache-v1";

export interface StoredEntitlementCache {
  schemaVersion: typeof entitlementCacheSchemaVersion;
  plan: EntitlementPlan;
  status: Extract<EntitlementStatus, "valid">;
  source: Exclude<EntitlementSource, "configuration">;
  manifest: CapabilityManifest;
  cachedAt: string;
  expiresAt: string | null;
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

export interface EntitlementCacheResolution {
  cache?: StoredEntitlementCache;
  status: EntitlementStatus;
  message?: string;
  provider?: string;
  providerLicenseId?: string;
  providerInstanceId?: string;
  providerProductId?: string;
  providerVariantId?: string;
  supporterTags?: EntitlementSupporterTag[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isCapabilityId(value: unknown): value is CapabilityId {
  return typeof value === "string" && capabilityIds.includes(value as CapabilityId);
}

function normalizeIsoString(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim().length === 0) {
    return undefined;
  }

  const parsed = Date.parse(value);

  return Number.isNaN(parsed) ? undefined : new Date(parsed).toISOString();
}

function normalizeExpiry(value: unknown): string | null | undefined {
  if (value === null) {
    return null;
  }

  return normalizeIsoString(value);
}

function normalizeManifest(value: unknown, plan: EntitlementPlan): CapabilityManifest | undefined {
  if (!isRecord(value) || value.edition !== plan || !Array.isArray(value.grants)) {
    return undefined;
  }

  const enabledCapabilities: CapabilityId[] = [];

  for (const grant of value.grants) {
    if (!isRecord(grant) || grant.enabled !== true || !isCapabilityId(grant.capabilityId)) {
      continue;
    }

    if (!enabledCapabilities.includes(grant.capabilityId)) {
      enabledCapabilities.push(grant.capabilityId);
    }
  }

  return createCapabilityManifest(plan, enabledCapabilities, "entitlement");
}

export function normalizeStoredEntitlementCache(value: unknown): StoredEntitlementCache | undefined {
  if (!isRecord(value) || value.schemaVersion !== entitlementCacheSchemaVersion) {
    return undefined;
  }

  const plan = normalizeEntitlementPlan(typeof value.plan === "string" ? value.plan : undefined);

  if (plan !== "pro" || value.status !== "valid") {
    return undefined;
  }

  if (value.source !== "online" && value.source !== "offline" && value.source !== "manual") {
    return undefined;
  }

  const cachedAt = normalizeIsoString(value.cachedAt);
  const expiresAt = normalizeExpiry(value.expiresAt);
  const manifest = normalizeManifest(value.manifest, plan);

  if (cachedAt === undefined || expiresAt === undefined || manifest === undefined) {
    return undefined;
  }

  const cache: StoredEntitlementCache = {
    schemaVersion: entitlementCacheSchemaVersion,
    plan,
    status: "valid",
    source: value.source,
    manifest,
    cachedAt,
    expiresAt: expiresAt ?? null
  };

  if (typeof value.lastVerifiedAt === "string") {
    const lastVerifiedAt = normalizeIsoString(value.lastVerifiedAt);
    if (lastVerifiedAt !== undefined) {
      cache.lastVerifiedAt = lastVerifiedAt;
    }
  }
  if (typeof value.refreshDueAt === "string") {
    const refreshDueAt = normalizeIsoString(value.refreshDueAt);
    if (refreshDueAt !== undefined) {
      cache.refreshDueAt = refreshDueAt;
    }
  }
  if (typeof value.graceExpiresAt === "string") {
    const graceExpiresAt = normalizeIsoString(value.graceExpiresAt);
    if (graceExpiresAt !== undefined) {
      cache.graceExpiresAt = graceExpiresAt;
    }
  }
  if (typeof value.message === "string") {
    cache.message = value.message;
  }
  if (typeof value.provider === "string") {
    cache.provider = value.provider;
  }
  if (typeof value.providerLicenseId === "string") {
    cache.providerLicenseId = value.providerLicenseId;
  }
  if (typeof value.providerInstanceId === "string") {
    cache.providerInstanceId = value.providerInstanceId;
  }
  if (typeof value.providerProductId === "string") {
    cache.providerProductId = value.providerProductId;
  }
  if (typeof value.providerVariantId === "string") {
    cache.providerVariantId = value.providerVariantId;
  }

  const supporterTags = normalizeEntitlementSupporterTags(value.supporterTags);
  if (supporterTags.length > 0) {
    cache.supporterTags = supporterTags;
  }

  return cache;
}

export function createStoredEntitlementCache(input: {
  plan: EntitlementPlan;
  source: Exclude<EntitlementSource, "configuration">;
  manifest: CapabilityManifest;
  cachedAt?: Date;
  expiresAt?: Date | null;
  message?: string;
  provider?: string;
  providerLicenseId?: string;
  providerInstanceId?: string;
  providerProductId?: string;
  providerVariantId?: string;
  lastVerifiedAt?: Date;
  refreshDueAt?: Date;
  graceExpiresAt?: Date;
  supporterTags?: EntitlementSupporterTag[];
}): StoredEntitlementCache {
  const cache: StoredEntitlementCache = {
    schemaVersion: entitlementCacheSchemaVersion,
    plan: input.plan,
    status: "valid",
    source: input.source,
    manifest: createCapabilityManifest(input.plan, input.manifest.grants
      .filter((grant) => grant.enabled)
      .map((grant) => grant.capabilityId), "entitlement"),
    cachedAt: (input.cachedAt ?? new Date()).toISOString(),
    expiresAt: input.expiresAt === undefined ? null : input.expiresAt?.toISOString() ?? null
  };

  if (input.lastVerifiedAt !== undefined) {
    cache.lastVerifiedAt = input.lastVerifiedAt.toISOString();
  }
  if (input.refreshDueAt !== undefined) {
    cache.refreshDueAt = input.refreshDueAt.toISOString();
  }
  if (input.graceExpiresAt !== undefined) {
    cache.graceExpiresAt = input.graceExpiresAt.toISOString();
  }

  if (input.message !== undefined) {
    cache.message = input.message;
  }
  if (input.provider !== undefined) {
    cache.provider = input.provider;
  }
  if (input.providerLicenseId !== undefined) {
    cache.providerLicenseId = input.providerLicenseId;
  }
  if (input.providerInstanceId !== undefined) {
    cache.providerInstanceId = input.providerInstanceId;
  }
  if (input.providerProductId !== undefined) {
    cache.providerProductId = input.providerProductId;
  }
  if (input.providerVariantId !== undefined) {
    cache.providerVariantId = input.providerVariantId;
  }
  if (input.supporterTags !== undefined && input.supporterTags.length > 0) {
    cache.supporterTags = normalizeEntitlementSupporterTags(input.supporterTags);
  }

  return cache;
}

export function resolveStoredEntitlementCache(value: unknown, now: Date = new Date()): EntitlementCacheResolution {
  if (value === undefined) {
    return {
      status: "unknown"
    };
  }

  const cache = normalizeStoredEntitlementCache(value);

  if (cache === undefined) {
    return {
      status: "corrupted",
      message: "Cached entitlement was not readable. DVQR has continued in Free mode."
    };
  }

  if (cache.expiresAt !== null && Date.parse(cache.expiresAt) <= now.getTime()) {
    return {
      cache,
      status: "expired",
      message: "Cached entitlement has expired. DVQR has continued in Free mode."
    };
  }

  if (cache.source === "online" && cache.graceExpiresAt !== undefined && Date.parse(cache.graceExpiresAt) <= now.getTime()) {
    return {
      cache,
      status: "expired",
      message: "Online Pro verification grace window has ended. DVQR has continued in Free mode."
    };
  }

  if (cache.source === "online" && cache.refreshDueAt !== undefined && Date.parse(cache.refreshDueAt) <= now.getTime()) {
    return {
      cache,
      status: "stale",
      message: "DVQR is using the last verified Online Pro entitlement while refresh is due."
    };
  }

  return {
    cache,
    status: "valid"
  };
}
