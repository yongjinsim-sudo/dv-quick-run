import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerClearHistoryCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.clearHistory", async () => {
    await runDvQuickRunAction("clearHistory", ctx);
  });

  ext.subscriptions.push(disposable);
}