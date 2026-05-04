import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { buildAsyncOperationCorrelationQuery, buildAsyncOperationRequestQuery } from "../../product/executionInsights/asyncOperationQueryBuilder.js";
import { buildAsyncOperationSignals } from "../../product/executionInsights/asyncOperationSignalBuilder.js";
import { buildAsyncOperationInsightSuggestions } from "../../product/executionInsights/asyncOperationInsightBuilder.js";
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
