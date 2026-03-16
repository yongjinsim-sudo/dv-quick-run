import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addOrderBy(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addOrderBy", ctx);
}

export function registerAddOrderByCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.addOrderBy", "addOrderBy", ctx);
}
