import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { runOpenQuickStartAction } from "./router/actions/onboarding/openQuickStartAction.js";

export async function openQuickStart(ctx: CommandContext): Promise<void> {
  await runOpenQuickStartAction(ctx);
}

export function registerOpenQuickStartCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openQuickStart", openQuickStart, ctx);
}
