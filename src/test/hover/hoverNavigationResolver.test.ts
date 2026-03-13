import * as assert from "assert";
import * as vscode from "vscode";
import { clearNavigationHoverEnrichmentCache } from "../../providers/queryHoverProvider.js";
import { resolveNavigationHover } from "../../providers/hover/hoverNavigationResolver.js";
import { buildHoverFieldContext } from "../../providers/hoverFieldContextCache.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";
import type { NavPropertyDef } from "../../services/entityRelationshipMetadataService.js";
import type { EntityDef } from "../../utils/entitySetCache.js";

function getHoverMarkdown(hover: vscode.Hover): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverNavigationResolver", () => {
  setup(() => {
    clearNavigationHoverEnrichmentCache();
  });

  test("returns enriched navigation hover for expand token", async () => {
    const defs: EntityDef[] = [
      { logicalName: "contact", entitySetName: "contacts" } as EntityDef,
      { logicalName: "account", entitySetName: "accounts" } as EntityDef
    ];

    const navs: NavPropertyDef[] = [
      {
        navigationPropertyName: "parentcustomerid_account",
        relationshipType: "ManyToOne",
        referencingEntity: "contact",
        referencedEntity: "account",
        referencingAttribute: "parentcustomerid",
        schemaName: "contact_customer_accounts"
      } as NavPropertyDef
    ];

    const accountFields: FieldDef[] = [
      { logicalName: "name", attributeType: "String", isValidForRead: true } as FieldDef,
      { logicalName: "accountnumber", attributeType: "String", isValidForRead: true } as FieldDef
    ];

    const hover = await resolveNavigationHover({
      lineText: "contacts?$expand=parentcustomerid_account($select=name)",
      entitySetName: "contacts",
      hoveredWord: "parentcustomerid_account",
      requestContext: {
        getEntityDefs: async () => defs,
        getNavigationProperties: async () => navs,
        getFieldContext: async () => buildHoverFieldContext(accountFields)
      } as any,
      token: new vscode.CancellationTokenSource().token
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("Expand Navigation: `parentcustomerid_account`"));
    assert.ok(markdown.includes("Target entity set: `accounts`"));
    assert.ok(markdown.includes("contacts?$expand=parentcustomerid_account($select=name)"));
  });

  test("returns undefined when token is not inside expand", async () => {
    const hover = await resolveNavigationHover({
      lineText: "contacts?$select=fullname",
      entitySetName: "contacts",
      hoveredWord: "fullname",
      requestContext: {} as any,
      token: new vscode.CancellationTokenSource().token
    });

    assert.strictEqual(hover, undefined);
  });
});
