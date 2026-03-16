import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerRouterCommand } from "./registerCommandHelpers.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function investigateRecord(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("investigateRecord", ctx);
}

export function registerInvestigateRecordCommand(context: vscode.ExtensionContext, ctx: CommandContext): void {
  registerRouterCommand(context, "dvQuickRun.investigateRecord", "investigateRecord", ctx);
}
