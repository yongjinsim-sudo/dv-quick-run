import * as assert from "assert";
import type { ComparisonProviderResult, ComparisonViewModel } from "../../core/comparison/index.js";
import {
  MINI_RCA_ARTIFACT_SCHEMA_V1,
  adaptCrossDiffToInvestigationInput,
  generateMiniRcaArtifact,
  parseMiniRcaArtifactJson,
  regenerateMiniRcaArtifact,
  renderMiniRcaReportHtml,
  renderMiniRcaReportMarkdown,
  serializeMiniRcaArtifact
} from "../../pro/miniRca/index.js";
import { createJsonSchemaTestValidator } from "./jsonSchemaTestValidator.js";

const FIRST_GENERATED_UTC = "2026-07-23T01:00:00.000Z";
const SECOND_GENERATED_UTC = "2026-07-23T02:00:00.000Z";

function provider(
  providerId: string,
  title: string,
  differenceId: string,
  differenceTitle: string,
  significance: "High" | "Medium" | "Low"
): ComparisonProviderResult {
  return {
    providerId,
    title,
    groups: [{
      id: `${providerId}-group`,
      title,
      summary: `${title} comparison`,
      significance,
      differences: [{
        id: differenceId,
        title: differenceTitle,
        summary: `${differenceTitle} between DEV and TEST.`,
        kind: "Changed",
        significance,
        sourceValue: "DEV value",
        targetValue: "TEST value",
        evidence: [
          { label: "DEV", value: "DEV value", source: "source" },
          { label: "TEST", value: "TEST value", source: "target" }
        ]
      }]
    }]
  };
}

function comparison(extraProviders: readonly ComparisonProviderResult[] = []): ComparisonViewModel {
  const providers = [
    provider("relationship-metadata", "Relationship Metadata", "relationship-1", "Relationship definition differs", "High"),
    provider("attribute-metadata", "Attribute Metadata", "attribute-1", "Required level differs", "Medium"),
    provider("identity-participation", "Identity Participation", "identity-1", "Team participation differs", "Low"),
    ...extraProviders
  ];
  const differences = providers.flatMap((item) => item.groups.flatMap((group) => group.differences));
  return {
    title: "Cross-Environment Diff: DEV → TEST",
    summary: {
      sourceLabel: "DEV",
      targetLabel: "TEST",
      sourceCapturedAtIso: "2026-07-22T20:00:00.000Z",
      targetCapturedAtIso: "2026-07-22T20:05:00.000Z",
      highCount: differences.filter((item) => item.significance === "High").length,
      mediumCount: differences.filter((item) => item.significance === "Medium").length,
      lowCount: differences.filter((item) => item.significance === "Low").length,
      providerCount: providers.length,
      differenceCount: differences.length,
      subjectLabel: "Account",
      entityLogicalName: "account"
    },
    snapshotTrust: {
      sourceTrustState: "Verified",
      targetTrustState: "Verified"
    },
    groups: providers.flatMap((item) => item.groups),
    providerResults: providers
  };
}

function artifactAt(model: ComparisonViewModel, generatedAtIso: string) {
  const input = adaptCrossDiffToInvestigationInput(model, {
    generatedAtIso,
    readiness: {
      assessmentUtc: generatedAtIso,
      generatedUtc: generatedAtIso,
      intent: {
        auditRequested: true,
        actorOrChangeTimeRequested: true,
        temporalProgressionRequested: true
      }
    }
  });
  return generateMiniRcaArtifact(input, {
    generatedAtIso,
    assessmentUtc: generatedAtIso
  });
}

function escapedPattern(value: string): RegExp {
  return new RegExp(value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
}

suite("miniRcaArtifactPersistence", () => {
  test("serializes a frozen canonical artifact that passes the v1 schema", () => {
    const artifact = artifactAt(comparison(), FIRST_GENERATED_UTC);
    const serialized = serializeMiniRcaArtifact(artifact);
    const parsed = JSON.parse(serialized) as unknown;
    const validate = createJsonSchemaTestValidator(MINI_RCA_ARTIFACT_SCHEMA_V1);

    assert.deepStrictEqual(validate(parsed), []);
    assert.ok(serialized.startsWith('{"artifactVersion":"mini-rca-artifact-v1"'));
    assert.ok(serialized.endsWith("\n"));
    assert.strictEqual(serializeMiniRcaArtifact(artifact), serialized);
    assert.strictEqual(Object.isFrozen(artifact), true);
    assert.strictEqual(Object.isFrozen(artifact.report), true);
    assert.strictEqual(artifact.persistence.state, "frozen");
    assert.strictEqual(artifact.persistence.regeneration, "explicit");
    assert.strictEqual(artifact.persistence.persistedAtIso, FIRST_GENERATED_UTC);
    assert.strictEqual(artifact.report.generatedAtIso, FIRST_GENERATED_UTC);
    assert.strictEqual(artifact.persistence.readiness?.assessmentUtc, FIRST_GENERATED_UTC);
    assert.strictEqual(artifact.persistence.readiness?.generatedUtc, FIRST_GENERATED_UTC);
    assert.strictEqual(artifact.persistence.readiness?.profileVersion, "1.0");
    assert.ok(artifact.persistence.readiness?.inputFingerprint);
  });

  test("renders Markdown, HTML, and JSON from one semantically identical report", () => {
    const artifact = artifactAt(comparison(), FIRST_GENERATED_UTC);
    const markdown = renderMiniRcaReportMarkdown(artifact.report);
    const html = renderMiniRcaReportHtml(artifact.report);
    const parsed = parseMiniRcaArtifactJson(serializeMiniRcaArtifact(artifact));

    assert.strictEqual(parsed.kind, "artifact");
    assert.deepStrictEqual(parsed.report, artifact.report);
    assert.match(markdown, /Account/);
    assert.match(html, /Account/);
    for (const evidence of artifact.report.evidence) {
      assert.match(markdown, escapedPattern(evidence.title));
      assert.match(html, escapedPattern(evidence.title));
    }

    const readiness = artifact.report.investigationReadiness;
    assert.ok(readiness && readiness.contractVersion === "investigation-readiness-v1");
    for (const gap of readiness.gaps) {
      assert.match(markdown.split("## Appendix")[1] ?? "", escapedPattern(gap.ruleId));
      assert.match(html, escapedPattern(gap.ruleId));
    }
  });

  test("does not refresh a persisted report until explicit regeneration", () => {
    const original = artifactAt(comparison(), FIRST_GENERATED_UTC);
    const originalJson = serializeMiniRcaArtifact(original);
    const changedModel = comparison([
      provider("environment-variable", "Environment Variables", "variable-1", "Environment variable differs", "High")
    ]);
    const currentInput = adaptCrossDiffToInvestigationInput(changedModel, {
      generatedAtIso: SECOND_GENERATED_UTC
    });

    assert.strictEqual(serializeMiniRcaArtifact(original), originalJson);
    assert.strictEqual(original.report.evidence.some((item) => item.providerId === "environment-variable"), false);

    const regenerated = regenerateMiniRcaArtifact(original, currentInput, {
      generatedAtIso: SECOND_GENERATED_UTC,
      assessmentUtc: SECOND_GENERATED_UTC
    });
    assert.notStrictEqual(regenerated, original);
    assert.notStrictEqual(serializeMiniRcaArtifact(regenerated), originalJson);
    assert.strictEqual(regenerated.report.evidence.some((item) => item.providerId === "environment-variable"), true);
    assert.strictEqual(regenerated.persistence.persistedAtIso, SECOND_GENERATED_UTC);
    assert.strictEqual(serializeMiniRcaArtifact(original), originalJson);
  });

  test("reads historical raw reports without fabricating readiness", () => {
    const artifact = artifactAt(comparison(), FIRST_GENERATED_UTC);
    const { investigationReadiness: _readiness, ...historicalReport } = artifact.report;
    const parsed = parseMiniRcaArtifactJson(JSON.stringify(historicalReport));

    assert.strictEqual(parsed.kind, "historical-report");
    assert.strictEqual(parsed.historical, true);
    assert.strictEqual(parsed.report.investigationReadiness, undefined);
    assert.doesNotMatch(renderMiniRcaReportMarkdown(parsed.report), /Investigation Readiness Technical Trace/);
    assert.doesNotMatch(renderMiniRcaReportHtml(parsed.report), /Investigation Readiness · technical trace/);
  });

  test("keeps the main readiness section concise and the Appendix complete", () => {
    const artifact = artifactAt(comparison(), FIRST_GENERATED_UTC);
    const readiness = artifact.report.investigationReadiness;
    assert.ok(readiness && readiness.contractVersion === "investigation-readiness-v1");
    const markdown = renderMiniRcaReportMarkdown(artifact.report);
    const main = markdown.split("## Appendix")[0];
    const appendix = markdown.split("## Appendix")[1] ?? "";

    for (const gap of readiness.gaps.slice(0, 3)) {
      assert.match(main, escapedPattern(gap.title));
    }
    for (const gap of readiness.gaps) {
      assert.match(appendix, escapedPattern(gap.ruleId));
    }
    assert.match(markdown, /does not certify truth, causality, completeness, remediation, or operational authority/i);
    assert.doesNotMatch(markdown, /\b(remediation complete|deploy this fix|apply this fix|rollback now)\b/i);
  });

  test("rejects unsupported JSON instead of treating it as a historical report", () => {
    assert.throws(
      () => parseMiniRcaArtifactJson('{"schemaVersion":"mini-rca-v1"}'),
      /not a supported Mini RCA artifact/
    );
  });
});
