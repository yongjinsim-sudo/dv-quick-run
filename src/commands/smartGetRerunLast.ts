import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerSmartGetRerunLastCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartGetRerunLast", async () => {
    await runDvQuickRunAction("smartGetRerunLast", ctx);
  });

  ext.subscriptions.push(disposable);
}