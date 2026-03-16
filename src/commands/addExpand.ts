import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addExpand(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addExpand", ctx);
}

export function registerAddExpandCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.addExpand", "addExpand", ctx);
}
