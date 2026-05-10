import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function backTraversal(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("backTraversal", ctx);
}

export function registerBackTraversalCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerRouterCommand(context, "dvQuickRun.backTraversal", "backTraversal", ctx);
}
