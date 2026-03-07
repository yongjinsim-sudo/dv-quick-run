import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function addFilter(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("addFilter", ctx);
}