import * as assert from "assert";
import { attackFamilies } from "./adversarialCase.js";
import { hostileBusinessPathFixtures } from "./fixtures/hostileBusinessPaths.js";
import { hostileMetadataFixtures } from "./fixtures/hostileMetadata.js";
import { hostileTextFixtures } from "./fixtures/hostileText.js";
import { malformedIdentifierFixtures } from "./fixtures/malformedIdentifiers.js";
import { oversizedPayloadFixtures } from "./fixtures/oversizedPayloads.js";
import { fakeSecrets, providerErrorFixtures } from "./fixtures/providerErrors.js";
import { pathologicalGraphFixtures } from "./fixtures/pathologicalGraphs.js";

suite("Security adversarial fixtures", () => {
  test("declares the permanent A01-A20 attack taxonomy", () => {
    assert.strictEqual(attackFamilies.length, 20);
    assert.deepStrictEqual(attackFamilies[0], "A01");
    assert.deepStrictEqual(attackFamilies[19], "A20");
    assert.strictEqual(new Set(attackFamilies).size, 20);
  });

  test("hostile text corpus spans the locked content categories without real credentials", () => {
    assert.ok(hostileTextFixtures.length >= 16);
    const categories = new Set(hostileTextFixtures.map((fixture) => fixture.category));
    for (const required of [
      "instruction override",
      "tool invocation request",
      "environment switch request",
      "entitlement escalation request",
      "file read/write request",
      "secret request",
      "path traversal text",
      "JSON/code-block smuggling",
      "fake system/developer/user prefixes",
      "fake DVQR result blocks"
    ]) {
      assert.strictEqual(categories.has(required), true, required);
    }
    const corpus = hostileTextFixtures.map((fixture) => fixture.value).join("\n");
    assert.doesNotMatch(corpus, /[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}\.[A-Za-z0-9_-]{24,}/);
  });

  test("metadata fixtures preserve hostile content as descriptive text only", () => {
    assert.ok(hostileMetadataFixtures.length > 0);
    assert.ok(hostileMetadataFixtures.every((fixture) => fixture.logicalName.startsWith("dvqr_test_")));
  });

  test("malicious Business Path corpus includes governance, environment, workspace and identity abuse", () => {
    const ids = new Set(hostileBusinessPathFixtures.map((fixture) => fixture.id));
    for (const required of [
      "foreign-environment",
      "injected-file-path",
      "governance-escalation",
      "fake-verification",
      "hostile-notes",
      "prototype-pollution-shape",
      "identity-collision-attempt"
    ]) {
      assert.strictEqual(ids.has(required), true, required);
    }
  });

  test("identifier corpus includes path, URL/query fragment, control and oversized forms", () => {
    assert.ok(malformedIdentifierFixtures.some((fixture) => fixture.id === "encoded-delimiter"));
    assert.ok(malformedIdentifierFixtures.some((fixture) => fixture.id === "path-fragment"));
    assert.ok(malformedIdentifierFixtures.some((fixture) => fixture.id === "control-character"));
    assert.ok(malformedIdentifierFixtures.some((fixture) => fixture.id === "oversized"));
  });

  test("oversized fixtures exercise size and nesting pressure without external data", () => {
    assert.ok(oversizedPayloadFixtures.hugeString.length >= 128 * 1024);
    assert.ok(oversizedPayloadFixtures.hugeArray.length >= 4096);
    assert.match(oversizedPayloadFixtures.malformedJson, /^\{/);
  });

  test("provider error corpus uses deterministic fake secret sentinels only", () => {
    assert.ok(providerErrorFixtures.length >= 5);
    for (const secret of Object.values(fakeSecrets)) {
      assert.match(secret, /^DVQR_TEST_/);
      assert.ok(providerErrorFixtures.some((fixture) => JSON.stringify(fixture).includes(secret) || (fixture instanceof Error && fixture.message.includes(secret))));
    }
  });

  test("pathological graph corpus includes cycle, fan-out, fan-in and deep cases", () => {
    const ids = new Set(pathologicalGraphFixtures.map((fixture) => fixture.id));
    for (const required of ["self-cycle", "two-node-cycle", "long-cycle", "high-fan-out", "high-fan-in", "deep-beyond-normal-bound"]) {
      assert.strictEqual(ids.has(required), true, required);
    }
  });
});
