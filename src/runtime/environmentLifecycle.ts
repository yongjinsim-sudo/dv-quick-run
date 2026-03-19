import * as vscode from "vscode";
import { CommandContext } from "../commands/context/commandContext.js";
import { EnvironmentContext } from "../services/environmentContext.js";
import { logInfo } from "../utils/logger.js";
import { EnvironmentStatusBar } from "../webview/environmentStatusBar.js";
import { registerSelectEnvironmentCommand } from "../commands/selectEnvironment.js";
import { registerAddEnvironmentCommand } from "../commands/addEnvironment.js";
import { registerRemoveEnvironmentCommand } from "../commands/removeEnvironment.js";
import { clearEnvironmentScopedRuntimeCaches } from "./environmentRuntimeState.js";

function refreshEnvironmentStatusBar(environmentStatusBar: EnvironmentStatusBar): void {
  environmentStatusBar.refresh();
}

export function registerEnvironmentLifecycle(
  context: vscode.ExtensionContext,
  ctx: CommandContext,
  envContext: EnvironmentContext,
  environmentStatusBar: EnvironmentStatusBar
): void {
  const refreshStatusBar = () => {
    refreshEnvironmentStatusBar(environmentStatusBar);
  };

  registerSelectEnvironmentCommand(context, ctx, refreshStatusBar);
  registerAddEnvironmentCommand(context, ctx, refreshStatusBar);
  registerRemoveEnvironmentCommand(context, ctx, refreshStatusBar);

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (event) => {
      if (!event.affectsConfiguration("dvQuickRun.environments")) {
        return;
      }

      logInfo(ctx.output, "DV Quick Run: Environment configuration changed. Reloading...");

      await envContext.initialize();
      clearEnvironmentScopedRuntimeCaches(ctx.output);
      refreshEnvironmentStatusBar(environmentStatusBar);
      logInfo(
        ctx.output,
        `DV Quick Run: Active environment: ${envContext.getEnvironmentName()}`
      );

      vscode.window.showInformationMessage(
        `DV Quick Run environment: ${envContext.getEnvironmentName()}`
      );
    })
  );
}
