import * as assert from "assert";
import { buildOperationalProfile } from "../../product/operationalProfile/operationalProfileEngine.js";
import { projectOperationalProfileForMcp } from "../../mcp/mcpOperationalProfileApplicationService.js";

suite("mcpOperationalProfileApplicationService", () => {
  test("projects the canonical Operational Profile and DVQR Score without recalculating MCP-specific semantics", () => {
    const canonical = buildOperationalProfile({
      entityLogicalName: "account",
      entityDisplayName: "Account",
      attributeCount: 120,
      relationshipCount: 35,
      synchronousPluginStepCount: 8,
      totalPluginStepCount: 12,
      asyncOperationCount7d: 40,
      distinctAsyncOperationCount7d: 4,
      activeWorkflowCount: 3,
      flowReferenceCount: 2,
      businessRuleCount: 2,
      realTimeWorkflowCount: 1,
      auditingEnabled: true,
      isManaged: false
    });

    const projected = projectOperationalProfileForMcp(canonical);
    assert.strictEqual(projected.contractVersion, "dvqr-operational-profile-v2");
    assert.strictEqual(projected.table.logicalName, "account");
    assert.strictEqual(projected.profile.score, canonical.dvqrScore?.displayScore);
    assert.strictEqual(projected.profile.scoreBand, canonical.dvqrScore?.band);
    assert.deepStrictEqual(
      projected.profile.contributors.map((item) => item.weightedContribution),
      canonical.dvqrScore?.contributingFactors.map((item) => item.weightedContribution)
    );
    assert.strictEqual(projected.evidence.source, "canonical-operational-profile");
  });

  test("carries explicit score limitations in the MCP projection", () => {
    const projected = projectOperationalProfileForMcp(buildOperationalProfile({ entityLogicalName: "contact" }));
    const limitations = projected.interpretation.limitations.join(" ").toLowerCase();
    assert.ok(limitations.includes("not a health"));
    assert.ok(limitations.includes("root-cause"));
    assert.ok(limitations.includes("does not prove causality"));
  });
  test("preserves GUI score parity when canonical ownership and solution context are present", () => {
    const subject = { type: "entity" as const, logicalName: "contact", displayName: "Contact" };
    const canonical = buildOperationalProfile({
      entityLogicalName: "contact",
      entityDisplayName: "Contact",
      attributeCount: 311,
      relationshipCount: 76,
      synchronousPluginStepCount: 36,
      totalPluginStepCount: 36,
      flowReferenceCount: 2,
      activeWorkflowCount: 0,
      businessRuleCount: 0,
      realTimeWorkflowCount: 0,
      asyncOperationCount7d: 0,
      auditingEnabled: false,
      isManaged: true,
      operationalContext: {
        subject,
        guardrails: [],
        sections: [
          {
            id: "solutionContext",
            label: "Solution Context",
            summary: "Observed solution participation",
            evidence: [{
              subject,
              evidenceType: "SolutionParticipation",
              title: "Observed solution package participation",
              summary: "Bounded solution participation evidence.",
              source: "dataverse",
              scope: "oneHopRelated",
              confidence: "direct"
            }]
          },
          {
            id: "ownershipContext",
            label: "Ownership / Participation Context",
            summary: "Observed ownership model",
            evidence: [{
              subject,
              evidenceType: "Owner",
              title: "Entity ownership model observed",
              summary: "Bounded ownership-model evidence.",
              source: "dataverse",
              scope: "currentSubject",
              confidence: "direct"
            }]
          }
        ]
      }
    });

    const projected = projectOperationalProfileForMcp(canonical);
    assert.strictEqual(canonical.dvqrScore?.displayScore, 63);
    assert.strictEqual(projected.profile.score, 63);
    assert.strictEqual(projected.profile.contributors.find((item) => item.id === "ownershipModel")?.weightedContribution, 5);
    assert.ok((projected.profile.contributors.find((item) => item.id === "solutionParticipation")?.weightedContribution ?? 0) > 0);
  });

  test("projects calibrated score arithmetic without an invented residual contributor", () => {
    const canonical = buildOperationalProfile({
      entityLogicalName: "account",
      entityDisplayName: "Account",
      attributeCount: 216,
      relationshipCount: 68,
      synchronousPluginStepCount: 32,
      totalPluginStepCount: 32,
      activeWorkflowCount: 0,
      flowReferenceCount: 0
    });
    const projected = projectOperationalProfileForMcp(canonical);
    const explanation = projected.profile.scoreExplanation;
    assert.strictEqual(explanation?.weightedEvidence, canonical.dvqrScore?.rawDensityIndex);
    assert.strictEqual(explanation?.calibratedCeiling, 80);
    assert.ok(explanation?.arithmeticGuardrail.includes("do not invent residual"));
    assert.ok(explanation?.terminologyGuardrail.includes("not percentages"));
    assert.ok(projected.profile.contributors.every((item) => item.contributionUnit === "weighted-evidence-points"));
  });

  test("carries semantic guardrails that prevent participation evidence from becoming causal claims", () => {
    const canonical = buildOperationalProfile({
      entityLogicalName: "contact",
      relationshipCount: 76,
      synchronousPluginStepCount: 36,
      flowReferenceCount: 2
    });
    const projected = projectOperationalProfileForMcp(canonical);
    const relationship = projected.profile.contributors.find((item) => item.id === "relationships");
    const plugins = projected.profile.contributors.find((item) => item.id === "plugins");
    const workflows = projected.profile.contributors.find((item) => item.id === "workflows");
    assert.ok(relationship?.mustNotInfer.some((item) => item.includes("runtime-viable traversal paths")));
    assert.ok(plugins?.mustNotInfer.some((item) => item.includes("distinct plug-ins")));
    assert.ok(workflows?.mustNotInfer.some((item) => item.includes("asynchronous")));
    assert.ok(projected.interpretation.presentationRules.prohibitedInferences.some((item) => item.includes("hidden score contribution")));
  });

  test("marks a live current-request profile authoritative over persisted historical snapshots", () => {
    const projected = projectOperationalProfileForMcp(
      buildOperationalProfile({ entityLogicalName: "account", relationshipCount: 68 }),
      { environmentUrl: "https://example.crm.dynamics.com", acquiredAt: "2026-08-14T08:00:00.000Z" }
    );
    assert.strictEqual(projected.evidence.authority.mode, "live-dataverse-current-request");
    assert.strictEqual(projected.evidence.authority.authoritativeForCurrentRequest, true);
    assert.strictEqual(projected.evidence.authority.environmentUrl, "https://example.crm.dynamics.com");
    assert.strictEqual(projected.evidence.authority.table, "account");
    assert.ok(projected.evidence.authority.hostInstruction?.includes("Do not replace it with persisted DVQR snapshots"));
    assert.ok(projected.evidence.comparisonBoundary.rule.includes("must not silently supersede"));
  });

});
