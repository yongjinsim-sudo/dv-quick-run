import * as assert from "assert";
import { buildAddSelectPreviewFromTarget } from "../../refinement/addSelectPreview.js";

suite("addSelectPreview", () => {
  test("adds select when missing", () => {
    const preview = buildAddSelectPreviewFromTarget(
      { text: "contacts?$top=10" },
      ["fullname", "emailaddress1"]
    );

    assert.ok(preview.includes("$top=10"));
    assert.ok(preview.includes("$select=fullname,emailaddress1"));
  });

  test("throws when select already exists", () => {
    assert.throws(
      () => buildAddSelectPreviewFromTarget({ text: "contacts?$select=fullname&$top=10" }, ["emailaddress1"]),
      /already contains \$select/i
    );
  });
});
