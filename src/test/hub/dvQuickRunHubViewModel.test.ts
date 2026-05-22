import * as assert from "assert";
import { buildDvQuickRunHubViewModel } from "../../commands/hub/dvQuickRunHubViewModel.js";
import { renderDvQuickRunHubHtml } from "../../webview/hub/renderDvQuickRunHubHtml.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";

suite("dvQuickRunHubViewModel", () => {
  test("contains the canonical v0.9.17 hub sections", () => {
    const model = buildDvQuickRunHubViewModel();

    assert.strictEqual(model.title, "DV Quick Run Hub");
    assert.deepStrictEqual(model.sectionLinks.map((link) => link.anchor), [
      "current-context",
      "access-context",
      "playbooks",
      "capabilities",
      "whats-new",
      "direction",
      "philosophy"
    ]);
  });

  test("keeps playbooks workflow-oriented and capability-linked", () => {
    const model = buildDvQuickRunHubViewModel();

    assert.ok(model.playbooks.length >= 5);
    for (const playbook of model.playbooks) {
      assert.ok(playbook.title.length > 0);
      assert.ok(playbook.summary.length > 0);
      assert.ok(playbook.whenToUse.length > 0);
      assert.ok(playbook.flow.length >= 3);
      assert.ok(playbook.relatedCapabilities.length > 0);
    }
  });

  test("exposes self-contained Hub workflows as launchable from an empty Hub context", () => {
    const model = buildDvQuickRunHubViewModel();
    const launchable = model.capabilities.filter((capability) => capability.contextState?.launchable).map((capability) => capability.id);

    assert.deepStrictEqual(launchable, ["guided-traversal", "capability-explorer"]);
  });

  test("groups capabilities by operational use", () => {
    const model = buildDvQuickRunHubViewModel();
    const groups = new Set(model.capabilities.map((capability) => capability.group));

    assert.ok(groups.has("Query & Explore"));
    assert.ok(groups.has("Refine & Understand"));
    assert.ok(groups.has("Navigate Relationships"));
    assert.ok(groups.has("Investigate Runtime"));
    assert.ok(groups.has("Act Safely"));
  });

  test("renders hub HTML with CSP and required sections", () => {
    const model = buildDvQuickRunHubViewModel();
    const html = renderDvQuickRunHubHtml({ cspSource: "vscode-resource:" } as never, model);

    assert.ok(html.includes("Content-Security-Policy"));
    assert.ok(html.includes("nonce-"));
    assert.ok(html.includes('id="current-context"'));
    assert.ok(html.includes('id="access-context"'));
    assert.ok(html.includes('id="playbooks"'));
    assert.ok(html.includes('id="capabilities"'));
    assert.ok(html.includes('id="whats-new"'));
    assert.ok(html.includes('id="direction"'));
    assert.ok(html.includes('id="philosophy"'));
  });

  test("renders continuation actions without duplicating guided traversal launch wording", () => {
    const context: InvestigationContext = {
      id: "test-context",
      source: "resultViewer",
      currentEntity: { logicalName: "contact", displayName: "Contact" },
      currentQuery: { queryText: "contacts?$top=5", queryType: "odata" },
      lastUpdatedUtc: "2026-05-11T00:00:00.000Z"
    };
    const model = buildDvQuickRunHubViewModel(context);
    const html = renderDvQuickRunHubHtml({ cspSource: "vscode-resource:" } as never, model);

    assert.ok(html.includes("Available continuations"));
    assert.ok(html.includes("Continue from query context"));
    assert.ok(html.includes("Continue from entity context"));
    assert.ok(html.includes("Open Operational Profile"));
    assert.ok(html.includes("Export Profile Snapshot"));
    assert.ok(html.includes("data-command=&quot;dvQuickRun.openOperationalProfileSurface&quot;") || html.includes('data-command="dvQuickRun.openOperationalProfileSurface"'));
    assert.ok(html.includes("data-command=&quot;dvQuickRun.exportOperationalProfileSnapshot&quot;") || html.includes('data-command="dvQuickRun.exportOperationalProfileSnapshot"'));
    assert.ok(html.includes("data-command-args="));
    assert.ok(html.includes("Investigation timeline"));
    assert.ok(html.includes("Editor Query"));

    const guidedLaunchText = "This workflow can start from the Hub because it asks for source and target context.";
    assert.strictEqual(html.split(guidedLaunchText).length - 1, 1);
  });

});
