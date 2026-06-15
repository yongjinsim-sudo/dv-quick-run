import { createCapabilityManifest } from "../capabilityManifest.js";
import { createStoredEntitlementCache, type StoredEntitlementCache } from "../entitlementCache.js";
import { verifySignedOfflineLicense } from "./offlineLicenseVerifier.js";
import type { OfflineLicenseVerificationResult } from "./offlineLicenseTypes.js";

export interface ImportOfflineLicenseInput {
  raw: string;
  persistCache: (cache: StoredEntitlementCache) => Promise<void>;
  now?: Date;
  publicKeyPem?: string;
}

export interface ImportOfflineLicenseResult {
  imported: boolean;
  verification: OfflineLicenseVerificationResult;
  cache?: StoredEntitlementCache;
}

export async function importOfflineLicense(input: ImportOfflineLicenseInput): Promise<ImportOfflineLicenseResult> {
  const verification = verifySignedOfflineLicense({
    raw: input.raw,
    publicKeyPem: input.publicKeyPem,
    now: input.now
  });

  if (verification.status !== "valid" || verification.license === undefined) {
    return {
      imported: false,
      verification
    };
  }

  const { payload } = verification.license;
  const cache = createStoredEntitlementCache({
    plan: "pro",
    source: "offline",
    manifest: createCapabilityManifest("pro", payload.capabilities, "entitlement"),
    cachedAt: input.now ?? new Date(),
    expiresAt: payload.expiresAt === null ? null : new Date(payload.expiresAt),
    message: `Offline Pro license imported (${payload.grantType}).`,
    provider: "offline",
    providerLicenseId: payload.licenseId
  });

  await input.persistCache(cache);

  return {
    imported: true,
    verification,
    cache
  };
}
