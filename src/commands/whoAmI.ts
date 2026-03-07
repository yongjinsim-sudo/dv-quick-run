import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerWhoAmICommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.whoAmI", async () => {
    await runDvQuickRunAction("whoAmI", ctx);
  });

  ext.subscriptions.push(disposable);
}