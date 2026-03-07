import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerRunGetCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.runGet", async () => {
    await runDvQuickRunAction("get", ctx);
  });

  ext.subscriptions.push(disposable);
}