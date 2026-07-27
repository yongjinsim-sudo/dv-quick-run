import * as assert from "assert";
import * as fs from "fs";
import * as path from "path";
import type { InvestigationReadinessRequestV1 } from "../../core/readiness/index.js";
import {
  DVQR_MCP_TOOL_CATALOGUE,
  DVQR_MCP_TOOL_NAMES,
  DvqrMcpServerFoundation
} from "../../mcp/index.js";

interface GoldenFixture {
  readonly scenarios: readonly {
    readonly id: string;
    readonly request: InvestigationReadinessRequestV1;
  }[];
}

function workspaceRoot(): string {
  const candidates = [
    process.cwd(),
    path.resolve(__dirname, "..", "..", "..")
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
  assert.ok(resolved, "Workspace root was not found.");
  return resolved;
}

function fixturePath(): string {
  const root = workspaceRoot();
  const candidates = [
    path.join(root, "src", "test", "fixtures", "readiness", "readiness-phase0-golden-scenarios.fixture.json"),
    path.join(root, "out", "test", "fixtures", "readiness", "readiness-phase0-golden-scenarios.fixture.json")
  ];
  const resolved = candidates.find((candidate) => fs.existsSync(candidate));
  assert.ok(resolved, `Readiness golden fixture was not found beneath ${root}.`);
  return resolved;
}

suite("dvqrMcpServerFoundation", () => {
  test("publishes exactly four read-only semantic tools", () => {
    const server = new DvqrMcpServerFoundation();
    assert.deepStrictEqual(server.listTools(), DVQR_MCP_TOOL_CATALOGUE);
    assert.strictEqual(server.listTools().length, 4);
    assert.ok(server.listTools().every((tool) => tool.readOnly));
    assert.strictEqual(server.capabilities().mutationAuthority, "none");
    assert.strictEqual(server.capabilities().evidenceAcquisition, "none");
    assert.strictEqual(server.capabilities().transport, "unbound");
  });

  test("returns the canonical readiness result and exact projections", () => {
    const fixture = JSON.parse(fs.readFileSync(fixturePath(), "utf8")) as GoldenFixture;
    const request = fixture.scenarios[0].request;
    const server = new DvqrMcpServerFoundation();

    const assessed = server.callTool({
      name: DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness,
      arguments: { request: request as never }
    });
    assert.strictEqual(assessed.ok, true);
    if (!assessed.ok) {
      return;
    }
    const result = assessed.structuredContent as unknown as {
      readonly contractVersion: string;
      readonly gaps: readonly unknown[];
      readonly contributorStates: readonly unknown[];
      readonly recommendations: readonly unknown[];
    };
    assert.strictEqual(result.contractVersion, "investigation-readiness-v1");

    const gaps = server.callTool({ name: DVQR_MCP_TOOL_NAMES.retrieveInvestigationGaps, arguments: { request: request as never } });
    const contributors = server.callTool({ name: DVQR_MCP_TOOL_NAMES.retrieveContributorAvailability, arguments: { request: request as never } });
    const recommendations = server.callTool({ name: DVQR_MCP_TOOL_NAMES.retrieveEvidenceRecommendations, arguments: { request: request as never } });
    assert.ok(gaps.ok && contributors.ok && recommendations.ok);
    if (gaps.ok && contributors.ok && recommendations.ok) {
      assert.deepStrictEqual(gaps.structuredContent, result.gaps);
      assert.deepStrictEqual(contributors.structuredContent, result.contributorStates);
      assert.deepStrictEqual(recommendations.structuredContent, result.recommendations);
    }
  });

  test("rejects missing arguments and unknown tools without invoking mutation", () => {
    const server = new DvqrMcpServerFoundation();
    const invalid = server.callTool({ name: DVQR_MCP_TOOL_NAMES.assessInvestigationReadiness });
    assert.strictEqual(invalid.ok, false);
    if (!invalid.ok) {
      assert.strictEqual(invalid.error.code, "InvalidArguments");
      assert.ok(invalid.error.limitations.includes("No investigation assessment was performed."));
    }

    const unknown = server.callTool({ name: "dvqr.executeInvestigation" });
    assert.strictEqual(unknown.ok, false);
    if (!unknown.ok) {
      assert.strictEqual(unknown.error.code, "ToolNotFound");
      assert.ok(unknown.error.limitations.includes("No application service was invoked."));
    }
  });
});
