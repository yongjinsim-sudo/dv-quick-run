import * as assert from "assert";
import * as vscode from "vscode";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { resolveChoiceValueHover } from "../../providers/hover/hoverChoiceResolver.js";
import { buildHoverFieldContext } from "../../providers/hoverFieldContextCache.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";

function getHoverMarkdown(hover: vscode.Hover): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverChoiceResolver", () => {
  test("returns hover for scalar choice value in filter", async () => {
    const fields: FieldDef[] = [
      { logicalName: "statuscode", attributeType: "Status", isValidForRead: true } as FieldDef
    ];

    const choices: ChoiceMetadataDef[] = [
      {
        fieldLogicalName: "statuscode",
        options: [{ value: 1, label: "Active" }]
      } as ChoiceMetadataDef
    ];

    const hover = await resolveChoiceValueHover({
      parsed: parseEditorQuery("contacts?$filter=statuscode eq 1"),
      entitySetName: "contacts",
      hoveredWord: "1",
      requestContext: {
        getEntityByEntitySetName: async () => ({ logicalName: "contact", entitySetName: "contacts" }),
        getFieldContext: async () => buildHoverFieldContext(fields),
        getChoiceMetadata: async () => choices
      } as any,
      token: new vscode.CancellationTokenSource().token
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Value: `1`**"));
    assert.ok(markdown.includes("Meaning: **Active**"));
  });

  test("returns undefined when hovered token is not a scalar value", async () => {
    const hover = await resolveChoiceValueHover({
      parsed: parseEditorQuery("contacts?$filter=statuscode eq 1"),
      entitySetName: "contacts",
      hoveredWord: "statuscode",
      requestContext: {} as any,
      token: new vscode.CancellationTokenSource().token
    });

    assert.strictEqual(hover, undefined);
  });
});
