import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addOrderBy(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addOrderBy", ctx);
}