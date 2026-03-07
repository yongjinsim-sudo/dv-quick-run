import * as vscode from "vscode";

export type EditorQuerySource = "selection" | "line";

export interface EditorQueryTarget {
  editor: vscode.TextEditor;
  range: vscode.Range;
  text: string;
  source: EditorQuerySource;
}

export function getEditorQueryTarget(): EditorQueryTarget {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    throw new Error("No active editor.");
  }

  const selectedText = editor.document.getText(editor.selection);
  if (selectedText.trim()) {
    return {
      editor,
      range: editor.selection,
      text: selectedText.trim(),
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