import * as assert from "assert";
import * as vscode from "vscode";
import {
  buildClauseHover,
  buildOperatorHover,
  buildNavigationPropertyHover
} from "../../providers/hover/hoverBuilders.js";
import type { NavPropertyDef } from "../../services/entityRelationshipMetadataService.js";

function getHoverMarkdown(hover: vscode.Hover): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverMarkdownBuilder", () => {
  test("buildClauseHover includes example for $expand", () => {
    const hover = buildClauseHover("$expand");
    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("contacts?$expand=parentcustomerid_account($select=name)"));
  });

  test("buildOperatorHover includes contains example", () => {
    const hover = buildOperatorHover("contains(");
    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.toLowerCase().includes("contains"));
    assert.ok(
    markdown.includes("contains(fullname") ||
    markdown.includes("contains(")
);
  });

  test("buildNavigationPropertyHover renders example and suggested fields", () => {
    const hover = buildNavigationPropertyHover({
      nav: {
        navigationPropertyName: "parentcustomerid_account",
        relationshipType: "ManyToOne",
        referencingEntity: "contact",
        referencedEntity: "account"
      } as NavPropertyDef,
      sourceEntitySetName: "contacts",
      targetEntitySetName: "accounts",
      exampleExpand: "contacts?$expand=parentcustomerid_account($select=name)",
      suggestedFields: ["name", "accountnumber"]
    });

    const markdown = getHoverMarkdown(hover);
    assert.ok(markdown.includes("Target entity set: `accounts`"));
    assert.ok(markdown.includes("```text"));
    assert.ok(markdown.includes("`name`, `accountnumber`"));
  });
});
