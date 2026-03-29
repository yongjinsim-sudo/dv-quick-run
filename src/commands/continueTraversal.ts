import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function continueTraversal(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("continueTraversal", ctx);
}

export function registerContinueTraversalCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerRouterCommand(context, "dvQuickRun.continueTraversal", "continueTraversal", ctx);
}