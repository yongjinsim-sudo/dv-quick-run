import * as assert from "assert";
import { InvestigationIntentInferenceEngine } from "../../pro/investigations/investigationIntentInference.js";

suite("investigation intent inference", () => {
  const engine = new InvestigationIntentInferenceEngine();

  test("infers Care Plan Activity creation failure with high confidence", () => {
    const result = engine.infer({ question: "Investigate why this Contact's Care Plan Activity was not created." });
    assert.strictEqual(result.focus.value, "Care Plan Activity");
    assert.strictEqual(result.focus.logicalName, undefined);
    assert.strictEqual(result.problem.value, "Expected Care Plan Activity was not created.");
    assert.strictEqual(result.goal.value, "Determine why the expected Care Plan Activity was not created.");
    assert.strictEqual(result.overallConfidence, "High");
    assert.strictEqual(result.requiresClarification, false);
  });

  test("infers Task generation failure with high confidence", () => {
    const result = engine.infer({ question: "Investigate why the expected Task was not generated for this Contact." });
    assert.strictEqual(result.focus.value, "Task");
    assert.strictEqual(result.focus.logicalName, "task");
    assert.strictEqual(result.problem.value, "Expected Task was not created.");
    assert.strictEqual(result.overallConfidence, "High");
    assert.strictEqual(result.requiresClarification, false);
  });

  test("normalizes Task production synonyms into missing creation", () => {
    for (const question of [
      "Investigate why the expected Task wasn't produced for this Contact.",
      "Investigate why the expected Task failed to get created for this Contact."
    ]) {
      const result = engine.infer({ question });
      assert.strictEqual(result.focus.value, "Task");
      assert.strictEqual(result.focus.logicalName, "task");
      assert.strictEqual(result.problem.value, "Expected Task was not created.");
      assert.strictEqual(result.goal.value, "Determine why the expected Task was not created.");
      assert.strictEqual(result.overallConfidence, "High");
      assert.strictEqual(result.requiresClarification, false);
    }
  });

  test("infers missing Questionnaire Response", () => {
    const result = engine.infer({ question: "Investigate missing Questionnaire Responses for this Contact." });
    assert.strictEqual(result.focus.value, "Questionnaire Response");
    assert.match(result.problem.value ?? "", /Questionnaire Response.*missing/i);
    assert.strictEqual(result.requiresClarification, false);
  });

  test("infers relationship focus from missing related records", () => {
    const result = engine.infer({ question: "Troubleshoot whether missing related records explain this issue." });
    assert.strictEqual(result.focus.value, "Relationship");
    assert.match(result.problem.value ?? "", /Relationship.*missing/i);
    assert.strictEqual(result.overallConfidence, "High");
  });


  test("uses metadata-derived custom schema identity for an industry business label", () => {
    const result = engine.infer({
      question: "Investigate why this Contact's Care Plan Activity was not created.",
      candidates: [{ focusId: "contoso_careplanactivity", label: "Care Plan Activity", logicalName: "contoso_careplanactivity" }]
    });
    assert.strictEqual(result.focus.value, "Care Plan Activity");
    assert.strictEqual(result.focus.logicalName, "contoso_careplanactivity");
    assert.strictEqual(result.requiresClarification, false);
  });

  test("does not attach an industry schema identity when metadata supplied no matching candidate", () => {
    const result = engine.infer({ question: "Investigate missing Questionnaire Responses for this Contact." });
    assert.strictEqual(result.focus.value, "Questionnaire Response");
    assert.strictEqual(result.focus.logicalName, undefined);
  });

  test("uses supplied metadata-derived candidates without performing evidence work", () => {
    const result = engine.infer({
      question: "The expected Care Plan Goal is missing.",
      candidates: [{ focusId: "msemr_careplangoal", label: "Care Plan Goal", logicalName: "msemr_careplangoal" }]
    });
    assert.strictEqual(result.focus.value, "Care Plan Goal");
    assert.strictEqual(result.focus.logicalName, "msemr_careplangoal");
    assert.ok(result.limitations.some((item) => /No Dataverse record query/i.test(item)));
  });

  test("falls back to clarification for an ambiguous request", () => {
    const result = engine.infer({ question: "Investigate this weird thing." });
    assert.strictEqual(result.focus.value, undefined);
    assert.strictEqual(result.problem.value, undefined);
    assert.strictEqual(result.overallConfidence, "Low");
    assert.strictEqual(result.requiresClarification, true);
  });

  test("infers a bounded Mini RCA goal without inventing a business surface", () => {
    const result = engine.infer({ question: "Perform a Mini RCA for this Contact." });
    assert.strictEqual(result.focus.value, "Mini RCA");
    assert.match(result.goal.value ?? "", /bounded Mini RCA/i);
    assert.strictEqual(result.requiresClarification, false);
  });

  test("rejects an empty question", () => {
    assert.throws(() => engine.infer({ question: "   " }), /question is required/i);
  });
});
