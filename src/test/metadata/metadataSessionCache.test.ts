import * as assert from "assert";
import {
  clearMetadataSessionCache,
  getEntityDefsMemory,
  getFieldsMemory,
  getMetadataSessionCacheDiagnostics,
  getOrCreateEntityDefsInFlight,
  getOrCreateFieldsInFlight,
  setEntityDefsMemory,
  setFieldsMemory
} from "../../commands/router/actions/shared/metadataAccess/metadataSessionCache.js";

suite("metadataSessionCache", () => {
  setup(() => {
    clearMetadataSessionCache();
  });

  test("deduplicates entity defs in-flight requests", async () => {
    let calls = 0;
    const factory = async () => {
      calls++;
      await Promise.resolve();
      return [{ logicalName: "contact", entitySetName: "contacts" }];
    };

    const [a, b] = await Promise.all([
      getOrCreateEntityDefsInFlight(factory),
      getOrCreateEntityDefsInFlight(factory)
    ]);

    assert.strictEqual(calls, 1);
    assert.deepStrictEqual(a, b);
  });

  test("stores memory values and clears diagnostics", async () => {
    setEntityDefsMemory([{ logicalName: "contact", entitySetName: "contacts" }]);
    setFieldsMemory("contact", [{ logicalName: "fullname" }]);

    const before = getMetadataSessionCacheDiagnostics();
    assert.strictEqual(before.entityDefsLoaded, true);
    assert.deepStrictEqual(before.fieldsLogicalNames, ["contact"]);
    assert.ok(getEntityDefsMemory());
    assert.ok(getFieldsMemory("contact"));

    clearMetadataSessionCache();

    const after = getMetadataSessionCacheDiagnostics();
    assert.strictEqual(after.entityDefsLoaded, false);
    assert.deepStrictEqual(after.fieldsLogicalNames, []);
    assert.strictEqual(getEntityDefsMemory(), undefined);
    assert.strictEqual(getFieldsMemory("contact"), undefined);
  });

  test("deduplicates field in-flight requests by normalized logical name", async () => {
    let calls = 0;
    const factory = async () => {
      calls++;
      return [{ logicalName: "fullname" }];
    };

    const [a, b] = await Promise.all([
      getOrCreateFieldsInFlight("Contact", factory),
      getOrCreateFieldsInFlight(" contact ", factory)
    ]);

    assert.strictEqual(calls, 1);
    assert.deepStrictEqual(a, b);
  });
});
