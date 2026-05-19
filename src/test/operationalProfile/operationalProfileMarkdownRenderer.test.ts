import * as assert from "assert";
import { buildOperationalProfile } from "../../product/operationalProfile/operationalProfileEngine.js";
import { renderOperationalProfileMarkdown } from "../../product/operationalProfile/operationalProfileMarkdownRenderer.js";

suite("operationalProfileMarkdownRenderer", () => {
  test("renders a thin, evidence-backed Profile card without root-cause claims", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      entityDisplayName: "Contact",
      relationshipCount: 74,
      attributeCount: 347
    });

    const markdown = renderOperationalProfileMarkdown(profile);

    assert.ok(markdown.includes("# DV Quick Run Profile — Contact"));
    assert.ok(markdown.includes("**Entity:** `contact`"));
    assert.ok(markdown.includes("## Operational Density"));
    assert.ok(markdown.includes("## Evidence Summary"));
    assert.ok(markdown.includes("## Future Investigation Surfaces"));
    assert.ok(markdown.includes("## Suggested Investigation Actions"));
    assert.ok(markdown.includes("**Why this matters:**"));
    assert.ok(markdown.includes("Relationships</strong> — High"));
    assert.ok(!markdown.includes("High (75%)"));
    assert.ok(markdown.includes("74 relationships"));
    assert.ok(markdown.includes("Review relationship footprint"));
    assert.ok(markdown.includes("Execution Insights Expansion"));
    assert.ok(markdown.includes("Operational Profile drift comparison"));
    assert.ok(markdown.includes("347 attributes"));
    assert.ok(markdown.includes("advisory-only"));
    assert.ok(!markdown.toLowerCase().includes("root cause:"));
  });

  test("keeps empty evidence honest", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "task" });
    const markdown = renderOperationalProfileMarkdown(profile);

    assert.ok(markdown.includes("No strong operational density signals"));
    assert.ok(markdown.includes("Automation (Plugin Steps)</strong> — No evidence observed"));
    assert.ok(markdown.includes("_No evidence was provided for this section._"));
  });
});
