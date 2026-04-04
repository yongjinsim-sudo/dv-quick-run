import * as assert from "assert";
import { buildMutationPreviewDocumentContent } from "../../refinement/queryPreview.js";

suite("queryPreview", () => {
  test("builds preview document from shared mutation result contract", () => {
    const content = buildMutationPreviewDocumentContent(
      {
        originalQuery: "contacts",
        updatedQuery: "contacts?$top=10",
        summary: "Add $top=10"
      },
      {
        heading: "Add $top=10",
        sections: [
          { label: "Generated change", value: "$top=10" }
        ]
      }
    );

    assert.ok(content.includes("DV Quick Run – Query Preview"));
    assert.ok(content.includes("Original query:"));
    assert.ok(content.includes("contacts?$top=10"));
    assert.ok(content.includes("Generated change:"));
    assert.ok(content.includes("$top=10"));
    assert.ok(content.includes("Use the confirmation dialog to apply this preview."));
  });

  test("builds copy-oriented preview guidance when requested", () => {
    const content = buildMutationPreviewDocumentContent(
      {
        originalQuery: "contacts",
        updatedQuery: "contacts?$top=10",
        summary: "Add $top=10"
      },
      {
        heading: "Add $top=10"
      },
      {
        mode: "copy"
      }
    );

    assert.ok(content.includes("Copy the preview query to the clipboard") || content.includes("copy this preview query to the clipboard"));
    assert.ok(!content.includes("Use the confirmation dialog to apply this preview."));
  });
});
