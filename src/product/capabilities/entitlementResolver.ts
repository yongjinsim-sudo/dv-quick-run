import * as vscode from "vscode";
import { createCapabilityManifest } from "./capabilityManifest.js";
import { getDefaultEnabledCapabilityIds } from "./capabilityRegistry.js";
import { entitlementCacheKey, resolveStoredEntitlementCache, type StoredEntitlementCache } from "./entitlementCache.js";
import type { EntitlementContext } from "./entitlementTypes.js";
import { normalizeEntitlementPlan } from "./entitlementTypes.js";

export interface EntitlementStorage {
  get<T>(key: string): T | undefined;
  update(key: string, value: unknown): Thenable<void>;
}

let entitlementStorage: EntitlementStorage | undefined;

export function initializeEntitlementRuntime(context: vscode.ExtensionContext): void {
  entitlementStorage = context.globalState;
}

export function setEntitlementStorageForTests(storage: EntitlementStorage | undefined): void {
  entitlementStorage = storage;
}

function withDefaultProCapabilities(entitlement: EntitlementContext): EntitlementContext {
  if (entitlement.plan !== "pro" || (entitlement.status !== undefined && entitlement.status !== "valid" && entitlement.status !== "stale")) {
    return entitlement;
  }

  const enabledCapabilityIds = new Set(getDefaultEnabledCapabilityIds("pro"));

  for (const grant of entitlement.manifest?.grants ?? []) {
    if (grant.enabled === true) {
      enabledCapabilityIds.add(grant.capabilityId);
    }
  }

  return {
    ...entitlement,
    manifest: createCapabilityManifest("pro", [...enabledCapabilityIds], "entitlement")
  };
}

function resolveConfiguredEntitlement(): EntitlementContext {
  const configuredPlan = vscode.workspace
    .getConfiguration("dvQuickRun")
    .get<string>("productPlan", "free");

  const normalizedPlan = normalizeEntitlementPlan(configuredPlan);

  return {
    plan: normalizedPlan,
    status: "valid",
    source: "configuration"
  };
}

export function resolveEntitlement(now: Date = new Date()): EntitlementContext {
  const cached = resolveStoredEntitlementCache(entitlementStorage?.get<unknown>(entitlementCacheKey), now);

  if ((cached.status === "valid" || cached.status === "stale") && cached.cache !== undefined) {
    const entitlement: EntitlementContext = {
      plan: cached.cache.plan,
      status: cached.status,
      manifest: cached.cache.manifest,
      source: cached.cache.source,
      cachedAt: cached.cache.cachedAt,
      expiresAt: cached.cache.expiresAt
    };

    if (cached.cache.lastVerifiedAt !== undefined) {
      entitlement.lastVerifiedAt = cached.cache.lastVerifiedAt;
    }
    if (cached.cache.refreshDueAt !== undefined) {
      entitlement.refreshDueAt = cached.cache.refreshDueAt;
    }
    if (cached.cache.graceExpiresAt !== undefined) {
      entitlement.graceExpiresAt = cached.cache.graceExpiresAt;
    }
    if (cached.cache.message !== undefined) {
      entitlement.message = cached.cache.message;
    }
    if (cached.cache.provider !== undefined) {
      entitlement.provider = cached.cache.provider;
    }
    if (cached.cache.providerLicenseId !== undefined) {
      entitlement.providerLicenseId = cached.cache.providerLicenseId;
    }
    if (cached.cache.providerInstanceId !== undefined) {
      entitlement.providerInstanceId = cached.cache.providerInstanceId;
    }
    if (cached.cache.providerProductId !== undefined) {
      entitlement.providerProductId = cached.cache.providerProductId;
    }
    if (cached.cache.providerVariantId !== undefined) {
      entitlement.providerVariantId = cached.cache.providerVariantId;
    }
    if (cached.cache.supporterTags !== undefined && cached.cache.supporterTags.length > 0) {
      entitlement.supporterTags = [...cached.cache.supporterTags];
    }

    return withDefaultProCapabilities(entitlement);
  }

  if (cached.status === "corrupted" || cached.status === "expired") {
    return {
      plan: "free",
      status: cached.status,
      source: cached.cache?.source,
      cachedAt: cached.cache?.cachedAt,
      expiresAt: cached.cache?.expiresAt,
      lastVerifiedAt: cached.cache?.lastVerifiedAt,
      refreshDueAt: cached.cache?.refreshDueAt,
      graceExpiresAt: cached.cache?.graceExpiresAt,
      message: cached.message,
      supporterTags: cached.cache?.supporterTags
    };
  }

  return withDefaultProCapabilities(resolveConfiguredEntitlement());
}

export async function persistEntitlementCache(cache: StoredEntitlementCache): Promise<void> {
  await entitlementStorage?.update(entitlementCacheKey, cache);
}

export async function clearEntitlementCache(): Promise<void> {
  await entitlementStorage?.update(entitlementCacheKey, undefined);
}
