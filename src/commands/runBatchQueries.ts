import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerRunBatchQueriesCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.runBatchQueries", async () => {
    await runDvQuickRunAction("runBatchQueries", ctx);
  });

  ext.subscriptions.push(disposable);
}
