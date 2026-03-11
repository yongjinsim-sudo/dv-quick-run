import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { removeEnvironmentAction } from "./router/actions/removeEnvironmentAction.js";

export function registerRemoveEnvironmentCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  onChanged?: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.removeEnvironment", async () => {
      const changed = await removeEnvironmentAction(ctx);

      if (changed) {
        onChanged?.();
      }
    })
  );
}