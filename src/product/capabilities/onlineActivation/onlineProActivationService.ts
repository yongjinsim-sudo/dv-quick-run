import { createCapabilityManifest } from "../capabilityManifest.js";
import { getDefaultEnabledCapabilityIds } from "../capabilityRegistry.js";
import { createStoredEntitlementCache } from "../entitlementCache.js";
import type { StoredEntitlementCache } from "../entitlementCache.js";
import type { OnlineLicenseActivationClient, OnlineLicenseActivationResult } from "./lemonSqueezyLicenseClient.js";

export const onlineEntitlementRefreshIntervalDays = 7;
export const onlineEntitlementGraceDays = 30;

export interface ActivateOnlineProInput {
  licenseKey: string;
  instanceName: string;
  client: OnlineLicenseActivationClient;
  persistCache: (cache: StoredEntitlementCache) => Promise<void>;
  now?: Date;
}

export interface RefreshOnlineProInput {
  licenseKey: string;
  instanceId?: string;
  client: OnlineLicenseActivationClient;
  persistCache: (cache: StoredEntitlementCache) => Promise<void>;
  now?: Date;
}

export interface ActivateOnlineProResult {
  activated: boolean;
  activation: OnlineLicenseActivationResult;
  cache?: StoredEntitlementCache;
}

export interface RefreshOnlineProResult {
  refreshed: boolean;
  verification: OnlineLicenseActivationResult;
  cache?: StoredEntitlementCache;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date.getTime());

  next.setUTCDate(next.getUTCDate() + days);

  return next;
}

export function createOnlineEntitlementCache(activation: OnlineLicenseActivationResult, now: Date = new Date()): StoredEntitlementCache {
  return createStoredEntitlementCache({
    plan: "pro",
    source: "online",
    manifest: createCapabilityManifest("pro", getDefaultEnabledCapabilityIds("pro"), "entitlement"),
    cachedAt: now,
    expiresAt: activation.expiresAt,
    lastVerifiedAt: now,
    refreshDueAt: addDays(now, onlineEntitlementRefreshIntervalDays),
    graceExpiresAt: addDays(now, onlineEntitlementGraceDays),
    message: activation.message,
    provider: activation.provider,
    providerLicenseId: activation.providerLicenseId,
    providerInstanceId: activation.providerInstanceId,
    providerProductId: activation.providerProductId,
    providerVariantId: activation.providerVariantId,
    supporterTags: activation.supporterTags
  });
}

export async function activateOnlinePro(input: ActivateOnlineProInput): Promise<ActivateOnlineProResult> {
  const activation = await input.client.activateLicense(input.licenseKey, input.instanceName);

  if (activation.status !== "valid") {
    return {
      activated: false,
      activation
    };
  }

  const cache = createOnlineEntitlementCache(activation, input.now ?? new Date());

  await input.persistCache(cache);

  return {
    activated: true,
    activation,
    cache
  };
}

export async function refreshOnlinePro(input: RefreshOnlineProInput): Promise<RefreshOnlineProResult> {
  const verification = await input.client.validateLicense(input.licenseKey, input.instanceId);

  if (verification.status !== "valid") {
    return {
      refreshed: false,
      verification
    };
  }

  const cache = createOnlineEntitlementCache(verification, input.now ?? new Date());

  await input.persistCache(cache);

  return {
    refreshed: true,
    verification,
    cache
  };
}
