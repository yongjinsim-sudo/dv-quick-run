import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function runQueryUnderCursor(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("runQueryUnderCursor", ctx);
}

export function registerRunQueryUnderCursorCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.runQueryUnderCursor", "runQueryUnderCursor", ctx);
}
