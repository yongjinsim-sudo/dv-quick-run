import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addFilter(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addFilter", ctx);
}

export function registerAddFilterCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.addFilter", "addFilter", ctx);
}
