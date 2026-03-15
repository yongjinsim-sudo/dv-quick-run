import { CommandContext } from "./context/commandContext.js";
import { runDvQuickRunAction } from "./router/dataverseRouter.js";

export async function investigateRecord(ctx: CommandContext): Promise<void> {
  await runDvQuickRunAction("investigateRecord", ctx);
}