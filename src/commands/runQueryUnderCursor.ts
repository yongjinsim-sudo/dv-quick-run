import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function runQueryUnderCursor(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("runQueryUnderCursor", ctx);
}