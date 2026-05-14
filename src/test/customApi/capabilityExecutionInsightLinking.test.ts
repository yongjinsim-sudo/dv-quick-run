import assert from "node:assert/strict";
import { suite, test } from "mocha";
import {
  buildCapabilityExecutionInsightLinkContext,
  buildCapabilityExecutionInsightSections,
  deriveCapabilityExecutionInsightLinkSummary
} from "../../customApi/execution/capabilityExecutionInsightLinking.js";
import type { InvestigationContext } from "../../investigation/context/investigationContextTypes.js";

suite("capabilityExecutionInsightLinking", () => {
  test("derives direct linkage when request or correlation anchors are available", () => {
    const summary = deriveCapabilityExecutionInsightLinkSummary({
      operationUniqueName: "new_IsReady",
      status: "completed",
      correlationId: "11111111-1111-1111-1111-111111111111"
    });

    assert.equal(summary.strength, "direct");
    assert.match(summary.detail, /captured request, correlation, or operation identifiers/);
  });

  test("derives nearby linkage for completed executions without direct identifiers", () => {
    const summary = deriveCapabilityExecutionInsightLinkSummary({
      operationUniqueName: "new_IsReady",
      status: "completed"
    });

    assert.equal(summary.strength, "nearby");
    assert.match(summary.detail, /conservative nearby evidence/);
  });

  test("does not allow runtime lookup for preview-only contexts", () => {
    const summary = deriveCapabilityExecutionInsightLinkSummary({
      operationUniqueName: "new_IsReady",
      status: "previewed"
    });

    assert.equal(summary.strength, "none");
    assert.match(summary.detail, /Preview-only capability context/);
  });

  test("builds link context from investigation context", () => {
    const investigationContext: InvestigationContext = {
      id: "ctx-1",
      source: "capabilityExplorer",
      environmentName: "SIT",
      lastUpdatedUtc: "2026-05-14T00:00:00.000Z",
      runtime: {
        requestId: "22222222-2222-2222-2222-222222222222"
      },
      capabilityExecution: {
        kind: "customApiExecution",
        operationUniqueName: "new_IsReady",
        operationDisplayName: "Is Ready",
        status: "completed",
        method: "GET",
        path: "/new_IsReady()",
        statusCode: 200,
        durationMs: 15,
        executedAtUtc: "2026-05-14T00:00:01.000Z"
      }
    };

    const linkContext = buildCapabilityExecutionInsightLinkContext(investigationContext);

    assert.equal(linkContext?.operationUniqueName, "new_IsReady");
    assert.equal(linkContext?.requestId, "22222222-2222-2222-2222-222222222222");
    assert.equal(linkContext?.environmentName, "SIT");
  });

  test("builds bounded provider sections without root-cause language", () => {
    const sections = buildCapabilityExecutionInsightSections({
      context: {
        operationUniqueName: "new_IsReady",
        operationDisplayName: "Is Ready",
        status: "completed",
        method: "GET",
        statusCode: 200,
        durationMs: 22,
        correlationId: "33333333-3333-3333-3333-333333333333"
      },
      suggestions: [
        {
          text: "Plugin trace evidence was observed.",
          actionId: "requestExecutionInsights",
          confidence: 0.8,
          reason: "Observed from bounded provider lookup.",
          source: "execution"
        }
      ]
    });

    assert.deepEqual(sections.map((section) => section.title), [
      "Capability execution anchor",
      "Execution Insight linkage",
      "Captured execution identifiers",
      "Bounded provider findings"
    ]);
    assert.match(sections[1].content, /Runtime evidence is an investigation signal, not root-cause proof/);
    assert.doesNotMatch(sections.map((section) => section.content).join("\n"), /caused by|confirmed cause/i);
  });
});
