import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { runShowEntityMetadataAction } from "./router/actions/metadata/metadataAction.js";

export function registerShowEntityMetadataCommand(
  ext: vscode.ExtensionContext,
  ctx: CommandContext
): void {
  const disposable = vscode.commands.registerCommand(
    "dvQuickRun.showEntityMetadata",
    async (entityLogicalName?: string) => {
      await runShowEntityMetadataAction(ctx, entityLogicalName);
    }
  );

  ext.subscriptions.push(disposable);
}