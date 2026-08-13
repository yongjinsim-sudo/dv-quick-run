import * as assert from "assert";
import { InvestigationBootstrapService, buildInvestigationPlan } from "../../pro/investigations/investigationPlanning.js";
import { InvestigationFocusSuggestionService } from "../../pro/investigations/investigationFocus.js";
import type { Investigation } from "../../pro/investigations/investigationContracts.js";
import { DVQR_LIVE_MCP_TOOLS } from "../../mcp/mcpLiveToolCatalogue.js";

function investigation(): Investigation {
  return {
    investigationId: "inv-00000000-0000-0000-0000-000000000093",
    schemaVersion: "dvqr-investigation-v1",
    title: "Contact investigation",
    type: "Record",
    status: "Active",
    environmentId: "dev",
    subject: { kind: "Record", logicalName: "contact", recordIdMasked: "***00000093" },
    question: "Why is the expected business record missing?",
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    evidenceRefs: [], contributorStates: [], miniRcaArtifactRefs: [], executionRefs: [], reportRefs: [],
    lineage: { derivedFromArtifactIds: [], createdByCapability: "dvqr_start_investigation" },
    limitations: []
  };
}

suite("investigation bootstrap and planning", () => {
  test("bootstraps before evidence and makes intent the next stage", () => {
    let stored = investigation();
    const repository = { get: () => stored, save: (value: Investigation) => { stored = value; } } as never;
    const focus = new InvestigationFocusSuggestionService(repository, { list: () => [] } as never);
    const service = new InvestigationBootstrapService(repository, focus, () => new Date("2026-08-05T01:00:00.000Z"));
    const result = service.bootstrap(stored.investigationId);
    assert.strictEqual(result.intentRequired, true);
    assert.strictEqual(result.plan.currentStage, "Intent");
    assert.strictEqual(result.plan.recommendedNextAction.tool, "dvqr_update_investigation_intent");
    assert.strictEqual(stored.bootstrapCompletedAt, "2026-08-05T01:00:00.000Z");
    assert.ok(result.suggestedFocuses.some((item) => item.focusId === "custom"));
    assert.strictEqual(result.preparation.status, "Prepared");
    assert.match(result.preparation.evidenceBoundary, /No runtime record query/i);
    assert.ok(result.preparation.planPreview.length > 0);
  });

  test("plan advances only after persisted intent", () => {
    const base = { ...investigation(), bootstrapCompletedAt: "2026-08-05T01:00:00.000Z" };
    assert.strictEqual(buildInvestigationPlan(base, "2026-08-05T01:00:00.000Z").currentStage, "Intent");
    const withIntent: Investigation = {
      ...base,
      currentIntent: { intentVersion: 1, leadingDirection: "Care Plan Activity", directionLabel: "Care Plan Activity", directionSource: "UserCustom", reportedProblem: "Expected activity was not created.", keywords: ["care", "plan", "activity"], reason: "Initial investigator intent.", updatedBy: "User", updatedAt: "2026-08-05T01:01:00.000Z" }
    };
    assert.strictEqual(buildInvestigationPlan(withIntent, "2026-08-05T01:01:00.000Z").currentStage, "Metadata");
  });

  test("exposes bootstrap as a first-class live MCP tool", () => {
    const tool = DVQR_LIVE_MCP_TOOLS.find((item) => item.name === "dvqr_bootstrap_investigation");
    if (!tool) throw new Error("Bootstrap tool was not registered.");
    assert.match(tool.description, /(existing investigation before evidence acquisition|after dvqr_start_investigation)/i);
    assert.match(tool.description, /before (?:any )?evidence acquisition/i);
  });
});
