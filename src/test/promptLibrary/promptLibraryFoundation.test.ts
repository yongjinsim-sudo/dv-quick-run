import * as assert from "assert";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";
import {
  DVQR_PROMPT_CATALOGUE,
  createDvqrPromptEvidenceMatrix,
  createDvqrPromptCatalogueCoverageReport,
  getDvqrPromptFollowUps,
  renderDvqrPrompt,
  searchDvqrPrompts,
  validateDvqrPromptCatalogue
} from "../../product/promptLibrary/index.js";

suite("promptLibraryFoundation", () => {
  test("builds one machine-readable evidence matrix entry for every live MCP tool", () => {
    const matrix = createDvqrPromptEvidenceMatrix();
    assert.strictEqual(matrix.length, DVQR_LIVE_MCP_TOOLS.length);
    assert.strictEqual(new Set(matrix.map((entry) => entry.toolName)).size, matrix.length);
    assert.strictEqual(matrix.filter((entry) => entry.tier === "free").length, 32);
    assert.strictEqual(matrix.filter((entry) => entry.tier === "pro").length, 32);
    assert.ok(matrix.every((entry) => entry.mutatesDataverse === false));
  });

  test("keeps relationship and Mini RCA evidence boundaries explicit", () => {
    const matrix = createDvqrPromptEvidenceMatrix();
    const relationship = matrix.find((entry) => entry.toolName === "dvqr_find_relationship_paths");
    const miniRca = matrix.find((entry) => entry.toolName === "dvqr_generate_mini_rca");
    assert.ok(relationship?.interpretationBoundary.some((line) => line.includes("runtime-viable")));
    assert.ok(miniRca?.interpretationBoundary.some((line) => line.includes("not root-cause proof")));
  });

  test("catalogue stays linked to the live tool tiers and evidence matrix", () => {
    const result = validateDvqrPromptCatalogue();
    assert.deepStrictEqual(result.errors, []);
    assert.strictEqual(result.valid, true);
    assert.ok(DVQR_PROMPT_CATALOGUE.length >= 20);
  });

  test("renders required prompt parameters without guessing missing values", () => {
    const prompt = DVQR_PROMPT_CATALOGUE.find((candidate) => candidate.id === "profile-table");
    assert.ok(prompt);
    const missing = renderDvqrPrompt(prompt!, {});
    assert.strictEqual(missing.isReady, false);
    assert.deepStrictEqual(missing.missingRequiredParameters, ["table"]);
    assert.ok(missing.text.includes("{{table}}"));

    const rendered = renderDvqrPrompt(prompt!, { table: "contact" });
    assert.strictEqual(rendered.isReady, true);
    assert.ok(rendered.text.includes("contact"));
    assert.ok(!rendered.text.includes("{{table}}"));
  });

  test("search is deterministic and supports tier/category discovery", () => {
    const score = searchDvqrPrompts({ query: "dvqr score" });
    assert.strictEqual(score[0]?.id, "profile-table");

    const pro = searchDvqrPrompts({ tier: "pro", categoryId: "managed-investigation" });
    assert.ok(pro.length >= 4);
    assert.ok(pro.every((prompt) => prompt.tier === "pro"));
  });

  test("follow-up journey links resolve to real prompts", () => {
    const followUps = getDvqrPromptFollowUps("profile-table");
    assert.deepStrictEqual(followUps.map((prompt) => prompt.id), ["profile-score-boundaries", "find-relationship-paths", "start-investigation"]);
  });

  test("public prompt examples stay generic and customer-neutral", () => {
    const serialized = JSON.stringify(DVQR_PROMPT_CATALOGUE).toLowerCase();
    for (const forbidden of ["customername", "msemr_careplan", "msemr_careplanactivities", "sample_tasks"]) {
      assert.ok(!serialized.includes(forbidden), `prompt catalogue must not contain customer-specific token ${forbidden}`);
    }
  });

  test("reports deliberate capability coverage with no accidental live-tool gaps", () => {
    const coverage = createDvqrPromptCatalogueCoverageReport();
    assert.strictEqual(coverage.totalToolCount, 64);
    assert.ok(coverage.totalPromptCount >= 30);
    assert.ok(coverage.coveredToolCount >= 30);
    assert.deepStrictEqual(coverage.uncoveredToolNames, []);
    assert.strictEqual(coverage.categories.length, 6);
    assert.ok(coverage.categories.every((category) => category.promptCount > 0));
  });

  test("keeps the curated catalogue as journeys instead of forcing one prompt per MCP tool", () => {
    const coverage = createDvqrPromptCatalogueCoverageReport();
    assert.ok(coverage.intentionallyUncoveredToolNames.length > 0);
    assert.ok(coverage.intentionallyUncoveredToolNames.includes("dvqr_execute_custom_api"));
    assert.ok(coverage.intentionallyUncoveredToolNames.includes("dvqr_confirm_investigation_intent"));
    assert.ok(coverage.terminalPromptIds.includes("interpret-custom-api-execution"));
  });

});
