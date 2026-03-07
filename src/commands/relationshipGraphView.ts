import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function relationshipGraphView(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("relationshipGraphView", ctx);
}