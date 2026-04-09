import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import type { DvQuickRunAction } from "./router/dataverseRouter.js";

export function registerCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  handler: (ctx: CommandContext, ...args: any[]) => Promise<void> | void,
  ctx: CommandContext
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async (...args: any[]) => {
      await handler(ctx, ...args);
    })
  );
}

export function registerRouterCommand(
  context: vscode.ExtensionContext,
  commandId: string,
  actionName: DvQuickRunAction,
  ctx: CommandContext
) {
  context.subscriptions.push(
    vscode.commands.registerCommand(commandId, async () => {
      const { runDvQuickRunAction } = await import("./router/dataverseRouter.js");
      await runDvQuickRunAction(actionName, ctx);
    })
  );
}
