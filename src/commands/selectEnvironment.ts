import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { selectEnvironmentAction } from "./router/actions/environment/selectEnvironmentAction.js";

export function registerSelectEnvironmentCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  onChanged?: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.selectEnvironment", async () => {
      const changed = await selectEnvironmentAction(ctx);

      if (changed) {
        onChanged?.();
      }
    })
  );
}