import * as assert from "assert";
import { buildResolvedInvestigationContext } from "../../commands/router/actions/investigateRecord/resolvedInvestigationContextBuilder.js";

suite("resolvedInvestigationContextBuilder", () => {
  test("builds canonical context from active record context", () => {
    const result = buildResolvedInvestigationContext({
      environmentName: "SIT",
      input: {
        type: "json",
        rawText: "{}",
        recordId: "8129eec7-4414-f111-8341-6045bdc42f8b"
      },
      activeRecordContext: {
        entityLogicalName: "contact",
        entitySetName: "contacts",
        primaryIdField: "contactid",
        primaryNameField: "fullname",
        inferenceSource: "jsonContext"
      },
      primaryNameValue: "Alice Example",
      wasFallbackUsed: false
    });

    assert.deepStrictEqual(result, {
      environmentName: "SIT",
      recordId: "8129eec7-4414-f111-8341-6045bdc42f8b",
      entityLogicalName: "contact",
      entitySetName: "contacts",
      primaryIdField: "contactid",
      primaryNameField: "fullname",
      primaryNameValue: "Alice Example",
      inferenceSource: "jsonContext",
      inputType: "json",
      wasFallbackUsed: false
    });
  });

  test("keeps fallback flag when retry path was used", () => {
    const result = buildResolvedInvestigationContext({
      environmentName: "DEV",
      input: {
        type: "guid",
        rawText: "8129eec7-4414-f111-8341-6045bdc42f8b",
        recordId: "8129eec7-4414-f111-8341-6045bdc42f8b"
      },
      activeRecordContext: {
        entityLogicalName: "account",
        entitySetName: "accounts",
        inferenceSource: "quickPick"
      },
      wasFallbackUsed: true
    });

    assert.strictEqual(result.wasFallbackUsed, true);
    assert.strictEqual(result.inferenceSource, "quickPick");
  });
});
