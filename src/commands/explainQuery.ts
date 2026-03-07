import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function explainQuery(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("explainQuery", ctx);
}