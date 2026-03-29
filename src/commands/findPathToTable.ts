import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function findPathToTable(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("findPathToTable", ctx);
}

export function registerFindPathToTableCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerRouterCommand(context, "dvQuickRun.findPathToTable", "findPathToTable", ctx);
}