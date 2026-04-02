import * as vscode from "vscode";
import { applyEditorQueryUpdate } from "../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import { getLogicalEditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";
import {
  buildEditorQuery,
  getEntitySetNameFromEditorQuery,
  parseEditorQuery
} from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import type { CommandContext } from "../commands/context/commandContext.js";
import { loadEntityDefByEntitySetName, loadFields } from "../commands/router/actions/shared/metadataAccess.js";
import { getSelectableFields } from "../commands/router/actions/shared/selectableFields.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export async function previewAndApplyAddSelectInActiveEditor(ctx: CommandContext): Promise<void> {
  const target = getLogicalEditorQueryTarget();
  const parsed = parseEditorQuery(target.text);

  if (parsed.queryOptions.has("$select")) {
    void vscode.window.showWarningMessage("DV Quick Run: The detected query already contains $select.");
    return;
  }

  const entitySetName = getEntitySetNameFromEditorQuery(parsed.entityPath);
  if (!entitySetName) {
    throw new Error("Could not determine the Dataverse entity set for the current query.");
  }

  const token = await ctx.getToken(ctx.getScope());
  const client = ctx.getClient();
  const entityDef = await loadEntityDefByEntitySetName(ctx, client, token, entitySetName);
  if (!entityDef) {
    throw new Error(`Could not resolve metadata for entity set '${entitySetName}'.`);
  }

  const fields = await loadFields(ctx, client, token, entityDef.logicalName);
  const selectable = getSelectableFields(fields);

  const picked = await vscode.window.showQuickPick(
    selectable.map((field) => ({
      label: field.logicalName,
      description: field.attributeType,
      detail: `$select token: ${field.selectToken}`,
      token: field.selectToken as string
    })),
    {
      title: `DV Quick Run: Preview Add Fields ($select) — ${entityDef.entitySetName}`,
      placeHolder: "Pick fields to preview in $select",
      canPickMany: true,
      ignoreFocusOut: true,
      matchOnDescription: true,
      matchOnDetail: true
    }
  );

  if (!picked || picked.length === 0) {
    return;
  }

  const selectedTokens = picked.map((item) => item.token);
  const previewQuery = buildAddSelectPreviewFromTarget(target, selectedTokens);

  await openOrReuseQueryPreviewDocument([
    "DV Quick Run – Query Preview",
    "============================",
    "",
    `Add $select=${selectedTokens.join(",")}`,
    "",
    "Original query:",
    target.text,
    "",
    "Preview query:",
    previewQuery,
    "",
    "Use the confirmation dialog to apply this preview."
  ].join("\n"));

  const choice = await vscode.window.showWarningMessage(
    "DV Quick Run: Preview is ready. Apply it to the detected query?",
    { modal: true },
    "Apply Preview"
  );

  if (choice !== "Apply Preview") {
    void vscode.window.showInformationMessage("DV Quick Run: Preview cancelled. The detected query was not changed.");
    return;
  }

  await applyEditorQueryUpdate(target, previewQuery);
  await vscode.window.showTextDocument(target.editor.document, {
    viewColumn: target.editor.viewColumn,
    preserveFocus: false,
    preview: false
  });
  void vscode.window.showInformationMessage("DV Quick Run: Preview applied to query.");
}

export function buildAddSelectPreviewFromTarget(
  target: { text?: string; queryText?: string },
  selectTokens: string[]
): string {
  const queryText = target.text ?? target.queryText;
  if (!queryText || !queryText.trim()) {
    throw new Error("Target query text is required.");
  }

  if (!selectTokens.length) {
    throw new Error("At least one $select field is required.");
  }

  const parsed = parseEditorQuery(queryText);
  if (parsed.queryOptions.has("$select")) {
    throw new Error("Query already contains $select.");
  }

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$select", selectTokens.join(","));
  parsed.queryOptions = updated;

  return buildEditorQuery(parsed);
}

async function openOrReuseQueryPreviewDocument(content: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument(QUERY_PREVIEW_URI);
  const editor = await vscode.window.showTextDocument(document, {
    preview: false,
    preserveFocus: false,
    viewColumn: vscode.ViewColumn.Beside
  });

  const fullText = document.getText();
  const fullRange = new vscode.Range(document.positionAt(0), document.positionAt(fullText.length));

  await editor.edit((editBuilder) => {
    if (fullText.length === 0) {
      editBuilder.insert(new vscode.Position(0, 0), content);
    } else {
      editBuilder.replace(fullRange, content);
    }
  });
}
