import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addExpand(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addExpand", ctx);
}