import * as vscode from "vscode";
import { previewAndApplyReplaceFilterValueAtLine } from "../refinement/filterValueReplacement.js";

async function runCommandAtLine(
  documentUri: vscode.Uri,
  lineNumber: number,
  command: string
): Promise<void> {
  const doc = await vscode.workspace.openTextDocument(documentUri);
  const editor = await vscode.window.showTextDocument(doc, {
    preview: false,
    preserveFocus: false
  });

  const pos = new vscode.Position(lineNumber, 0);

  editor.selection = new vscode.Selection(pos, pos);
  editor.revealRange(
    new vscode.Range(pos, pos),
    vscode.TextEditorRevealType.InCenter
  );

  await vscode.commands.executeCommand(command);
}

export function registerInternalSupportCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.runQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.runQueryUnderCursor");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.explainQueryAtLine",
      async (documentUri: vscode.Uri, lineNumber: number) => {
        await runCommandAtLine(documentUri, lineNumber, "dvQuickRun.explainQuery");
      }
    )
  );

  context.subscriptions.push(
    vscode.commands.registerCommand(
      "dvQuickRun.previewReplaceFilterValueAtLine",
      async (
        documentUri: vscode.Uri,
        lineNumber: number,
        fieldLogicalName: string,
        oldValue: string,
        newValue: string
      ) => {
        await previewAndApplyReplaceFilterValueAtLine({
          documentUri,
          lineNumber,
          fieldLogicalName,
          oldValue,
          newValue
        });
      }
    )
  );
}
