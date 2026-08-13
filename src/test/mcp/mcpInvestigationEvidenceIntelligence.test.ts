import * as assert from "assert";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import { InvestigationApplicationService, InvestigationEvidenceIntelligenceService, WorkspaceInvestigationRepository } from "../../pro/investigations/index.js";
import type { InvestigationReadinessRequestV1 } from "../../core/readiness/index.js";

suite("mcpInvestigationEvidenceIntelligence", () => {
  test("reuses canonical readiness output for evidence, gaps, contributors, confidence and summary", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass3-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const investigations = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
      const created = investigations.start({ question: "Investigate timeline evidence", type: "Timeline", subject: { kind: "TimelineSubject", displayLabel: "Contact timeline" } });
      const roots = [process.cwd(), path.resolve(__dirname, "..", "..", "..")];
      const workspaceRoot = roots.find((candidate) => fs.existsSync(path.join(candidate, "package.json")));
      assert.ok(workspaceRoot, "Workspace root was not found.");
      const fixtureCandidates = [
        path.join(workspaceRoot, "src", "test", "fixtures", "readiness", "readiness-phase0-golden-scenarios.fixture.json"),
        path.join(workspaceRoot, "out", "test", "fixtures", "readiness", "readiness-phase0-golden-scenarios.fixture.json")
      ];
      const fixturePath = fixtureCandidates.find((candidate) => fs.existsSync(candidate));
      assert.ok(fixturePath, `Readiness golden fixture was not found beneath ${workspaceRoot}.`);
      const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8")) as { scenarios: Array<{ request: InvestigationReadinessRequestV1 }> };
      const request = JSON.parse(JSON.stringify(fixture.scenarios[0].request)) as InvestigationReadinessRequestV1;
      (request.investigationInput as { investigationId?: string }).investigationId = created.investigationId;
      const service = new InvestigationEvidenceIntelligenceService(repository);
      const readiness = service.assess(created.investigationId, request);
      const storedReadiness = service.getReadiness(created.investigationId);
      assert.ok(!("assessed" in storedReadiness) || storedReadiness.assessed !== false);
      assert.strictEqual((storedReadiness as typeof readiness).inputFingerprint, readiness.inputFingerprint);
      assert.deepStrictEqual(service.listEvidence(created.investigationId), readiness.evidenceRefs);
      assert.deepStrictEqual(service.gaps(created.investigationId), readiness.gaps);
      assert.strictEqual(service.explainContributor(created.investigationId, readiness.contributorStates[0].contributorId).state, readiness.contributorStates[0].state);
      const confidenceExplanation = service.explainConfidence(created.investigationId) as { confidenceEffect: string };
      assert.strictEqual(confidenceExplanation.confidenceEffect, readiness.confidenceEffect);
      const summary = service.summarize(created.investigationId);
      assert.strictEqual(summary.readinessPosture, readiness.posture);
      assert.strictEqual(summary.gapCount, readiness.gaps.length);
      assert.strictEqual(repository.get(created.investigationId)?.readiness?.inputFingerprint, readiness.inputFingerprint);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  test("returns authoritative empty states until canonical readiness exists", () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), "dvqr-pass3-empty-"));
    try {
      const repository = new WorkspaceInvestigationRepository(root);
      const investigations = new InvestigationApplicationService(repository, "https://example.crm.dynamics.com");
      const created = investigations.start({ question: "Investigate Contact", subject: { table: "contact" } });
      const service = new InvestigationEvidenceIntelligenceService(repository);
      assert.deepStrictEqual(service.listEvidence(created.investigationId), []);
      const readiness = service.getReadiness(created.investigationId);
      assert.strictEqual(readiness.posture, "NotAssessed");
      assert.strictEqual("assessed" in readiness ? readiness.assessed : true, false);
      assert.deepStrictEqual(service.gaps(created.investigationId), []);
      assert.strictEqual(service.missingEvidence(created.investigationId).nextStep, "Continue investigation");
      const readinessExplanation = service.explainReadiness(created.investigationId) as { posture: string };
      const confidenceExplanation = service.explainConfidence(created.investigationId) as { effectiveSynthesizedConfidence: string };
      assert.strictEqual(readinessExplanation.posture, "NotAssessed");
      assert.strictEqual(confidenceExplanation.effectiveSynthesizedConfidence, "Unknown");
      const summary = service.summarize(created.investigationId);
      assert.strictEqual(summary.readinessPosture, "NotAssessed");
      assert.strictEqual(summary.evidenceCount, 0);
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });
});
