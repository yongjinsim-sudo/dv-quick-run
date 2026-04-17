import * as assert from "assert";
import { buildAddSelectPreviewForScope, buildAddSelectPreviewFromTarget } from "../../refinement/addSelectPreview.js";

suite("addSelectPreview", () => {
  test("adds select when missing", () => {
    const preview = buildAddSelectPreviewFromTarget(
      { text: "contacts?$top=10" },
      ["fullname", "emailaddress1"]
    );

    assert.ok(preview.includes("$top=10"));
    assert.ok(preview.includes("$select=fullname,emailaddress1"));
  });

  test("merges into existing root select", () => {
    const preview = buildAddSelectPreviewFromTarget(
      { text: "contacts?$select=fullname&$top=10" },
      ["emailaddress1"]
    );

    assert.ok(preview.includes("$select=fullname,emailaddress1"));
    assert.ok(preview.includes("$top=10"));
  });

  test("adds select fields to expand scope", () => {
    const preview = buildAddSelectPreviewForScope(
      "contacts?$filter=contactid eq 1&$expand=owninguser($select=systemuserid;$expand=user_task($select=activityid))",
      ["fullname", "internalemailaddress"],
      ["owninguser"]
    );

    assert.ok(preview.includes("owninguser($select=fullname,internalemailaddress,systemuserid;"));
    assert.ok(!preview.includes("contacts?$filter=contactid eq 1&$select=fullname,internalemailaddress"));
  });

  test("adds select fields to nested expand scope", () => {
    const preview = buildAddSelectPreviewForScope(
      "contacts?$filter=contactid eq 1&$expand=owninguser($select=systemuserid;$expand=user_task($select=activityid))",
      ["subject"],
      ["owninguser", "user_task"]
    );

    assert.ok(preview.includes("user_task($select=activityid,subject)"));
  });
});
