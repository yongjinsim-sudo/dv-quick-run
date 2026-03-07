import * as vscode from "vscode";
import { CommandContext } from "../../context/commandContext.js";
import { showJsonNamed } from "../../../utils/virtualJsonDoc.js";

export async function runWhoAmIAction(ctx: CommandContext): Promise<void> {
  ctx.output.show(true);

  try {
    const baseUrl = await ctx.getBaseUrl();
    const scope = ctx.getScope(baseUrl);

    ctx.output.appendLine(`BaseUrl: ${baseUrl}`);
    ctx.output.appendLine(`Scope: ${scope}`);
    ctx.output.appendLine(`Getting token via Azure CLI...`);

    const token = await ctx.getToken(scope);

    ctx.output.appendLine(`Calling WhoAmI...`);
    const client = ctx.getClient(baseUrl);

    const result = await client.get("/WhoAmI", token);
    await showJsonNamed("DVQR - WhoAmI", result);
  } catch (e: any) {
    const msg = e?.message ?? String(e);
    ctx.output.appendLine(msg);
    vscode.window.showErrorMessage("DV Quick Run: WhoAmI failed. Check Output.");
  }
}