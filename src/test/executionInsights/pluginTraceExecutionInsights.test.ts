import * as assert from "assert";
import { analyzePluginTraces, classifyPluginTraceError, summarizePluginTraceError } from "../../product/executionInsights/pluginTraceAnalyzer.js";
import { buildPluginTraceInsightSuggestions } from "../../product/executionInsights/pluginTraceInsightBuilder.js";
import { buildPluginTraceCorrelationQuery, buildPluginTraceRecentQuery } from "../../product/executionInsights/pluginTraceQueryBuilder.js";
import { buildPluginTraceSignals, extractExceptionMessage } from "../../product/executionInsights/pluginTraceSignalBuilder.js";
import type { DataverseClient } from "../../services/dataverseClient.js";
import * as path from 'path';
import * as fs from 'fs';

function readJsonFixture(fileName: string) {
  const compiledPath = path.join(
    __dirname,
    "..",
    "fixtures",
    "pluginTrace",
    fileName
  );

  const sourcePath = path.join(
    __dirname,
    "..",
    "..",
    "..",
    "src",
    "test",
    "fixtures",
    "pluginTrace",
    fileName
  );

  let finalPath: string | undefined;

  if (fs.existsSync(compiledPath)) {
    finalPath = compiledPath;
  } else if (fs.existsSync(sourcePath)) {
    finalPath = sourcePath;
  }

  if (!finalPath) {
    throw new Error(
      `Fixture not found.\nTried:\n- ${compiledPath}\n- ${sourcePath}`
    );
  }

  return JSON.parse(fs.readFileSync(finalPath, "utf-8"));
}

function stringify(value: unknown): string {
  return JSON.stringify(value);
}

function assertFixtureIsRedacted(value: unknown): void {
  const text = stringify(value);
  assert.ok(!text.includes(["hc", "pdev"].join("")), "Fixture must not contain real environment host names");
  assert.ok(!text.includes(["bu", "pa"].join("")), "Fixture must not contain tenant-specific values");
  assert.ok(!text.includes(["HE", "KA"].join("")), "Fixture must not contain project-specific values");
  assert.ok(!text.includes(["svc", "-crm"].join("")), "Fixture must not contain real service account names");
  assert.ok(!text.includes(["ns.bu", "pa"].join("")), "Fixture must not contain real tenant namespace URLs");
}

const traceResult = {
  value: [
    {
      plugintracelogid: "11111111-1111-1111-1111-111111111111",
      correlationid: "22222222-2222-2222-2222-222222222222",
      typename: "Contoso.Sample.PatientSyncPlugin",
      messagename: "Update",
      primaryentity: "contact",
      stage: 40,
      mode: 0,
      depth: 2,
      performanceexecutionduration: 2341,
      exceptiondetails: "<ExceptionDetail><Message>Sample patient sync failed</Message></ExceptionDetail>",
      createdon: "2026-04-30T01:00:00Z"
    },
    {
      plugintracelogid: "33333333-3333-3333-3333-333333333333",
      correlationid: "22222222-2222-2222-2222-222222222222",
      typename: "Contoso.Sample.PatientSyncPlugin",
      messagename: "Update",
      primaryentity: "contact",
      stage: 40,
      mode: 0,
      depth: 1,
      performanceexecutionduration: 120,
      createdon: "2026-04-30T01:00:01Z"
    }
  ]
};

function createClient(result: unknown): DataverseClient {
  return {
    get: async () => result
  } as unknown as DataverseClient;
}

function createSequenceClient(responses: Array<unknown | Error>, calls: string[]): DataverseClient {
  return {
    get: async (path: string) => {
      calls.push(path);
      const next = responses.shift();
      if (next instanceof Error) {
        throw next;
      }
      return next;
    }
  } as unknown as DataverseClient;
}

suite("pluginTraceExecutionInsights", () => {
  test("builds bounded plugin trace queries", () => {
    const recent = buildPluginTraceRecentQuery(5);
    assert.ok(recent.startsWith("/plugintracelogs?$select="));
    assert.ok(recent.includes("performanceexecutionduration"));
    assert.ok(recent.includes("$top=5"));

    const correlation = buildPluginTraceCorrelationQuery("{22222222-2222-2222-2222-222222222222}", 3);
    assert.ok(correlation?.startsWith("/plugintracelogs?$select="));
    assert.ok(correlation?.includes("correlationid%20eq%2022222222-2222-2222-2222-222222222222"));
    assert.ok(correlation?.includes("$top=3"));
  });

  test("extracts exception message safely", () => {
    assert.strictEqual(
      extractExceptionMessage("<ExceptionDetail><Message>Something failed</Message></ExceptionDetail>"),
      "Something failed"
    );
    assert.strictEqual(extractExceptionMessage("first line\nsecond line"), "first line");
  });

  test("maps plugin trace rows into signals", () => {
    const signals = buildPluginTraceSignals(traceResult, "high");
    assert.strictEqual(signals.length, 2);
    assert.strictEqual(signals[0]?.typeName, "Contoso.Sample.PatientSyncPlugin");
    assert.strictEqual(signals[0]?.durationMs, 2341);
    assert.strictEqual(signals[0]?.exceptionMessage, "Sample patient sync failed");
  });

  test("keeps redacted plugin trace configuration fixture representative of large enterprise-style formats", () => {
    const fixture = readJsonFixture("pluginTrace.redactedConfigurationFormats.json");
    assertFixtureIsRedacted(fixture);

    const rows = buildPluginTraceSignals(fixture, "medium");
    assert.strictEqual(rows.length, 0, "configuration-only traces should not produce runtime execution signals");

    const text = stringify(fixture);
    assert.ok(text.includes("configuration"));
    assert.ok(text.includes("@odata.nextLink"));
    assert.ok(text.includes("systemusers"));
    assert.ok(text.includes("sample_virtual_column"));
    assert.ok(text.includes("https://example.invalid/fhir/source-system/identifier/redacted"));
  });

  test("maps redacted runtime plugin trace fixture into exception, slow, depth, and repeated signals", () => {
    const fixture = readJsonFixture("pluginTrace.redactedRuntimeSignals.json");
    assertFixtureIsRedacted(fixture);

    const signals = buildPluginTraceSignals(fixture, "high");
    assert.strictEqual(signals.length, 3);
    assert.strictEqual(signals[0]?.typeName, "Contoso.Sample.PatientSyncPlugin");
    assert.strictEqual(signals[0]?.messageName, "Update");
    assert.strictEqual(signals[0]?.entityName, "contact");
    assert.strictEqual(signals[0]?.durationMs, 2341);
    assert.strictEqual(signals[0]?.depth, 2);
    assert.strictEqual(signals[0]?.mode, 0);
    assert.strictEqual(signals[0]?.exceptionMessage, "Sample plugin exception message");

    const suggestions = buildPluginTraceInsightSuggestions({
      signals,
      source: "currentResult",
      status: "success"
    });

    const summary = suggestions.find((suggestion) => suggestion.payload?.kind === "pluginTraceExecutionSummary");
    assert.ok(summary, "runtime signals should be consolidated into a primary execution summary insight");
    assert.ok(summary?.text.includes("Execution issue detected"));
    assert.ok(Array.isArray(summary?.payload?.detectedSignals), "detected signals should be structured for the drawer renderer");
    assert.ok(String(summary?.payload?.signalSummary).includes("exception:"));
    assert.ok(String(summary?.payload?.signalSummary).includes("slow execution"));
    assert.ok(String(summary?.payload?.signalSummary).includes("nested execution depth") || String(summary?.payload?.signalSummary).includes("repeated execution"));
    assert.ok(summary?.payload?.impact, "impact should remain structured in the payload");
    assert.ok(Array.isArray(summary?.payload?.nextSteps), "next steps should remain structured in the payload");
    assert.ok(Array.isArray(summary?.payload?.rawSignals), "raw execution signals should remain available in the insight payload");
    assert.ok(Array.isArray(summary?.payload?.rawDetails), "raw trace detail summaries should remain available for the raw trace viewer");
    assert.strictEqual(summary?.payload?.rawTraceActionLabel, "View raw trace details");
    assert.ok(!stringify(suggestions).includes("[REDACTED SAMPLE MESSAGEBLOCK]"), "messageblock must not be surfaced into insights");
  });

  test("prefers current result signals before external lookup", async () => {
    const analysis = await analyzePluginTraces({
      client: createClient({ value: [] }),
      token: "token",
      currentResult: traceResult,
      queryPath: "plugintracelogs?$select=typename"
    });

    assert.strictEqual(analysis.source, "currentResult");
    assert.strictEqual(analysis.status, "success");
    assert.strictEqual(analysis.signals.length, 2);
  });


  test("does not treat asyncoperation rows as current plugin trace signals", async () => {
    const analysis = await analyzePluginTraces({
      client: createClient({ value: [] }),
      token: "token",
      currentResult: {
        value: [
          {
            asyncoperationid: "fb8f5e2c-001b-4ed7-a4bf-000016764f1b",
            correlationid: "47a01a42-95c8-4ff4-9ac3-fa5fa5966090",
            name: "Dataprocessing configuration module execution",
            depth: 0,
            createdon: "2024-04-16T14:07:09Z"
          }
        ]
      },
      queryPath: "asyncoperations?$select=name,correlationid,depth,createdon"
    });

    assert.notStrictEqual(analysis.source, "currentResult");
    assert.strictEqual(analysis.status, "empty");
    assert.strictEqual(analysis.signals.length, 0);
  });

  test("falls back to bounded recent lookup for plugintracelogs results", async () => {
    const analysis = await analyzePluginTraces({
      client: createClient(traceResult),
      token: "token",
      currentResult: { value: [] },
      queryPath: "plugintracelogs?$select=configuration"
    });

    assert.strictEqual(analysis.source, "recentLookup");
    assert.strictEqual(analysis.status, "success");
    assert.strictEqual(analysis.signals.length, 2);
    assert.ok(analysis.attemptedQuery?.includes("$top=5"));
  });

  test("retries safe plugin trace select when full select returns Dataverse 400", async () => {
    const calls: string[] = [];
    const analysis = await analyzePluginTraces({
      client: createSequenceClient([
        new Error("Dataverse error 400 for GET https://example/plugintracelogs?$select=bad"),
        { value: [] }
      ], calls),
      token: "token",
      currentResult: { value: [] },
      queryPath: "plugintracelogs?$select=configuration"
    });

    assert.strictEqual(calls.length, 2);
    assert.ok(calls[0]?.includes("performanceexecutionduration"));
    assert.ok(calls[1]?.includes("plugintracelogid,createdon,typename,messagename,correlationid"));
    assert.ok(!calls[1]?.includes("performanceexecutionduration"));
    assert.strictEqual(analysis.source, "recentLookup");
    assert.strictEqual(analysis.status, "empty");
    assert.ok(analysis.message?.includes("safe-field"));
  });

  test("does not suppress execution insights when safe select fallback succeeds", () => {
    const suggestions = buildPluginTraceInsightSuggestions({
      signals: [],
      source: "recentLookup",
      status: "empty",
      message: "No matching plugin trace records were found in the bounded safe-field lookup."
    });

    assert.strictEqual(suggestions[0]?.payload?.kind, "pluginTraceNoSignals");
    assert.strictEqual(suggestions[0]?.payload?.suppressExecutionInsights, false);
  });

  test("summarizes plugin trace lookup errors without leaking full URLs", () => {
    const summary = summarizePluginTraceError(
      new Error("Dataverse error 500 for GET https://example.crm.dynamics.com/api/data/v9.2/plugintracelogs?$select=very,long,url")
    );

    assert.strictEqual(summary, "Dataverse returned 500.");
    assert.ok(!summary.includes("https://"));
  });

  test("builds low-noise timeout lookup insight", () => {
    const suggestions = buildPluginTraceInsightSuggestions({
      signals: [],
      source: "recentLookup",
      status: "timeout",
      message: "Execution Insights could not read plugintracelogs within the bounded lookup. The bounded lookup timed out."
    });

    assert.strictEqual(suggestions[0]?.payload?.kind, "pluginTraceLookupFailed");
    assert.strictEqual(suggestions[0]?.text, "💡 Execution Insights lookup timed out");
    assert.strictEqual(suggestions[0]?.payload?.hideBinderButton, true);
  });

  test("classifies access denied trace lookup errors as suppressible", () => {
    const summary = classifyPluginTraceError(new Error("Dataverse error 403 for GET https://example/plugintracelogs"));

    assert.strictEqual(summary.status, "accessDenied");
    assert.strictEqual(summary.shouldSuppressExecutionInsights, true);
    assert.ok(!summary.message.includes("https://"));
  });

  test("builds ranked execution insights", () => {
    const suggestions = buildPluginTraceInsightSuggestions({
      signals: buildPluginTraceSignals(traceResult, "high"),
      source: "currentResult",
      status: "success"
    });

    assert.ok(suggestions.length >= 1);
    assert.ok(suggestions.some((suggestion) => suggestion.payload?.kind === "pluginTraceExecutionSummary"));
    assert.ok(suggestions.some((suggestion) => suggestion.text.includes("Execution issue detected")));
    assert.ok(suggestions.some((suggestion) => String(suggestion.payload?.signalSummary).includes("exception:")));
    assert.ok(suggestions.some((suggestion) => String(suggestion.payload?.signalSummary).includes("slow execution")));
    assert.ok(suggestions.some((suggestion) => Array.isArray(suggestion.payload?.rawSignals)));
    assert.ok(suggestions.some((suggestion) => Array.isArray(suggestion.payload?.rawDetails)));
  });
});
