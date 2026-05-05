import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { buildFlowSessionLinkedQuery, buildFlowSessionRecordQuery } from "../../product/executionInsights/flowSessionQueryBuilder.js";
import { buildFlowSessionSignals } from "../../product/executionInsights/flowSessionSignalBuilder.js";
import { buildFlowSessionInsightSuggestions } from "../../product/executionInsights/flowSessionInsightBuilder.js";

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

suite("flowSessionExecutionInsights", () => {
  test("builds flowsession linked lookup queries from asyncoperation evidence", () => {
    const correlationId = "44444444-4444-4444-4444-444444444444";
    const requestId = "55555555-5555-5555-5555-555555555555";
    const workflowActivationId = "22222222-2222-2222-2222-222222222222";

    const query = buildFlowSessionLinkedQuery({ correlationId, requestId, workflowActivationId, maxRows: 5 });

    assert.ok(query?.startsWith("/flowsessions?"));
    assert.ok(query?.includes("correlationid eq 44444444-4444-4444-4444-444444444444"));
    assert.ok(query?.includes("requestid eq 55555555-5555-5555-5555-555555555555"));
    assert.ok(query?.includes("workflowid eq 22222222-2222-2222-2222-222222222222"));
    assert.ok(query?.includes("$top=5"));
  });

  test("builds flowsession record query", () => {
    const query = buildFlowSessionRecordQuery("11111111-1111-1111-1111-111111111111");

    assert.ok(query?.startsWith("/flowsessions(11111111-1111-1111-1111-111111111111)?"));
    assert.ok(query?.includes("$select="));
  });

  test("extracts flowsession signals and constructs Power Automate run URLs", () => {
    const fixture = readJsonFixture("flowsessions.redacted.fixture.json");
    const signals = buildFlowSessionSignals(fixture, "high");

    assert.strictEqual(signals.length, 4);
    assert.ok(signals.every((signal) => signal.evidenceRef.source === "flowSession"));
    assert.ok(signals.every((signal) => signal.evidenceRef.table === "flowsessions"));
    assert.ok(signals.some((signal) => signal.flowRunUrl === "https://make.powerautomate.com/environments/Default-aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee/flows/22222222-2222-2222-2222-222222222222/runs/33333333-3333-3333-3333-333333333333"));
    assert.ok(signals.some((signal) => signal.flowRunUrl === "https://make.powerautomate.com/environments/Default-cccccccc-dddd-eeee-ffff-aaaaaaaaaaaa/flows/cccccccc-cccc-cccc-cccc-cccccccccccc/runs/dddddddd-dddd-dddd-dddd-dddddddddddd"));
  });

  test("builds navigation-only flowsession insight suggestions", () => {
    const fixture = readJsonFixture("flowsessions.redacted.fixture.json");
    const signals = buildFlowSessionSignals(fixture, "high");
    const suggestions = buildFlowSessionInsightSuggestions({
      signals,
      source: "currentResult",
      status: "success"
    });

    assert.ok(suggestions.length > 0);
    assert.ok(suggestions.length <= 2);
    assert.ok(suggestions.every((suggestion) => suggestion.actionId === "requestExecutionInsights"));
    assert.ok(suggestions.every((suggestion) => suggestion.canApply === false));
    assert.ok(suggestions.every((suggestion) => suggestion.payload?.kind === "flowSessionExecutionMetadata"));
    assert.ok(suggestions.some((suggestion) => Array.isArray(suggestion.payload?.externalActions)));
  });
});
