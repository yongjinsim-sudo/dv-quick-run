import * as assert from "assert";
import { buildQuickStartContent } from "../../commands/router/actions/onboarding/openQuickStartAction.js";

suite("quickStartContent", () => {
  test("includes Access Context orientation without RBAC or sales wording", () => {
    const content = buildQuickStartContent(true);

    assert.ok(content.includes("## Access Context"));
    assert.ok(content.includes("DV Quick Run: Investigate Access Context"));
    assert.ok(content.includes("users, application users, teams, roles, and business units"));
    assert.ok(content.includes("Check Application User Context"));
    assert.ok(content.includes("Check Business Unit Context"));
    assert.ok(content.includes("without treating DVQR as RBAC simulation or security administration tooling"));

    assert.strictEqual(content.includes("Open-core"), false);
    assert.strictEqual(content.includes("Pro acceleration"), false);
    assert.strictEqual(content.includes("Team/Enterprise"), false);
    assert.strictEqual(content.includes("Enterprise acceleration"), false);
  });

  test("places environment readiness before query-building guidance", () => {
    const content = buildQuickStartContent(true);
    const environmentIndex = content.indexOf("## Environment");
    const buildIndex = content.indexOf("## Build Queries Incrementally");
    const runIndex = content.indexOf("## Run your first query");

    assert.ok(environmentIndex > -1);
    assert.ok(buildIndex > -1);
    assert.ok(runIndex > -1);
    assert.ok(environmentIndex < buildIndex);
    assert.ok(buildIndex < runIndex);
    assert.ok(content.includes("✅ Active Dataverse environment detected and ready."));
  });
  test("introduces Local MCP before editor query-building guidance", () => {
    const content = buildQuickStartContent(true);
    const twoWaysIndex = content.indexOf("## Two ways to use DV Quick Run");
    const mcpIndex = content.indexOf("## Talk to Dataverse with Local MCP");
    const buildIndex = content.indexOf("## Build Queries Incrementally");

    assert.ok(twoWaysIndex > -1);
    assert.ok(mcpIndex > -1);
    assert.ok(twoWaysIndex < mcpIndex);
    assert.ok(mcpIndex < buildIndex);
    assert.ok(content.includes("DV Quick Run includes an extension-owned, read-only local MCP server"));
    assert.ok(content.includes("Build and investigate in the editor"));
    assert.ok(content.includes("az login --allow-no-subscriptions"));
    assert.ok(content.includes("Using DV Quick Run, find tables related to customers."));
    assert.ok(content.includes("no POST, PATCH, DELETE, upload, or remediation tools"));
  });

});
