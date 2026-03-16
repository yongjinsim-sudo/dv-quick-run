import * as assert from "assert";
import {
  rescoreSelectedInvestigationCandidate,
  scoreInvestigationCandidates
} from "../../commands/router/actions/investigateRecord/investigationCandidateScorer.js";
import type { InvestigationCandidate } from "../../commands/router/actions/investigateRecord/investigationCandidateTypes.js";

suite("investigationCandidateScorer", () => {
  test("primary id beats lookup guid for same record payload", () => {
    const candidates: InvestigationCandidate[] = [
      { recordId: "8129eec7-4414-f111-8341-6045bdc42f8b", fieldName: "contactid", sourceType: "rootField" },
      { recordId: "22222222-2222-2222-2222-222222222222", fieldName: "_ownerid_value", sourceType: "lookup" }
    ];

    const result = scoreInvestigationCandidates(candidates, {
      primaryIdField: "contactid",
      entitySetName: "contacts"
    });

    assert.strictEqual(result[0].fieldName, "contactid");
    assert.strictEqual(result[0].candidateType, "primary");
    assert.strictEqual(result[0].precedenceTier, 1);
    assert.strictEqual(result[1].candidateType, "related");
  });

  test("entity-set primary id pattern outranks generic id suffix", () => {
    const candidates: InvestigationCandidate[] = [
      { recordId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", fieldName: "accountid", sourceType: "rootField" },
      { recordId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", fieldName: "customerid", sourceType: "rootField" }
    ];

    const result = scoreInvestigationCandidates(candidates, {
      entitySetName: "accounts"
    });

    assert.strictEqual(result[0].fieldName, "accountid");
    assert.strictEqual(result[0].precedenceTier, 2);
    assert.strictEqual(result[1].precedenceTier, 5);
  });

  test("metadata rescoring upgrades selected primary id candidate", () => {
    const result = rescoreSelectedInvestigationCandidate(
      {
        recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
        fieldName: "contactid",
        sourceType: "rootField"
      },
      {
        entityLogicalName: "contact",
        primaryIdField: "contactid",
        entitySetName: "contacts"
      }
    );

    assert.strictEqual(result.candidateType, "primary");
    assert.strictEqual(result.confidence, 96);
    assert.match(result.reason, /primary id attribute/i);
  });

  test("common system lookups are heavily penalized", () => {
    const result = scoreInvestigationCandidates([
      { recordId: "22222222-2222-2222-2222-222222222222", fieldName: "_createdby_value", sourceType: "lookup" }
    ], { entitySetName: "contacts" });

    assert.strictEqual(result[0].confidence, 20);
    assert.strictEqual(result[0].candidateType, "related");
    assert.match(result[0].reason, /Common related\/system lookup field/);
  });

  test("sorts by precedence then confidence then primary bias", () => {
    const result = scoreInvestigationCandidates([
      { recordId: "1", fieldName: "sampleid", sourceType: "rootField" } as any,
      { recordId: "2", fieldName: "id", sourceType: "rootField" } as any,
      { recordId: "3", fieldName: "_ownerid_value", sourceType: "lookup" } as any
    ], { entitySetName: "samples" });

    assert.strictEqual(result[0].fieldName, "sampleid");
    assert.strictEqual(result[1].fieldName, "_ownerid_value");
    assert.strictEqual(result[2].fieldName, "id");
  });

  test("metadata rescoring upgrades generic custom primary id candidates", () => {
    const result = rescoreSelectedInvestigationCandidate(
      {
        recordId: "11111111-1111-1111-1111-111111111111",
        fieldName: "sample_customactivitydefinitionid",
        sourceType: "rootField"
      },
      {
        entityLogicalName: "sample_customactivitydefinition",
        primaryIdField: "sample_customactivitydefinitionid",
        entitySetName: "sample_customactivitydefinitions"
      }
    );

    assert.strictEqual(result.candidateType, "primary");
    assert.ok(result.confidence >= 95);
    assert.match(result.reason, /primary id/i);
  });

});
