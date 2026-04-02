import * as vscode from "vscode";
import { applyEditorQueryUpdate } from "../commands/router/actions/shared/queryMutation/applyEditorQueryUpdate.js";
import { buildEditorQuery, parseEditorQuery } from "../commands/router/actions/shared/queryMutation/parsedEditorQuery.js";
import type { EditorQueryTarget } from "../commands/router/actions/shared/queryMutation/editorQueryTarget.js";

const QUERY_PREVIEW_URI = vscode.Uri.parse("untitled:dv-quick-run-query-preview.txt");

export async function previewAndApplyAddTopInActiveEditor(value: number): Promise<void> {
  const target = resolveActiveLineTarget();
  const previewQuery = buildAddTopPreviewFromTarget(target, value);

  await openOrReuseQueryPreviewDocument([
    "DV Quick Run – Query Preview",
    "============================",
    "",
    `Add $top=${value}`,
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

function resolveActiveLineTarget(): EditorQueryTarget {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selectionText = editor.document.getText(editor.selection).trim();
  if (selectionText) {
    return {
      editor,
      range: editor.selection,
      text: selectionText,
      source: "selection"
    };
  }

  const line = editor.document.lineAt(editor.selection.active.line);
  const text = line.text.trim();
  if (!text) {
    throw new Error("Current line is empty.");
  }

  return {
    editor,
    range: line.range,
    text,
    source: "line"
  };
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

export function buildAddTopPreviewFromTarget(
  target: { text?: string; queryText?: string },
  topValue: number
): string {
  const queryText = target.text ?? target.queryText;

  if (!queryText || !queryText.trim()) {
    throw new Error("Target query text is required.");
  }

  const parsed = parseEditorQuery(queryText);

  if (parsed.queryOptions.has("$top")) {
    throw new Error("Query already contains $top.");
  }

  const updated = new URLSearchParams(parsed.queryOptions.toString());
  updated.set("$top", String(topValue));
  parsed.queryOptions = updated;

  return buildEditorQuery(parsed);
}