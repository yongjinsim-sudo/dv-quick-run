import * as assert from "assert";
import { buildQuickStartContent } from "../../commands/router/actions/onboarding/openQuickStartAction.js";

suite("quickStartContent", () => {
  test("is a concise task-oriented v1 quick start", () => {
    const content = buildQuickStartContent(true);

    assert.ok(content.includes("# DV Quick Run — Quick Start"));
    assert.ok(content.includes("## 1. Choose how you want to start"));
    assert.ok(content.includes("## 2. Run your first query"));
    assert.ok(content.includes("## 3. Follow the evidence"));
    assert.ok(content.includes("## Optional: Talk to Dataverse with Local MCP"));
    assert.ok(content.includes("Prompt Library"));
    assert.ok(content.includes("DV Quick Run: Open Hub"));
    assert.ok(content.includes("contacts?$select=fullname,emailaddress1&$top=5"));

    assert.strictEqual(content.includes("Security Hardening II"), false);
    assert.strictEqual(content.includes("A01–A20"), false);
    assert.strictEqual(content.includes("empty saved-path frontier"), false);
  });

  test("keeps environment readiness before the first runnable query", () => {
    const content = buildQuickStartContent(true);
    const environmentIndex = content.indexOf("## Environment");
    const firstQueryIndex = content.indexOf("## 2. Run your first query");

    assert.ok(environmentIndex > -1);
    assert.ok(firstQueryIndex > -1);
    assert.ok(environmentIndex < firstQueryIndex);
    assert.ok(content.includes("✅ Active Dataverse environment detected and ready."));
  });

  test("retains optional MCP and Access Context orientation without turning quickstart into policy documentation", () => {
    const content = buildQuickStartContent(true);

    assert.ok(content.includes("extension-owned Local MCP server"));
    assert.ok(content.includes("az login --allow-no-subscriptions"));
    assert.ok(content.includes("Using DV Quick Run, show me what I can investigate"));
    assert.ok(content.includes("DV Quick Run: Investigate Access Context"));
    assert.ok(content.includes("users, application users, teams, roles, and business units"));
    assert.ok(content.includes("without treating DVQR as RBAC simulation or security administration tooling"));
  });
});
