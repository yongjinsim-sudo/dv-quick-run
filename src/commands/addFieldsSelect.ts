import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addFieldsSelect(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addFieldsSelect", ctx);
}

export function registerAddFieldsSelectCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.addFieldsSelect", "addFieldsSelect", ctx);
}
