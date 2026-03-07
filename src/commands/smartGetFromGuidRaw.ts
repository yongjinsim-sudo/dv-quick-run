import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerSmartGetFromGuidRawCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  ext.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.smartGetFromGuidRaw", async () => {
      await runDvQuickRunAction("smartGetFromGuidRaw", ctx);
    })
  );
}