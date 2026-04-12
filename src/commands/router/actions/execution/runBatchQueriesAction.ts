import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { runAction } from "../shared/actionRunner.js";
import { detectQueryKind } from "../../../../shared/editorIntelligence/queryDetection.js";
import { previewAndRunBatchQueries } from "./batch/runBatchExecutionFlow.js";

export async function runBatchQueriesAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: Run as $batch failed. Check Output.", async () => {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
      void vscode.window.showWarningMessage("DV Quick Run: Open a document with two or more OData GET queries first.");
      return;
    }

    const queries = extractBatchCandidateQueries(editor.document, editor.selection);
    if (queries.length < 2) {
      void vscode.window.showWarningMessage(
        "DV Quick Run: Batch execution requires at least two OData GET queries. Select multiple query lines or place them in the current document."
      );
      return;
    }

    await previewAndRunBatchQueries(ctx, queries);
  });
}

function extractBatchCandidateQueries(document: vscode.TextDocument, selection: vscode.Selection): string[] {
  const sourceText = selection && !selection.isEmpty
    ? document.getText(selection)
    : document.getText();

  return sourceText
    .split(/\r?\n/)
    .map((line: string) => line.trim())
    .filter((line: string) => detectQueryKind(line) === "odata")
    .filter((line: string, index: number, lines: string[]) => lines.indexOf(line) === index);
}

