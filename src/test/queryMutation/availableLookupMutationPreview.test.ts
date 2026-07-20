import * as assert from "assert";
import {
  buildAvailableLookupMutationPreview,
  buildAvailableLookupPreviewFlowOptions,
  type AvailableLookup
} from "../../commands/router/actions/queryMutation/availableLookupMutationPreview.js";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";

suite("availableLookupMutationPreview", () => {
  const lookup: AvailableLookup = {
    logicalName: "parentcustomerid",
    displayName: "Company Name",
    attributeType: "Customer",
    selectToken: "_parentcustomerid_value",
    isPolymorphic: true,
    targets: [{
      logicalName: "account",
      displayName: "Account",
      navigationPropertyName: "parentcustomerid_account"
    }]
  };

  test("keeps the original query separate from the identifier preview", () => {
    const original = "contacts?$select=fullname&$filter=statecode eq 0&$orderby=createdon desc&$top=10";
    const preview = buildAvailableLookupMutationPreview(
      original,
      parseEditorQuery(original),
      lookup,
      "insertValue"
    );

    assert.ok(preview);
    assert.strictEqual(preview.result.originalQuery, original);
    const updated = parseEditorQuery(preview.result.updatedQuery);
    assert.strictEqual(updated.queryOptions.get("$select"), "fullname,_parentcustomerid_value");
    assert.strictEqual(updated.queryOptions.get("$filter"), "statecode eq 0");
    assert.strictEqual(updated.queryOptions.get("$orderby"), "createdon desc");
    assert.strictEqual(updated.queryOptions.get("$top"), "10");
  });

  test("builds a target-specific preview without editor access", () => {
    const original = "contacts?$top=25";
    const preview = buildAvailableLookupMutationPreview(
      original,
      parseEditorQuery(original),
      lookup,
      "insertBoth",
      lookup.targets[0]
    );

    assert.ok(preview);
    assert.strictEqual(preview.result.originalQuery, original);
    assert.strictEqual(
      preview.result.updatedQuery,
      "contacts?$top=25&$select=_parentcustomerid_value&$expand=parentcustomerid_account"
    );
  });

  test("keeps apply Pro-gated", () => {
    assert.strictEqual(buildAvailableLookupPreviewFlowOptions(false).mode, "copy");
    assert.strictEqual(buildAvailableLookupPreviewFlowOptions(true).mode, "applyOrCopy");
  });
});
