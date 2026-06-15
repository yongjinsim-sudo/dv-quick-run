import * as assert from "assert";
import { generateKeyPairSync, sign } from "crypto";
import { canonicalJson } from "../../product/capabilities/offlineLicensing/canonicalJson.js";
import { importOfflineLicense } from "../../product/capabilities/offlineLicensing/offlineLicenseImportService.js";
import type { CapabilityId } from "../../product/capabilities/capabilityIds.js";
import { offlineLicenseKind, type OfflineLicensePayload, type SignedOfflineLicenseFile } from "../../product/capabilities/offlineLicensing/offlineLicenseTypes.js";
import { parseSignedOfflineLicense, verifySignedOfflineLicense } from "../../product/capabilities/offlineLicensing/offlineLicenseVerifier.js";
import type { StoredEntitlementCache } from "../../product/capabilities/entitlementCache.js";

function resolveSignatureAlgorithm(privateKey: ReturnType<typeof generateKeyPairSync>["privateKey"]): string | null {
  return privateKey.asymmetricKeyType === "rsa" ? "RSA-SHA256" : null;
}

function createSignedLicense(payloadPatch: Partial<OfflineLicensePayload> = {}, algorithm: "rsa" | "ed25519" = "rsa") {
  const keyPair = algorithm === "rsa"
    ? generateKeyPairSync("rsa", { modulusLength: 2048 })
    : generateKeyPairSync("ed25519");
  const payload: OfflineLicensePayload = {
    licenseId: "dvqr_offline_test_0001",
    edition: "pro",
    grantType: "offline",
    issuedAt: "2026-06-01T00:00:00.000Z",
    expiresAt: "2027-06-01T00:00:00.000Z",
    capabilities: [
      "crossEnvironmentDiff",
      "comparisonReportExport",
      "investigationHandoffExport"
    ],
    ...payloadPatch
  };

  const signature = sign(resolveSignatureAlgorithm(keyPair.privateKey), Buffer.from(canonicalJson(payload), "utf8"), keyPair.privateKey).toString("base64");
  const license: SignedOfflineLicenseFile = {
    kind: offlineLicenseKind,
    payload,
    signature
  };

  return {
    raw: JSON.stringify(license, null, 2),
    publicKeyPem: keyPair.publicKey.export({ type: "spki", format: "pem" }).toString()
  };
}

suite("offlineLicenseVerifier", () => {
  test("verifies a RSA signed offline Pro license", () => {
    const license = createSignedLicense();
    const result = verifySignedOfflineLicense({
      raw: license.raw,
      publicKeyPem: license.publicKeyPem,
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    assert.strictEqual(result.status, "valid");
    assert.strictEqual(result.license?.payload.licenseId, "dvqr_offline_test_0001");
  });


  test("verifies a legacy Ed25519 signed offline Pro license", () => {
    const license = createSignedLicense({}, "ed25519");
    const result = verifySignedOfflineLicense({
      raw: license.raw,
      publicKeyPem: license.publicKeyPem,
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    assert.strictEqual(result.status, "valid");
  });

  test("rejects a modified signed license payload", () => {
    const license = createSignedLicense();
    const parsed = JSON.parse(license.raw) as SignedOfflineLicenseFile;
    parsed.payload.capabilities.push("snapshotReplay");

    const result = verifySignedOfflineLicense({
      raw: JSON.stringify(parsed),
      publicKeyPem: license.publicKeyPem,
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    assert.strictEqual(result.status, "invalid");
  });

  test("rejects an expired offline license", () => {
    const license = createSignedLicense({ expiresAt: "2026-01-01T00:00:00.000Z" });
    const result = verifySignedOfflineLicense({
      raw: license.raw,
      publicKeyPem: license.publicKeyPem,
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    assert.strictEqual(result.status, "expired");
  });

  test("rejects unreadable license JSON", () => {
    const result = verifySignedOfflineLicense({
      raw: "not-json",
      now: new Date("2026-06-02T00:00:00.000Z")
    });

    assert.strictEqual(result.status, "invalid");
  });

  test("normalizes duplicate and unknown capability values", () => {
    const license = createSignedLicense({
      capabilities: [
        "crossEnvironmentDiff",
        "crossEnvironmentDiff",
        "comparisonReportExport",
        "notARealCapability" as CapabilityId
      ]
    });

    const parsed = parseSignedOfflineLicense(license.raw);

    assert.deepStrictEqual(parsed?.payload.capabilities, [
      "crossEnvironmentDiff",
      "comparisonReportExport"
    ]);
  });

  test("imports valid offline license into entitlement cache", async () => {
    const license = createSignedLicense();
    let persisted: StoredEntitlementCache | undefined;

    const result = await importOfflineLicense({
      raw: license.raw,
      publicKeyPem: license.publicKeyPem,
      now: new Date("2026-06-02T00:00:00.000Z"),
      persistCache: async (cache) => {
        persisted = cache;
      }
    });

    assert.strictEqual(result.imported, true);
    assert.strictEqual(persisted?.source, "offline");
    assert.strictEqual(persisted?.provider, "offline");
    assert.strictEqual(persisted?.providerLicenseId, "dvqr_offline_test_0001");
    assert.deepStrictEqual(persisted?.manifest.grants.filter((grant) => grant.enabled).map((grant) => grant.capabilityId), [
      "crossEnvironmentDiff",
      "comparisonReportExport",
      "investigationHandoffExport"
    ]);
  });



  test("does not persist invalid offline license", async () => {
    let persisted = false;
    const result = await importOfflineLicense({
      raw: "not-json",
      now: new Date("2026-06-02T00:00:00.000Z"),
      persistCache: async () => {
        persisted = true;
      }
    });

    assert.strictEqual(result.imported, false);
    assert.strictEqual(persisted, false);
  });
});
