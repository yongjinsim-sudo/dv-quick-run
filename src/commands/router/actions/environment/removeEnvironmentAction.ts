import * as vscode from "vscode";
import { CommandContext } from "../../../context/commandContext.js";
import { logInfo } from "../../../../utils/logger.js";
import { clearEnvironmentScopedRuntimeCaches } from "../../../../runtime/environmentRuntimeState.js";

export async function removeEnvironmentAction(
  ctx: CommandContext
): Promise<boolean> {
  const environments = ctx.envContext.getConfiguredEnvironments();
  const activeEnv = ctx.envContext.getActiveEnvironment();

  if (!environments.length) {
    vscode.window.showWarningMessage(
      "DV Quick Run: No environments configured."
    );
    return false;
  }

  const picked = await vscode.window.showQuickPick(
    environments.map((env) => ({
      label: env.name,
      description: env.url,
      detail: activeEnv?.name === env.name ? "Currently active" : undefined
    })),
    {
      placeHolder: "Select environment to remove"
    }
  );

  if (!picked) {
    return false;
  }

  const selected = environments.find((e) => e.name === picked.label);
  if (!selected) {
    return false;
  }

  const confirm = await vscode.window.showWarningMessage(
    `Remove environment '${selected.name}'?`,
    { modal: true },
    "Remove"
  );

  if (confirm !== "Remove") {
    return false;
  }

  const updated = environments.filter((e) => e.name !== selected.name);

  const config = vscode.workspace.getConfiguration("dvQuickRun");
  await config.update(
    "environments",
    updated,
    vscode.ConfigurationTarget.Global
  );

  if (activeEnv?.name === selected.name) {
    if (updated.length > 0) {
      await ctx.envContext.setActiveEnvironment(updated[0]);
    } else {
      await ctx.ext.workspaceState.update("dvQuickRun.activeEnvironment", undefined);
      ctx.envContext.clearActiveEnvironment?.();
    }
  }

  clearEnvironmentScopedRuntimeCaches(ctx.output);

  logInfo(ctx.output, `DV Quick Run: Removed environment: ${selected.name}`);

  if (updated.length > 0) {
    logInfo(
      ctx.output,
      `DV Quick Run: Active environment: ${ctx.envContext.getEnvironmentName()}`
    );

    vscode.window.showInformationMessage(
      `DV Quick Run: Environment '${selected.name}' removed. Active environment is now '${ctx.envContext.getEnvironmentName()}'.`
    );
  } else {
    vscode.window.showInformationMessage(
      `DV Quick Run: Environment '${selected.name}' removed. No environments remain configured.`
    );
  }

  return true;
}