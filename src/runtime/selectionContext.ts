import * as vscode from "vscode";
import { CommandContext } from "../commands/context/commandContext.js";

const GUID_REGEX =
  /^"?[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"?$/;

export function registerSelectionContext(
  context: vscode.ExtensionContext,
  _ctx: CommandContext
): void {
  const updateSelectionContext = (editor?: vscode.TextEditor): void => {
    if (!editor) {
      void vscode.commands.executeCommand("setContext", "dvQuickRun.selectionIsGuid", false);
      return;
    }

    const selection = editor.selection;
    if (selection.isEmpty) {
      void vscode.commands.executeCommand("setContext", "dvQuickRun.selectionIsGuid", false);
      return;
    }

    const selectedText = editor.document.getText(selection).trim();
    const isGuid = GUID_REGEX.test(selectedText);

    void vscode.commands.executeCommand("setContext", "dvQuickRun.selectionIsGuid", isGuid);
  };

  updateSelectionContext(vscode.window.activeTextEditor);

  context.subscriptions.push(
    vscode.window.onDidChangeTextEditorSelection((event) => {
      updateSelectionContext(event.textEditor);
    }),
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      updateSelectionContext(editor);
    })
  );
}