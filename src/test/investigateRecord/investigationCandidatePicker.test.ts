import * as assert from "assert";
import { pickInvestigationCandidate } from "../../commands/router/actions/investigateRecord/investigationCandidatePicker.js";
import type { ScoredInvestigationCandidate } from "../../commands/router/actions/investigateRecord/investigationCandidateTypes.js";

suite("investigationCandidatePicker", () => {
  test("returns undefined for empty candidate list", async () => {
    const result = await pickInvestigationCandidate([]);
    assert.strictEqual(result, undefined);
  });

  test("returns only candidate without prompting", async () => {
    const candidate: ScoredInvestigationCandidate = {
      recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
      fieldName: "contactid",
      sourceType: "rootField",
      confidence: 96,
      candidateType: "primary",
      reason: "Matches table primary id attribute",
      precedenceTier: 1,
      autoSelectEligible: true
    };

    const result = await pickInvestigationCandidate([candidate]);
    assert.deepStrictEqual(result, candidate);
  });

  test("auto-selects strongest primary candidate when confidence gap is clear", async () => {
    const result = await pickInvestigationCandidate([
      {
        recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
        fieldName: "contactid",
        sourceType: "rootField",
        confidence: 96,
        candidateType: "primary",
        reason: "Matches table primary id attribute",
        precedenceTier: 1,
        autoSelectEligible: true
      },
      {
        recordId: "22222222-2222-2222-2222-222222222222",
        fieldName: "_ownerid_value",
        sourceType: "lookup",
        confidence: 20,
        candidateType: "related",
        reason: "Common related/system lookup field",
        precedenceTier: 4,
        autoSelectEligible: false
      }
    ]);

    assert.strictEqual(result?.fieldName, "contactid");
  });

  test("prefers primary id candidate over lookup candidate", async () => {
    const lookupCandidate: ScoredInvestigationCandidate = {
      recordId: "11111111-1111-4111-8111-111111111111",
      fieldName: "_ownerid_value",
      sourceType: "lookup",
      confidence: 85,
      candidateType: "related",
      reason: "Common related/system lookup field",
      precedenceTier: 4,
      autoSelectEligible: false
    };

    const primaryCandidate: ScoredInvestigationCandidate = {
      recordId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
      fieldName: "contactid",
      sourceType: "rootField",
      confidence: 90,
      candidateType: "primary",
      reason: "Matches table primary id attribute",
      precedenceTier: 1,
      autoSelectEligible: true
    };

    const result = await pickInvestigationCandidate([
      lookupCandidate,
      primaryCandidate
    ]);

    assert.strictEqual(result?.fieldName, "contactid");
    assert.strictEqual(result?.candidateType, "primary");
    assert.strictEqual(result?.recordId, "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa");
  });

});
