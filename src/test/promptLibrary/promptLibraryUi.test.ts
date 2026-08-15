import * as assert from "assert";
import { buildPromptLibraryViewModel } from "../../commands/promptLibrary/promptLibraryViewModel.js";
import { DVQR_PROMPT_CATALOGUE } from "../../product/promptLibrary/promptCatalogue.js";
import { getPromptLibraryStyles } from "../../webview/promptLibrary/styles.js";
import { getPromptLibraryMarkup } from "../../webview/promptLibrary/markup.js";

suite("promptLibrary UI view model", () => {
  test("projects the full curated catalogue and six categories", () => {
    const model = buildPromptLibraryViewModel("free");
    assert.strictEqual(model.promptCount, DVQR_PROMPT_CATALOGUE.length);
    assert.strictEqual(model.categories.length, 6);
    assert.strictEqual(model.prompts.length, DVQR_PROMPT_CATALOGUE.length);
  });

  test("keeps Pro journeys visible but unavailable on Free", () => {
    const freeModel = buildPromptLibraryViewModel("free");
    const proPrompts = freeModel.prompts.filter((prompt) => prompt.tier === "pro");
    assert.ok(proPrompts.length > 0);
    assert.ok(proPrompts.every((prompt) => !prompt.available));

    const proModel = buildPromptLibraryViewModel("pro");
    assert.ok(proModel.prompts.every((prompt) => prompt.available));
  });

  test("preserves catalogue parameters and follow-up journey links", () => {
    const model = buildPromptLibraryViewModel("free");
    const profile = model.prompts.find((prompt) => prompt.id === "profile-table");
    if (!profile) throw new Error("Expected profile-table prompt in UI model.");
    assert.ok(profile.parameters.some((parameter) => parameter.id === "table"));
    assert.ok(profile.followUpPromptIds.includes("profile-score-boundaries"));
  });


  test("curates quick starts across discovery, traversal, profile, Custom API and managed investigation", () => {
    const model = buildPromptLibraryViewModel("pro");
    assert.strictEqual(model.quickStartPromptIds.length, 8);
    for (const id of model.quickStartPromptIds) {
      assert.ok(model.prompts.some((prompt) => prompt.id === id), `Unknown quick-start prompt: ${id}`);
    }
  });

  test("de-emphasises raw MCP tool names on catalogue cards while keeping capability transparency in details", () => {
    const model = buildPromptLibraryViewModel("pro");
    const html = getPromptLibraryMarkup(model);
    assert.ok(html.includes("Recommended starting points"));
    assert.ok(html.includes("DVQR capability"));
    assert.ok(!html.includes("Metadata &amp; Queries · dvqr_get_entity_metadata"));
  });

  test("forces hidden filtered cards out of layout even when prompt cards declare display flex", () => {
    const css = getPromptLibraryStyles();
    assert.ok(css.includes("[hidden] { display: none !important; }"));
  });

  test("keeps prompt UI content customer-neutral", () => {
    const serialized = JSON.stringify(buildPromptLibraryViewModel("pro")).toLowerCase();
    assert.ok(!serialized.includes("bupa"));
    assert.ok(!serialized.includes("msemr_"));
    assert.ok(!serialized.includes("bu_tasks"));
  });
});
