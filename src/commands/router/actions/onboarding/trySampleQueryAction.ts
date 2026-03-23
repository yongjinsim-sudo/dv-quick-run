import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";

const SAMPLE_QUERY = "accounts?$select=name,accountnumber&$top=5";

async function openSampleQueryInEditor(query: string): Promise<void> {
  const document = await vscode.workspace.openTextDocument({
    content: query,
    language: "plaintext"
  });

  await vscode.window.showTextDocument(document, { preview: false });
}

export async function runTrySampleQueryAction(ctx: CommandContext): Promise<void> {
  await openSampleQueryInEditor(SAMPLE_QUERY);

  const hasActiveEnvironment = !!ctx.envContext.getActiveEnvironment();

  if (!hasActiveEnvironment) {
    const choice = await vscode.window.showInformationMessage(
      "DV Quick Run: Sample query inserted. Set up an environment next, then press Ctrl+Enter to run it.",
      "Set Up Environment"
    );

    if (choice === "Set Up Environment") {
      await vscode.commands.executeCommand("dvQuickRun.addEnvironment");
    }

    return;
  }

  const choice = await vscode.window.showInformationMessage(
    "DV Quick Run: Sample query inserted. Run it now or press Ctrl+Enter.",
    "Run Query"
  );

  if (choice === "Run Query") {
    await vscode.commands.executeCommand("dvQuickRun.runQueryUnderCursor");
  }
}