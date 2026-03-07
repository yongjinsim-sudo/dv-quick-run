import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerGetMetadataCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  const disposable = vscode.commands.registerCommand("dvQuickRun.getMetadata", async () => {
    await runDvQuickRunAction("getMetadata", ctx);
  });

  ext.subscriptions.push(disposable);
}