import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { runEnvironmentSetup } from "../../../services/environmentSetup.js";
import { logInfo } from "../../../utils/logger.js";

export async function addEnvironmentAction(
  ctx: CommandContext
): Promise<boolean> {
  const created = await runEnvironmentSetup(ctx.envContext);

  if (!created) {
    return false;
  }

  logInfo(
    ctx.output,
    `DV Quick Run: Environment added: ${created.name}`
  );

  const makeActive = await vscode.window.showQuickPick(
    ["Yes", "No"],
    {
      placeHolder: `Switch active environment to '${created.name}' now?`
    }
  );

  if (makeActive === "Yes") {
    await ctx.envContext.setActiveEnvironment(created);

    logInfo(
      ctx.output,
      `DV Quick Run: Active environment: ${ctx.envContext.getEnvironmentName()}`
    );

    vscode.window.showInformationMessage(
      `DV Quick Run environment: ${ctx.envContext.getEnvironmentName()}`
    );
  }

  return true;
}