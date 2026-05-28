import * as assert from "assert";
import { matchIdentityParticipation, normalizeIdentityName } from "../../core/comparison/index.js";

suite("identity comparison matching", () => {
  test("normalizes conservative boundary environment tokens including perf, qa, sandbox, and sbx", () => {
    assert.deepStrictEqual(normalizeIdentityName("service_account_perf"), {
      original: "service_account_perf",
      normalized: "service_account",
      removedTokens: ["perf"]
    });

    assert.deepStrictEqual(normalizeIdentityName("qa platform integration"), {
      original: "qa platform integration",
      normalized: "platform_integration",
      removedTokens: ["qa"]
    });

    assert.deepStrictEqual(normalizeIdentityName("sandbox_crm_app_user_sbx"), {
      original: "sandbox_crm_app_user_sbx",
      normalized: "crm_app_user",
      removedTokens: ["sandbox", "sbx"]
    });
  });

  test("does not remove environment-like tokens from the middle of an identity name", () => {
    assert.deepStrictEqual(normalizeIdentityName("service_np_msi"), {
      original: "service_np_msi",
      normalized: "service_np_msi",
      removedTokens: []
    });
  });

  test("detects likely service identity matches using normalized names and participation evidence", () => {
    const matches = matchIdentityParticipation(
      [
        {
          subjectType: "applicationUser",
          displayName: "service_account_dev",
          isApplicationUser: true,
          roles: ["Integration Role"],
          teams: ["Platform Team"]
        }
      ],
      [
        {
          subjectType: "applicationUser",
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

  test("treats boundary-token normalized evidence alone as possible rather than exact", () => {
    const matches = matchIdentityParticipation(
      [{ displayName: "service_msi_np" }],
      [{ displayName: "service_msi" }]
    );

    assert.strictEqual(matches[0].confidence, "PossibleMatch");
  });

  test("uses exact anchors before normalized display names", () => {
    const matches = matchIdentityParticipation(
      [{ subjectType: "user", displayName: "CRM User DEV", azureAdObjectId: "AAD-1" }],
      [{ subjectType: "user", displayName: "CRM User SIT", azureAdObjectId: "aad-1" }]
    );

    assert.strictEqual(matches[0].confidence, "ExactMatch");
    assert.ok(matches[0].evidence.some((item) => item.label === "Azure AD object id"));
  });

  test("does not match different Dataverse-native identity subject types", () => {
    const matches = matchIdentityParticipation(
      [{ subjectType: "team", displayName: "Platform Operators DEV", teamType: "Owner" }],
      [{ subjectType: "role", displayName: "Platform Operators SIT", businessUnitName: "Root" }]
    );

    assert.strictEqual(matches[0].confidence, "NoMatch");
  });

  test("matches roles by normalized role name with business unit support", () => {
    const matches = matchIdentityParticipation(
      [{ subjectType: "role", displayName: "Integration Role DEV", businessUnitName: "Root" }],
      [{ subjectType: "role", displayName: "Integration Role SIT", businessUnitName: "root" }]
    );

    assert.strictEqual(matches[0].confidence, "LikelyMatch");
    assert.ok(matches[0].evidence.some((item) => item.label === "Business unit"));
  });
});
