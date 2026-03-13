import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";

export function registerCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  handler: (ctx: CommandContext) => Promise<void> | void,
  ctx: CommandContext
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async () => {
      await handler(ctx);
    })
  );
}