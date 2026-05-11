import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function changeTraversalRoute(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("changeTraversalRoute", ctx);
}

export function registerChangeTraversalRouteCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerRouterCommand(context, "dvQuickRun.changeTraversalRoute", "changeTraversalRoute", ctx);
}
