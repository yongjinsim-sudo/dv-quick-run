import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { ResultViewerPanel } from "../providers/resultViewerPanel.js";

export async function reopenLastResultViewer(ctx: CommandContext): Promise<void> {
  const reopened = ResultViewerPanel.reopenLastResultViewer();

  if (!reopened) {
    void vscode.window.showInformationMessage(
      "DV Quick Run: No recoverable Result Viewer context is available yet."
    );
  }
}

export function registerReopenLastResultViewerCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.reopenLastResultViewer", reopenLastResultViewer, ctx);
}
