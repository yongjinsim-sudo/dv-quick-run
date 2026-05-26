import * as assert from "assert";
import { matchIdentityParticipation, normalizeIdentityName } from "../../core/comparison/index.js";

suite("identity comparison matching", () => {
  test("normalizes enterprise environment tokens including perf without asserting identity certainty", () => {
    assert.deepStrictEqual(normalizeIdentityName("service_account_perf"), {
      original: "service_account_perf",
      normalized: "service_account",
      removedTokens: ["perf"]
    });
  });

  test("detects likely service identity matches using normalized names and participation evidence", () => {
    const matches = matchIdentityParticipation(
      [
        {
          displayName: "service_account_dev",
          isApplicationUser: true,
          roles: ["Integration Role"],
          teams: ["Platform Team"]
        }
      ],
      [
        {
          displayName: "service_account_sit",
          isApplicationUser: true,
          roles: ["Integration Role"],
          teams: ["Platform Team"]
        }
      ]
    );

    assert.strictEqual(matches.length, 1);
    assert.strictEqual(matches[0].confidence, "LikelyMatch");
    assert.strictEqual(matches[0].normalizedKey, "service_account");
    assert.ok(matches[0].evidence.some((item) => item.label === "Normalized name"));
  });

  test("treats token-only normalized evidence as possible rather than exact", () => {
    const matches = matchIdentityParticipation(
      [{ displayName: "service_np_msi" }],
      [{ displayName: "service_msi" }]
    );

    assert.strictEqual(matches[0].confidence, "PossibleMatch");
  });
});
