import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { logInfo } from "../../../utils/logger.js";
import { clearNavigationHoverEnrichmentCache } from "../../../providers/queryHoverProvider.js";
import { clearHoverFieldContextCache } from "../../../providers/hoverFieldContextCache.js";
import { clearMetadataSessionCache } from "./shared/metadataLoadCache.js";

export async function selectEnvironmentAction(
  ctx: CommandContext
): Promise<boolean> {
  const environments = ctx.envContext.getConfiguredEnvironments();

  if (!environments.length) {
    vscode.window.showWarningMessage(
      "DV Quick Run: No environments configured."
    );
    return false;
  }

  const picked = await vscode.window.showQuickPick(
    environments.map((env) => ({
      label: env.name,
      description: env.url
    })),
    { placeHolder: "Select Dataverse environment" }
  );

  if (!picked) {
    return false;
  }

  const selected = environments.find((e) => e.name === picked.label);
  if (!selected) {
    return false;
  }

  await ctx.envContext.setActiveEnvironment(selected);
  clearMetadataSessionCache();
  clearHoverFieldContextCache();
  clearNavigationHoverEnrichmentCache();
  logInfo(ctx.output, "DV Quick Run: Cleared metadata session caches after environment switch.");
  logInfo(ctx.output, `DV Quick Run: Active environment: ${ctx.envContext.getEnvironmentName()}`);

  vscode.window.showInformationMessage(
    `DV Quick Run environment: ${ctx.envContext.getEnvironmentName()}`
  );

  return true;
}