import * as assert from "assert";
import * as vscode from "vscode";
import { parseEditorQuery } from "../../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import { resolveFieldHover } from "../../providers/hover/hoverFieldResolver.js";
import { buildHoverFieldContext } from "../../providers/hoverFieldContextCache.js";
import type { ChoiceMetadataDef } from "../../services/entityChoiceMetadataService.js";
import type { FieldDef } from "../../services/entityFieldMetadataService.js";

function getHoverMarkdown(hover: vscode.Hover): string {
  const first = Array.isArray(hover.contents) ? hover.contents[0] : hover.contents;
  return typeof first === "string" ? first : "value" in first ? first.value : String(first);
}

suite("hoverFieldResolver", () => {
  test("returns hover for field logical name with choice values", async () => {
    const fields: FieldDef[] = [
      { logicalName: "statuscode", attributeType: "Status", isValidForRead: true } as FieldDef
    ];

    const choices: ChoiceMetadataDef[] = [
      {
        fieldLogicalName: "statuscode",
        options: [
          { value: 1, label: "Active" },
          { value: 2, label: "Inactive" }
        ]
      } as ChoiceMetadataDef
    ];

    const hover = await resolveFieldHover({
      parsed: parseEditorQuery("contacts?$select=statuscode&$filter=statuscode eq 1"),
      entitySetName: "contacts",
      hoveredWord: "statuscode",
      requestContext: {
        getEntityByEntitySetName: async () => ({ logicalName: "contact", entitySetName: "contacts" }),
        getFieldContext: async () => buildHoverFieldContext(fields),
        getChoiceMetadata: async () => choices
      } as any,
      token: new vscode.CancellationTokenSource().token,
      documentUri: vscode.Uri.parse("file:///tmp/test.http"),
      lineNumber: 0
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("**Field: `statuscode`**"));
    assert.ok(markdown.includes("➜ **`1` = Active**"));
    assert.ok(markdown.includes("Preview replace current filter value"));
  });

  test("returns hover when hovered token matches select token", async () => {
    const fields: FieldDef[] = [
      { logicalName: "ownerid", attributeType: "Owner", isValidForRead: true } as FieldDef
    ];

    const hover = await resolveFieldHover({
      parsed: parseEditorQuery("contacts?$select=_ownerid_value"),
      entitySetName: "contacts",
      hoveredWord: "_ownerid_value",
      requestContext: {
        getEntityByEntitySetName: async () => ({ logicalName: "contact", entitySetName: "contacts" }),
        getFieldContext: async () => buildHoverFieldContext(fields),
        getChoiceMetadata: async () => []
      } as any,
      token: new vscode.CancellationTokenSource().token
    });

    assert.ok(hover);
    const markdown = getHoverMarkdown(hover!);
    assert.ok(markdown.includes("Select token: `_ownerid_value`"));
    assert.ok(markdown.includes("Field: `ownerid`"));
  });
});
