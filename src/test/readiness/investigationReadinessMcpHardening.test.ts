import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import { performance } from "perf_hooks";
import {
  INVESTIGATION_READINESS_SCHEMA_V1,
  READINESS_SEMANTIC_OPERATION_IDS,
  assessInvestigationReadiness,
  investigationReadinessSemanticOperations,
  serializeReadinessError,
  serializeReadinessRequest,
  serializeReadinessResult,
  type InvestigationReadinessErrorV1,
  type InvestigationReadinessRequestV1,
  type InvestigationReadinessResultV1
} from "../../core/readiness/index.js";
import { createJsonSchemaTestValidator } from "./jsonSchemaTestValidator.js";

interface GoldenScenario {
  readonly id: string;
  readonly request: InvestigationReadinessRequestV1;
}

interface GoldenFixture {
  readonly scenarios: readonly GoldenScenario[];
}

interface SemanticOperationFixture {
  readonly fixtureContractVersion: string;
  readonly releaseVersion: string;
  readonly transportBoundary: string;
  readonly semanticTransformation: string;
  readonly operations: readonly {
    readonly operationId: string;
    readonly outputField?: string;
  }[];
  readonly errorFixture: {
    readonly codes: readonly string[];
    readonly projectionBehavior: string;
  };
  readonly deferredTransportConcerns: readonly string[];
}

interface PerformanceFixture {
  readonly fixtureContractVersion: string;
  readonly releaseVersion: string;
  readonly method: {
    readonly warmupAssessments: number;
    readonly measuredAssessments: number;
  };
  readonly observedGoldenMaximums: {
    readonly canonicalRequestBytes: number;
    readonly canonicalResultBytes: number;
    readonly contributors: number;
    readonly gaps: number;
    readonly recommendations: number;
    readonly evidenceReferences: number;
  };
  readonly releaseRegressionCeilings: {
    readonly p95Milliseconds: number;
    readonly canonicalRequestBytes: number;
    readonly canonicalResultBytes: number;
  };
}

function fixturePath(fileName: string): string {
  const candidates = [
    path.join(process.cwd(), "src", "test", "fixtures", "readiness", fileName),
    path.join(__dirname, "..", "fixtures", "readiness", fileName),
    path.join(__dirname, "..", "..", "..", "src", "test", "fixtures", "readiness", fileName)
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(resolved, `Readiness fixture not found: ${fileName}`);
  return resolved;
}

function readFixture<T>(fileName: string): T {
  return JSON.parse(fs.readFileSync(fixturePath(fileName), "utf8")) as T;
}

function sourceRoot(): string {
  const candidates = [
    path.join(process.cwd(), "src"),
    path.join(__dirname, "..", "..", "..", "src")
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(resolved, "Source root was not found.");
  return resolved;
}

function sourceFiles(directory: string): string[] {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const item = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      return sourceFiles(item);
    }
    return entry.isFile() && entry.name.endsWith(".ts") ? [item] : [];
  });
}

function result(response: ReturnType<typeof assessInvestigationReadiness>): InvestigationReadinessResultV1 {
  assert.strictEqual(response.contractVersion, "investigation-readiness-v1");
  return response as InvestigationReadinessResultV1;
}

const golden = readFixture<GoldenFixture>("readiness-phase0-golden-scenarios.fixture.json");
const operations = readFixture<SemanticOperationFixture>("readiness-phase6-semantic-operations.fixture.json");
const baseline = readFixture<PerformanceFixture>("readiness-phase6-performance-baseline.fixture.json");

suite("investigationReadinessMcpHardening", () => {
  test("locks four transport-neutral semantic operations without an MCP runtime", () => {
    assert.strictEqual(operations.fixtureContractVersion, "investigation-readiness-phase6-semantic-operations-v1");
    assert.strictEqual(operations.releaseVersion, "0.15.3");
    assert.strictEqual(operations.transportBoundary, "none");
    assert.strictEqual(operations.semanticTransformation, "none");
    assert.deepStrictEqual(
      operations.operations.map((operation) => operation.operationId),
      READINESS_SEMANTIC_OPERATION_IDS
    );
    assert.deepStrictEqual(
      operations.operations.map((operation) => operation.outputField).filter(Boolean),
      ["gaps", "contributorStates", "recommendations"]
    );
    assert.deepStrictEqual(operations.errorFixture.codes, [
      "InvalidInput",
      "UnsupportedInputVersion",
      "UnsupportedProfileVersion",
      "ContractViolation"
    ]);
    assert.strictEqual(operations.errorFixture.projectionBehavior, "preserve-error-envelope");
    assert.ok(operations.deferredTransportConcerns.includes("authentication"));
    assert.ok(operations.deferredTransportConcerns.includes("server lifecycle"));
  });

  test("projects gaps, availability, and recommendations without reinterpretation", () => {
    for (const scenario of golden.scenarios) {
      const response = investigationReadinessSemanticOperations.assessInvestigationReadiness(scenario.request);
      const assessed = result(response);
      assert.strictEqual(
        investigationReadinessSemanticOperations.retrieveInvestigationGaps(assessed),
        assessed.gaps
      );
      assert.strictEqual(
        investigationReadinessSemanticOperations.retrieveContributorAvailability(assessed),
        assessed.contributorStates
      );
      assert.strictEqual(
        investigationReadinessSemanticOperations.retrieveEvidenceRecommendations(assessed),
        assessed.recommendations
      );
    }

    const error: InvestigationReadinessErrorV1 = {
      contractVersion: "investigation-readiness-error-v1",
      code: "InvalidInput",
      message: "Fixture error.",
      limitations: ["No assessment was performed."]
    };
    assert.strictEqual(investigationReadinessSemanticOperations.retrieveInvestigationGaps(error), error);
    assert.strictEqual(investigationReadinessSemanticOperations.retrieveContributorAvailability(error), error);
    assert.strictEqual(investigationReadinessSemanticOperations.retrieveEvidenceRecommendations(error), error);
  });

  test("keeps request, result, and error fixtures directly schema-valid and serializable", () => {
    const validateRequest = createJsonSchemaTestValidator(INVESTIGATION_READINESS_SCHEMA_V1, "request");
    const validateResult = createJsonSchemaTestValidator(INVESTIGATION_READINESS_SCHEMA_V1, "result");
    const validateError = createJsonSchemaTestValidator(INVESTIGATION_READINESS_SCHEMA_V1, "error");
    for (const scenario of golden.scenarios) {
      assert.deepStrictEqual(validateRequest(scenario.request), [], scenario.id);
      assert.deepStrictEqual(JSON.parse(serializeReadinessRequest(scenario.request)), scenario.request);
      const response = assessInvestigationReadiness(scenario.request);
      const assessed = result(response);
      assert.deepStrictEqual(validateResult(assessed), [], scenario.id);
      assert.deepStrictEqual(JSON.parse(serializeReadinessResult(assessed)), assessed);
    }

    const invalid = assessInvestigationReadiness({} as InvestigationReadinessRequestV1);
    assert.strictEqual(invalid.contractVersion, "investigation-readiness-error-v1");
    assert.deepStrictEqual(validateError(invalid), []);
    assert.deepStrictEqual(JSON.parse(serializeReadinessError(invalid as InvestigationReadinessErrorV1)), invalid);
  });

  test("keeps the readiness service isolated from host and side-effect modules", () => {
    const root = sourceRoot();
    const files = [
      ...sourceFiles(path.join(root, "core", "readiness")),
      path.join(root, "core", "recommendations", "readinessRecommendationRules.ts")
    ];
    const forbidden = [
      /from\s+["']vscode["']/,
      /from\s+["'](?:node:)?(?:fs|http|https|net|tls|child_process)["']/,
      /require\(\s*["'](?:vscode|(?:node:)?(?:fs|http|https|net|tls|child_process))["']\s*\)/,
      /\bfetch\s*\(/,
      /webview/i,
      /miniRca(?:Html|Markdown)Renderer/
    ];
    for (const file of files) {
      const source = fs.readFileSync(file, "utf8");
      for (const pattern of forbidden) {
        assert.doesNotMatch(source, pattern, `${path.relative(root, file)} violates host isolation.`);
      }
    }
  });

  test("records bounded golden sizes and stays within the release performance ceiling", () => {
    assert.strictEqual(baseline.fixtureContractVersion, "investigation-readiness-phase6-performance-baseline-v1");
    assert.strictEqual(baseline.releaseVersion, "0.15.3");
    const responses = golden.scenarios.map((scenario) => result(assessInvestigationReadiness(scenario.request)));
    const requestBytes = golden.scenarios.map((scenario) => Buffer.byteLength(serializeReadinessRequest(scenario.request), "utf8"));
    const resultBytes = responses.map((response) => Buffer.byteLength(serializeReadinessResult(response), "utf8"));
    assert.strictEqual(Math.max(...requestBytes), baseline.observedGoldenMaximums.canonicalRequestBytes);
    assert.strictEqual(Math.max(...resultBytes), baseline.observedGoldenMaximums.canonicalResultBytes);
    assert.strictEqual(Math.max(...responses.map((response) => response.contributorStates.length)), baseline.observedGoldenMaximums.contributors);
    assert.strictEqual(Math.max(...responses.map((response) => response.gaps.length)), baseline.observedGoldenMaximums.gaps);
    assert.strictEqual(Math.max(...responses.map((response) => response.recommendations.length)), baseline.observedGoldenMaximums.recommendations);
    assert.strictEqual(Math.max(...responses.map((response) => response.evidenceRefs.length)), baseline.observedGoldenMaximums.evidenceReferences);
    assert.ok(Math.max(...requestBytes) < baseline.releaseRegressionCeilings.canonicalRequestBytes);
    assert.ok(Math.max(...resultBytes) < baseline.releaseRegressionCeilings.canonicalResultBytes);

    for (let index = 0; index < baseline.method.warmupAssessments; index += 1) {
      assessInvestigationReadiness(golden.scenarios[index % golden.scenarios.length].request);
    }
    const durations: number[] = [];
    for (let index = 0; index < baseline.method.measuredAssessments; index += 1) {
      const started = performance.now();
      assessInvestigationReadiness(golden.scenarios[index % golden.scenarios.length].request);
      durations.push(performance.now() - started);
    }
    durations.sort((left, right) => left - right);
    const p95 = durations[Math.floor(durations.length * 0.95)];
    assert.ok(p95 < baseline.releaseRegressionCeilings.p95Milliseconds, `p95 ${p95.toFixed(3)}ms exceeded the release ceiling.`);
  });
});
