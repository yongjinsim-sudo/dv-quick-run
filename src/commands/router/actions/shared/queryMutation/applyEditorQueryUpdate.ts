import * as vscode from "vscode";
import { EditorQueryTarget } from "./editorQueryTarget.js";

export async function applyEditorQueryUpdate(
  target: EditorQueryTarget,
  updatedText: string
): Promise<void> {
  const workspaceEdit = new vscode.WorkspaceEdit();
  workspaceEdit.replace(target.editor.document.uri, target.range, updatedText);

  const success = await vscode.workspace.applyEdit(workspaceEdit);
  if (!success) {
    throw new Error("Failed to update editor text.");
  }

}

export async function replaceCurrentEditorQuery(
  updatedText: string
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selection = editor.selection;
  const selectedText = editor.document.getText(selection).trim();

  const range = selectedText
    ? selection
    : editor.document.lineAt(selection.active.line).range;

  const success = await editor.edit((editBuilder) => {
    editBuilder.replace(range, updatedText);
  });

  if (!success) {
    throw new Error("Failed to update editor text.");
  }
}