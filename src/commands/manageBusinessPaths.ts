import * as vscode from "vscode";
import type { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { runManageBusinessPathsAction } from "./router/actions/businessPaths/manageBusinessPathsAction.js";

export function registerManageBusinessPathsCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(
    context,
    "dvQuickRun.manageBusinessPaths",
    runManageBusinessPathsAction,
    ctx
  );
}
