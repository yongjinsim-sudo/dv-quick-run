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
      "dvforgelab-ecosystem",
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

    assert.deepStrictEqual(launchable, ["guided-traversal", "capability-explorer", "cross-environment-comparison", "community-feedback", "community-discussions"]);
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


  test("keeps public Hub copy focused on Free and Pro only", () => {
    const model = buildDvQuickRunHubViewModel();
    const copy = [
      ...model.whatsNew,
      ...model.productDirection.map((item) => `${item.title} ${item.summary}`),
      ...model.capabilities.map((item) => `${item.group} ${item.title} ${item.summary} ${item.operationalUseCase} ${item.howToUse?.join(" ") ?? ""}`)
    ].join("\n");

    assert.strictEqual(copy.includes("Team/Enterprise"), false);
    assert.strictEqual(copy.includes("Pro/Team/Enterprise"), false);
    assert.strictEqual(copy.includes("Enterprise acceleration"), false);
    assert.strictEqual(copy.includes("Open-core"), false);
    assert.strictEqual(copy.includes("Pro acceleration"), false);
    assert.strictEqual(copy.includes("Planned Pro workflow"), false);
    assert.strictEqual(copy.includes("future premium"), false);
    assert.strictEqual(copy.includes("v0.11.6 only prepares"), false);
    assert.strictEqual(copy.includes("ahead of v0.12.0"), false);
    assert.ok(copy.includes("Cross-Environment Diff"));
    assert.ok(copy.includes("Snapshot Library"));
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


  test("renders comparison as a Pro Preview rather than a hidden future workflow", () => {
    const model = buildDvQuickRunHubViewModel();
    const html = renderDvQuickRunHubHtml({ cspSource: "vscode-resource:" } as never, model);

    assert.ok(html.includes("🔒 Cross-Environment Diff"));
    assert.ok(html.includes("Pro Preview"));
    assert.ok(html.includes("Open Pro Preview"));
    assert.ok(html.includes("Future Workflows"));
    assert.strictEqual(html.includes("Planned future workflow."), false);
    assert.strictEqual(html.includes("v0.11.6 only prepares"), false);
    assert.strictEqual(html.includes("v0.12.0 will introduce"), false);
    assert.strictEqual(html.includes("Since v0.12.0 planned"), false);
  });



  test("renders comparison as an operational workflow for Pro", () => {
    const model = buildDvQuickRunHubViewModel(undefined, { plan: "pro" });
    const html = renderDvQuickRunHubHtml({ cspSource: "vscode-resource:" } as never, model);

    assert.ok(html.includes("Operational Comparison Workflows"));
    assert.ok(html.includes("Open Snapshot Library"));
    assert.strictEqual(html.includes("Open Pro Preview"), false);
    assert.strictEqual(html.includes("Free can explore mock snapshots"), false);
  });


  test("renders Pathfinder early supporter recognition when present", () => {
    const model = buildDvQuickRunHubViewModel(undefined, { plan: "pro", supporterTags: ["Pathfinder"] });
    const html = renderDvQuickRunHubHtml({ cspSource: "vscode-resource:" } as never, model);

    assert.deepStrictEqual(model.supporterBadges, ["DVQR Pathfinder • Early Supporter"]);
    assert.ok(html.includes("DVQR Pathfinder • Early Supporter"));
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
