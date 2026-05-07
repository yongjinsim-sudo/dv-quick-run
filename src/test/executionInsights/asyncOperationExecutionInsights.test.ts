import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { buildAsyncOperationCorrelationQuery, buildAsyncOperationRequestQuery } from "../../product/executionInsights/asyncOperationQueryBuilder.js";
import { buildAsyncOperationSignals } from "../../product/executionInsights/asyncOperationSignalBuilder.js";
import { buildAsyncOperationInsightSuggestions } from "../../product/executionInsights/asyncOperationInsightBuilder.js";
import { orderExecutionInsightSuggestions } from "../../product/executionInsights/executionInsightsOrchestrator.js";
import { buildWorkflowSignals } from "../../product/executionInsights/workflowSignalBuilder.js";
import { buildWorkflowInsightSuggestions } from "../../product/executionInsights/workflowInsightBuilder.js";
import type { WorkflowAnalysisResult } from "../../product/executionInsights/workflowTypes.js";

function readJsonFixture(name: string): unknown {
  const candidates = [
    path.join(__dirname, "..", "fixtures", "executionInsights", name),
    path.join(process.cwd(), "src", "test", "fixtures", "executionInsights", name),
    path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "executionInsights", name)
  ];
  const file = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(file, `Fixture not found: ${name}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

suite("asyncOperationExecutionInsights", () => {
  test("builds correlation and request lookup queries in priority-compatible shape", () => {
    const id = "11111111-1111-1111-1111-111111111111";

    const correlationQuery = buildAsyncOperationCorrelationQuery(id, 5);
    const requestQuery = buildAsyncOperationRequestQuery(id, 5);

    assert.ok(correlationQuery?.startsWith("/asyncoperations?"));
    assert.ok(correlationQuery?.includes("correlationid%20eq%2011111111-1111-1111-1111-111111111111"));
    assert.ok(requestQuery?.includes("requestid%20eq%2011111111-1111-1111-1111-111111111111"));
  });

  test("extracts asyncoperation signals with evidence refs and timing", () => {
    const fixture = readJsonFixture("asyncoperations.redacted.fixture.json");
    const signals = buildAsyncOperationSignals(fixture, "high");

    assert.ok(signals.length > 0);
    assert.ok(signals.some((signal) => signal.evidenceRef.source === "asyncOperation"));
    assert.ok(signals.some((signal) => typeof signal.executionTimeMs === "number"));
    assert.ok(signals.every((signal) => signal.evidenceRef.table === "asyncoperations"));
  });

  test("builds asyncoperation suggestions without actionable apply behaviour", () => {
    const fixture = readJsonFixture("asyncoperations.redacted.fixture.json");
    const signals = buildAsyncOperationSignals(fixture, "high");
    const suggestions = buildAsyncOperationInsightSuggestions({
      signals,
      source: "currentResult",
      status: "success"
    });

    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((suggestion) => suggestion.actionId === "requestExecutionInsights"));
    assert.ok(suggestions.every((suggestion) => suggestion.canApply === false));
    assert.ok(suggestions.some((suggestion) => suggestion.payload?.kind === "asyncOperationExecutionSummary" || suggestion.payload?.kind === "asyncOperationSampleInspected"));
  });

  test("marks cross-request asyncoperation repetition as primary model-driven guidance", () => {
    const fixture = readJsonFixture("asyncoperations.redacted.fixture.json");
    const signals = buildAsyncOperationSignals(fixture, "high");
    const suggestions = buildAsyncOperationInsightSuggestions({
      signals,
      source: "currentResult",
      status: "success"
    });
    const primary = suggestions.find((suggestion) => suggestion.payload?.kind === "asyncOperationExecutionSummary" && suggestion.payload?.isPrimarySignal === true);

    assert.ok(primary, "cross-request asyncoperation repetition should be marked as primary");
    assert.strictEqual(primary?.payload?.sourceType, "asyncOperation");
    assert.ok(typeof primary?.payload?.summary === "string");
    assert.ok(String(primary?.payload?.summary).includes("separate request contexts"));
    assert.ok(Array.isArray(primary?.payload?.guidedInvestigationSteps));
    assert.ok((primary?.payload?.guidedInvestigationSteps as unknown[]).length > 0);
    assert.ok(Array.isArray(primary?.payload?.relatedSignals));
    assert.ok((primary?.payload?.relatedSignals as unknown[]).length > 0);
  });

  test("orders primary execution insights before higher-confidence supporting cards", () => {
    const ordered = orderExecutionInsightSuggestions([
      {
        text: "Supporting plugin trace",
        actionId: "requestExecutionInsights",
        confidence: 0.88,
        reason: "Supporting signal",
        source: "execution",
        payload: { kind: "pluginTraceExecutionSummary" }
      },
      {
        text: "Primary async operation",
        actionId: "requestExecutionInsights",
        confidence: 0.76,
        reason: "Primary signal",
        source: "execution",
        payload: { kind: "asyncOperationExecutionSummary", isPrimarySignal: true }
      }
    ]);

    assert.strictEqual(ordered[0]?.payload?.kind, "asyncOperationExecutionSummary");
    assert.strictEqual(ordered[0]?.payload?.isPrimarySignal, true);
  });


  test("orders execution insights by primary, investigation priority, confidence, and stable fallback", () => {
    const ordered = orderExecutionInsightSuggestions([
      {
        text: "Low confidence but high priority",
        actionId: "requestExecutionInsights",
        confidence: 0.7,
        reason: "High investigation priority",
        source: "execution",
        payload: { kind: "supportingHigh", investigationPriority: 3 }
      },
      {
        text: "Higher confidence but lower priority",
        actionId: "requestExecutionInsights",
        confidence: 0.95,
        reason: "Lower investigation priority",
        source: "execution",
        payload: { kind: "supportingLow", investigationPriority: 1 }
      },
      {
        text: "Primary signal",
        actionId: "requestExecutionInsights",
        confidence: 0.6,
        reason: "Primary signal",
        source: "execution",
        payload: { kind: "primary", isPrimarySignal: true, investigationPriority: 1 }
      }
    ]);

    assert.strictEqual(ordered[0]?.payload?.kind, "primary");
    assert.strictEqual(ordered[1]?.payload?.kind, "supportingHigh");
    assert.strictEqual(ordered[2]?.payload?.kind, "supportingLow");
  });

  test("extracts workflow metadata and builds linked workflow insight suggestions", () => {
    const fixture = readJsonFixture("workflows.redacted.fixture.json");
    const signals = buildWorkflowSignals(fixture, "high");
    const analysis: WorkflowAnalysisResult = {
      signals,
      source: "linkedLookup",
      status: "success"
    };
    const suggestions = buildWorkflowInsightSuggestions(analysis);

    assert.ok(signals.length > 0);
    assert.ok(signals.some((signal) => signal.evidenceRef.source === "workflow"));
    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.every((suggestion) => suggestion.payload?.kind === "workflowExecutionMetadata"));
  });
});
