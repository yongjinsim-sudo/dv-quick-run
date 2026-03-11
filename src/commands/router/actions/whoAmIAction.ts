import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { logError, logInfo } from "../../../utils/logger.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";

export async function runWhoAmIAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope();
    const token = await ctx.getToken(scope);

    logInfo(ctx.output,`Calling WhoAmI...`);
    const client = ctx.getClient();

    const result = await client.get("/WhoAmI", token);
    await showJsonNamed("DVQR - WhoAmI", result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    logError(ctx.output,msg);
    vscode.window.showErrorMessage("DV Quick Run: WhoAmI failed. Check Output.");
  }
}