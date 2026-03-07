import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerSmartPatchEditLastCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.smartPatchEditLast", async () => {
    await runDvQuickRunAction("smartPatchEditLast", ctx);
  });

  ext.subscriptions.push(disposable);
}