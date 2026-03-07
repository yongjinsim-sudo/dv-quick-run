import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerSmartPatchRerunLastCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartPatchRerunLast", async () => {
    await runDvQuickRunAction("smartPatchRerunLast", ctx);
  });

  ext.subscriptions.push(disposable);
}