import * as assert from "assert";
import { buildDvqrScore } from "../../dvqrScore/dvqrScoreEngine.js";
import { buildOperationalProfile } from "../../product/operationalProfile/operationalProfileEngine.js";

suite("dvqrScoreEngine", () => {
  test("builds an explainable operational-density score without risk semantics", () => {
    const profile = buildOperationalProfile({
      entityLogicalName: "contact",
      synchronousPluginStepCount: 24,
      relationshipCount: 96,
      activeWorkflowCount: 3,
      flowReferenceCount: 2,
      isManaged: true,
      operationalContext: {
        subject: { type: "entity", logicalName: "contact" },
        sections: [{
          id: "solutionContext",
          label: "Solution Context",
          summary: "Solution participation observed.",
          evidence: [{
            subject: { type: "entity", logicalName: "contact" },
            evidenceType: "SolutionParticipation",
            title: "Solution participation",
            summary: "Observed nearby packaging context.",
            source: "metadata",
            scope: "oneHopRelated",
            confidence: "related"
          }]
        }],
        guardrails: []
      }
    });

    const score = buildDvqrScore(profile);

    assert.ok(score.displayScore > 0);
    assert.ok(score.displayScore <= 100);
    assert.ok(score.rawDensityIndex > 0);
    assert.strictEqual(score.normalizationVersion, "dvqr-density-v1");
    assert.strictEqual(score.explanationVersion, "v1");
    assert.strictEqual(score.evidencePrinciple, "Observed evidence → bounded interpretation → guided investigation");
    assert.ok(score.methodology.toLowerCase().includes("observable metadata"));
    assert.ok(score.contributingFactors.some((factor) => factor.key === "relationships" && factor.weightedContribution > 0));
    assert.ok(score.contributingFactors.some((factor) => factor.key === "relationships" && factor.softCap > 0));
    assert.ok(score.contributingFactors.some((factor) => factor.key === "relationships" && factor.formula.includes("ln")));
    assert.ok(score.contributingFactors.some((factor) => factor.key === "plugins" && factor.weightedContribution > 0));
    assert.ok(score.contributingFactors.some((factor) => factor.key === "solutionParticipation" && factor.weightedContribution > 0));

    const scoreText = `${score.band} ${score.summary} ${score.contributingFactors.map((factor) => factor.explanation).join(" ")}`.toLowerCase();
    assert.ok(scoreText.includes("operational density"));
    assert.ok(scoreText.includes("contextual complexity"));
    assert.ok(!scoreText.includes("risk"));
    assert.ok(!scoreText.includes("danger"));
    assert.ok(!scoreText.includes("health"));
    assert.ok(!scoreText.includes("root cause"));
    assert.ok(!scoreText.includes("failure"));
  });

  test("keeps absent evidence as minimal density", () => {
    const profile = buildOperationalProfile({ entityLogicalName: "quietentity" });

    assert.strictEqual(profile.dvqrScore?.displayScore, 0);
    assert.strictEqual(profile.dvqrScore?.band, "Minimal");
    assert.ok(profile.dvqrScore?.summary.includes("minimal operational density"));
    assert.ok(profile.dvqrScore?.contributingFactors.every((factor) => factor.weightedContribution === 0));
  });
});
