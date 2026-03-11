import * as vscode from "vscode";
import { CommandContext } from "./context/commandContext.js";
import { addEnvironmentAction } from "./router/actions/addEnvironmentAction.js";

export function registerAddEnvironmentCommand(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  onChanged?: () => void
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand("dvQuickRun.addEnvironment", async () => {
      const changed = await addEnvironmentAction(ctx);
      if (changed) {
        onChanged?.();
      }
    })
  );
}