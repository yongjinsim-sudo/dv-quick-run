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
    assert.ok(markdown.includes("## DVQR Score"));
    assert.ok(markdown.includes("## Operational Density"));
    assert.ok(markdown.includes("Operational Density"));
    assert.ok(markdown.includes("How does the calculation work?"));
    assert.ok(markdown.includes("Observed evidence → bounded interpretation → guided investigation"));
    assert.ok(markdown.includes("Normalization profile:** `dvqr-density-v1`"));
    assert.ok(markdown.includes("### Primary Contributors"));
    assert.ok(markdown.includes("Primitive formula"));
    assert.ok(markdown.includes("Display formula"));
    assert.ok(markdown.includes("Raw / soft cap"));
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
    assert.ok(markdown.includes("not risk, health, quality, security severity, or root cause"));
    assert.ok(!markdown.toLowerCase().includes("root cause:"));
  });

  test("keeps empty evidence honest", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "task" });
    const markdown = renderOperationalProfileMarkdown(profile);

    assert.ok(markdown.includes("No strong operational density signals"));
    assert.ok(markdown.includes("Automation (Plugin Steps)</strong> — No evidence observed"));
    assert.ok(markdown.includes("_No evidence was provided for this section._"));
  });
  test("renders Operational Context without turning participation into causality", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "account",
      operationalContext: {
        subject: { type: "entity", logicalName: "account", displayName: "Account" },
        sections: [{
          id: "solutionContext",
          label: "Solution Context",
          summary: "Solution participation is available for this entity.",
          evidence: [{
            subject: { type: "entity", logicalName: "account", displayName: "Account" },
            evidenceType: "SolutionParticipation",
            title: "Solution participation",
            summary: "This is participation context only, not deployment causality.",
            source: "metadata",
            scope: "oneHopRelated",
            confidence: "related"
          }]
        }],
        guardrails: [
          "Providers use curated semantic expansions only.",
          "Participation does not imply causality or root cause."
        ]
      }
    });

    const markdown = renderOperationalProfileMarkdown(profile);

    assert.ok(markdown.includes("## Operational Context"));
    assert.ok(markdown.includes("Solution Context"));
    assert.ok(markdown.includes("curated semantic expansions"));
    assert.ok(markdown.includes("Participation does not imply causality"));
    assert.ok(!markdown.toLowerCase().includes("caused by"));
  });

});


