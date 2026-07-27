import * as assert from "assert";
import { expandDvqrMetadataSearchTerms, rankDvqrMetadataEntities } from "../../mcp/mcpMetadataSearch.js";

suite("mcpMetadataSearch", () => {
  test("expands employee into deterministic Dataverse concepts", () => {
    const terms = expandDvqrMetadataSearchTerms("employee-related tables");
    assert.ok(terms.includes("employee"));
    assert.ok(terms.includes("systemuser"));
    assert.ok(terms.includes("team"));
    assert.ok(terms.includes("businessunit"));
  });

  test("ranks direct metadata matches ahead of concept aliases", () => {
    const results = rankDvqrMetadataEntities("account", [
      { LogicalName: "systemuser", SchemaName: "SystemUser", DisplayName: { UserLocalizedLabel: { Label: "User" } } },
      { LogicalName: "account", SchemaName: "Account", DisplayName: { UserLocalizedLabel: { Label: "Account" } } },
      { LogicalName: "businessunit", SchemaName: "BusinessUnit", DisplayName: { UserLocalizedLabel: { Label: "Business Unit" } } }
    ]);
    assert.strictEqual(results[0]?.logicalName, "account");
    assert.strictEqual(results[0]?.confidence, "high");
    assert.ok((results[0]?.reasons.length ?? 0) > 0);
  });

  test("returns transparent ranked employee-related entities", () => {
    const results = rankDvqrMetadataEntities("employee", [
      { LogicalName: "account", SchemaName: "Account", DisplayName: { UserLocalizedLabel: { Label: "Account" } } },
      { LogicalName: "systemuser", SchemaName: "SystemUser", DisplayName: { UserLocalizedLabel: { Label: "User" } } },
      { LogicalName: "team", SchemaName: "Team", DisplayName: { UserLocalizedLabel: { Label: "Team" } } },
      { LogicalName: "businessunit", SchemaName: "BusinessUnit", DisplayName: { UserLocalizedLabel: { Label: "Business Unit" } } }
    ]);
    assert.deepStrictEqual(results.map((result) => result.logicalName), ["systemuser", "businessunit", "team"]);
    assert.ok(results.every((result) => result.matchedTerms.length > 0));
    assert.ok(results.every((result) => result.reasons.length > 0));
  });

  test("returns no speculative results when no metadata or alias matches", () => {
    const results = rankDvqrMetadataEntities("zebra", [
      { LogicalName: "account", SchemaName: "Account", DisplayName: { UserLocalizedLabel: { Label: "Account" } } }
    ]);
    assert.deepStrictEqual(results, []);
  });
});
