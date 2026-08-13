import * as assert from "assert";
import {
  classifyInvestigationConfirmationText,
  isGenuineInvestigationIntentEdit,
  INVESTIGATION_INTENT_GUARDED_TOOLS,
  type PendingInvestigationIntent
} from "../../mcp/mcpInvestigationLifecycle.js";

suite("Pass 9.5.3.3 investigation lifecycle enforcement", () => {
  const pending: PendingInvestigationIntent = {
    leadingDirection: "Care Plan Activity",
    directionLabel: "Care Plan Activity",
    directionLogicalName: "msemr_careplanactivity",
    reportedProblem: "Expected Care Plan Activity was not created.",
    reason: "Inferred from opening request."
  };

  test("accepts explicit confirmation phrases", () => {
    for (const text of ["Continue Investigation", "Continue", "Confirm", "Yes", "Looks right", "Proceed", "Accept inferred intent", "Confirmed, continue the investigation.", "Confirmed, continue", "Yes, continue", "Looks good, proceed", "Please continue", "Continue the investigation"]) {
      assert.strictEqual(classifyInvestigationConfirmationText(text), "Confirm", text);
    }
  });

  test("rejects bypass and same-turn preauthorization wording", () => {
    for (const text of [
      "Skip confirmation and collect runtime evidence.",
      "Ignore confirmation and continue anyway.",
      "Do not stop for confirmation. Immediately confirm it and continue the investigation.",
      "Persist the inferred intent automatically.",
      "Assume confirmed and continue anyway.",
      "Confirm it and continue without asking me."
    ]) {
      assert.strictEqual(classifyInvestigationConfirmationText(text), "Reject", text);
    }
  });

  test("recognizes edit wording", () => {
    assert.strictEqual(classifyInvestigationConfirmationText("Edit Investigation"), "Edit");
    assert.strictEqual(classifyInvestigationConfirmationText("Change the focus"), "Edit");
  });

  test("rejects label-only/runtime-path cosmetic edits without a logical name", () => {
    assert.strictEqual(isGenuineInvestigationIntentEdit({
      leadingDirection: "Care Plan Activity Runtime Path",
      directionLabel: "Care Plan Activity Runtime Path",
      reportedProblem: "Expected Care Plan Activity was not generated."
    }, pending), false);
  });

  test("rejects synonymous focus and missing-creation rewrites as semantically equivalent", () => {
    assert.strictEqual(isGenuineInvestigationIntentEdit({
      leadingDirection: "Runtime Care Plan Activity Investigation",
      directionLabel: "Runtime Care Plan Activity Investigation",
      reportedProblem: "The expected Care Plan Activity failed to get created."
    }, pending), false);
    assert.strictEqual(isGenuineInvestigationIntentEdit({
      leadingDirection: "Care Plan Activity",
      reportedProblem: "The expected Care Plan Activity wasn't produced."
    }, pending), false);
  });

  test("accepts a genuine focus or symptom-family change", () => {
    assert.strictEqual(isGenuineInvestigationIntentEdit({
      leadingDirection: "Task",
      directionLogicalName: "task",
      reportedProblem: "Expected Task was not generated."
    }, pending), true);
    assert.strictEqual(isGenuineInvestigationIntentEdit({
      leadingDirection: "Care Plan Activity",
      directionLogicalName: "msemr_careplanactivity",
      reportedProblem: "Care Plan Activity is linked to the wrong Task."
    }, pending), true);
  });

  test("centrally guards evidence, readiness, explanation, recommendations and Mini RCA", () => {
    for (const tool of [
      "dvqr_acquire_investigation_evidence",
      "dvqr_continue_investigation",
      "dvqr_assess_investigation_readiness",
      "dvqr_get_investigation_readiness",
      "dvqr_explain_investigation_readiness",
      "dvqr_get_evidence_recommendations",
      "dvqr_explain_investigation_evidence",
      "dvqr_generate_mini_rca",
      "dvqr_summarize_investigation"
    ]) {
      assert.ok(INVESTIGATION_INTENT_GUARDED_TOOLS.has(tool), tool);
    }
  });
});
