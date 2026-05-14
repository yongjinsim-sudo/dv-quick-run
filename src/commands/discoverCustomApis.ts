import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { openCapabilityExplorer } from "./capabilityExplorer/openCapabilityExplorerCommand.js";

export function registerDiscoverCustomApisCommand(ext: vscode.ExtensionContext, ctx: CommandContext): void {
  const disposable = vscode.commands.registerCommand("dvQuickRun.discoverCustomApis", async () => {
    await openCapabilityExplorer(ctx);
  });

  ext.subscriptions.push(disposable);
}
