import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { clearQueryHistory } from "../../../utils/queryHistory.js";

export async function runClearHistoryAction(ctx: CommandContext): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    "DV Quick Run: Clear query history?",
    { modal: true },
    "Clear"
  );

if (confirm !== "Clear") { return; }

  await clearQueryHistory(ctx.ext);

  vscode.window.showInformationMessage("DV Quick Run: Query history cleared.");
}