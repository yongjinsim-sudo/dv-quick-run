import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function trySampleQuery(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("trySampleQuery", ctx);
}

export function registerTrySampleQueryCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.trySampleQuery", "trySampleQuery", ctx);
}