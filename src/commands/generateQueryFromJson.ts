import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export function registerGenerateQueryFromJsonCommand(ext: vscode.ExtensionContext, ctx: CommandContext) {
  ext.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.generateQueryFromJson", async () => {
      await runDvQuickRunAction("generateQueryFromJson", ctx);
    })
  );
}