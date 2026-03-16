import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function explainQuery(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("explainQuery", ctx);
}

export function registerExplainQueryCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.explainQuery", "explainQuery", ctx);
}
