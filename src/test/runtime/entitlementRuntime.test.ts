import * as assert from "assert";
import { createCapabilityManifest } from "../../product/capabilities/capabilityManifest.js";
import { createStoredEntitlementCache, entitlementCacheKey, entitlementCacheSchemaVersion, normalizeStoredEntitlementCache, resolveStoredEntitlementCache, type StoredEntitlementCache } from "../../product/capabilities/entitlementCache.js";
import { clearEntitlementCache, persistEntitlementCache, resolveConfiguredEntitlementForTests, resolveEntitlement, setEntitlementStorageForTests, type EntitlementStorage } from "../../product/capabilities/entitlementResolver.js";
import { canUse, resolveCapabilityManifest, resolveCapabilityState } from "../../product/capabilities/capabilityResolver.js";

class MemoryEntitlementStorage implements EntitlementStorage {
  private readonly values = new Map<string, unknown>();

  get<T>(key: string): T | undefined {
    return this.values.get(key) as T | undefined;
  }

  async update(key: string, value: unknown): Promise<void> {
    if (value === undefined) {
      this.values.delete(key);
      return;
    }

    this.values.set(key, value);
  }
}

suite("entitlementRuntime", () => {
  teardown(() => {
    setEntitlementStorageForTests(undefined);
  });

  test("normalizes persisted Pro entitlement cache", () => {
    const manifest = createCapabilityManifest("pro", [
      "crossEnvironmentDiff",
      "comparisonReportExport"
    ], "entitlement");

    const cache = createStoredEntitlementCache({
      plan: "pro",
      source: "online",
      manifest,
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: new Date("2027-06-01T00:00:00Z")
    });

    assert.deepStrictEqual(normalizeStoredEntitlementCache(cache), {
      schemaVersion: entitlementCacheSchemaVersion,
      plan: "pro",
      status: "valid",
      source: "online",
      manifest,
      cachedAt: "2026-06-01T00:00:00.000Z",
      expiresAt: "2027-06-01T00:00:00.000Z"
    });
  });


  test("normalizes supporter tags in persisted entitlement cache", () => {
    const cache = createStoredEntitlementCache({
      plan: "pro",
      source: "online",
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement"),
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: new Date("2027-06-01T00:00:00Z"),
      supporterTags: ["Pathfinder"]
    });

    const normalized = normalizeStoredEntitlementCache(cache);

    assert.deepStrictEqual(normalized?.supporterTags, ["Pathfinder"]);
  });

  test("rejects corrupted cache payloads", () => {
    assert.strictEqual(normalizeStoredEntitlementCache({}), undefined);
    assert.strictEqual(normalizeStoredEntitlementCache({ schemaVersion: entitlementCacheSchemaVersion, plan: "pro" }), undefined);
    assert.strictEqual(normalizeStoredEntitlementCache({
      schemaVersion: entitlementCacheSchemaVersion,
      plan: "team",
      status: "valid",
      source: "online",
      cachedAt: "2026-06-01T00:00:00Z",
      expiresAt: null,
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement")
    }), undefined);
  });

  test("resolves missing cache as unknown and corrupted cache as corrupted", () => {
    assert.deepStrictEqual(resolveStoredEntitlementCache(undefined), {
      status: "unknown"
    });

    assert.deepStrictEqual(resolveStoredEntitlementCache({}), {
      status: "corrupted",
      message: "Cached entitlement was not readable. DVQR has continued in Free mode."
    });
  });

  test("resolves expired cache as expired", () => {
    const cache = createStoredEntitlementCache({
      plan: "pro",
      source: "online",
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement"),
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: new Date("2026-07-01T00:00:00Z")
    });

    const result = resolveStoredEntitlementCache(cache, new Date("2026-07-02T00:00:00Z"));

    assert.strictEqual(result.status, "expired");
    assert.strictEqual(result.cache?.plan, "pro");
  });

  test("uses valid persisted entitlement before configuration fallback", async () => {
    const storage = new MemoryEntitlementStorage();
    setEntitlementStorageForTests(storage);

    const cache = createStoredEntitlementCache({
      plan: "pro",
      source: "online",
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement"),
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: new Date("2027-06-01T00:00:00Z")
    });

    await persistEntitlementCache(cache);

    const entitlement = resolveEntitlement(new Date("2026-06-02T00:00:00Z"));

    assert.strictEqual(entitlement.plan, "pro");
    assert.strictEqual(entitlement.status, "valid");
    assert.strictEqual(entitlement.source, "online");
    assert.strictEqual(canUse("crossEnvironmentDiff", entitlement), true);
    assert.strictEqual(canUse("comparisonReportExport", entitlement), true);
  });

  test("expired persisted entitlement degrades to Free", async () => {
    const storage = new MemoryEntitlementStorage();
    setEntitlementStorageForTests(storage);

    await persistEntitlementCache(createStoredEntitlementCache({
      plan: "pro",
      source: "online",
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement"),
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: new Date("2026-06-02T00:00:00Z")
    }));

    const entitlement = resolveEntitlement(new Date("2026-06-03T00:00:00Z"));

    assert.strictEqual(entitlement.plan, "free");
    assert.strictEqual(entitlement.status, "expired");
    assert.strictEqual(resolveCapabilityManifest(entitlement).edition, "free");
    assert.strictEqual(resolveCapabilityState("crossEnvironmentDiff", entitlement).enabled, false);
  });

  test("corrupted persisted entitlement degrades to Free", async () => {
    const storage = new MemoryEntitlementStorage();
    setEntitlementStorageForTests(storage);

    await storage.update(entitlementCacheKey, {
      schemaVersion: entitlementCacheSchemaVersion,
      plan: "pro",
      status: "valid",
      source: "online",
      cachedAt: "not-a-date",
      expiresAt: null,
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement")
    });

    const entitlement = resolveEntitlement(new Date("2026-06-03T00:00:00Z"));

    assert.strictEqual(entitlement.plan, "free");
    assert.strictEqual(entitlement.status, "corrupted");
    assert.strictEqual(canUse("crossEnvironmentDiff", entitlement), false);
  });


  test("does not grant Pro from workspace configuration fallback", () => {
    const entitlement = resolveConfiguredEntitlementForTests("pro");

    assert.strictEqual(entitlement.plan, "free");
    assert.strictEqual(entitlement.status, "valid");
    assert.strictEqual(entitlement.source, "configuration");
    assert.strictEqual(canUse("crossEnvironmentDiff", entitlement), false);
  });

  test("clears persisted entitlement cache", async () => {
    const storage = new MemoryEntitlementStorage();
    setEntitlementStorageForTests(storage);

    const cache: StoredEntitlementCache = createStoredEntitlementCache({
      plan: "pro",
      source: "offline",
      manifest: createCapabilityManifest("pro", ["crossEnvironmentDiff"], "entitlement"),
      cachedAt: new Date("2026-06-01T00:00:00Z"),
      expiresAt: null
    });

    await persistEntitlementCache(cache);
    assert.ok(storage.get(entitlementCacheKey));

    await clearEntitlementCache();
    assert.strictEqual(storage.get(entitlementCacheKey), undefined);
  });
});
