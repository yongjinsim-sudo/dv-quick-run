import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { registerCommand } from "./registerCommandHelpers.js";
import { ResultViewerPanel } from "../providers/resultViewerPanel.js";

export async function openOperationalProfileSurface(
  ctx: CommandContext,
  entityLogicalName?: string
): Promise<void> {
  const opened = await ResultViewerPanel.openOperationalProfileSurface(ctx, entityLogicalName);

  if (!opened) {
    void vscode.window.showInformationMessage(
      "DV Quick Run: Open a Result Viewer first to show the Operational Profile surface. Use DV Quick Run: Export Operational Profile Snapshot for a document-style export."
    );
  }
}

export function registerOpenOperationalProfileSurfaceCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  registerCommand(context, "dvQuickRun.openOperationalProfileSurface", openOperationalProfileSurface, ctx);
}
