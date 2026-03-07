import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerSmartGetEditLastCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartGetEditLast", async () => {
    await runDvQuickRunAction("smartGetEditLast", ctx);
  });

  ext.subscriptions.push(disposable);
}