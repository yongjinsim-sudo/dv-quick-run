import { CommandContext } from "../../../context/commandContext.js";
import { logInfo } from "../../../../utils/logger.js";
import { showJsonNamed } from "../../../../utils/virtualJsonDoc.js";
import { runAction } from "../shared/actionRunner.js";

export async function runWhoAmIAction(ctx: CommandContext): Promise<void> {
  await runAction(ctx, "DV Quick Run: WhoAmI failed. Check Output.", async () => {
    const token = await ctx.getToken(ctx.getScope());

    logInfo(ctx.output, "Calling WhoAmI...");
    const client = ctx.getClient();

    const result = await client.get("/WhoAmI", token);
    await showJsonNamed("DVQR - WhoAmI", result);
  });
}
